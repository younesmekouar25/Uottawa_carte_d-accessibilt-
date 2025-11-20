"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map, StyleSpecification } from "maplibre-gl";
import Sidebar from "@/components/Sidebar";
import BuildingsPanel from "@/components/panels/BuildingsPanel";
import BuildingDetails from "@/components/panels/BuildingDetails";
import NavigatePanel from "@/components/panels/NavigatePanel";

import AlertsPanel from "@/components/panels/AlertsPanel";
import EventsPanel from "@/components/panels/EventsPanel";
import type { Alert, CampusEvent } from "@/types/accessibility";

/* --------------------------- Types nav / steps --------------------------- */
type NavStep = {
  instruction: string;
  distance: number;
  hasStairs?: boolean;
  notes?: string[];
};

/* --------------------------- Types indoor graph -------------------------- */
type IndoorNode = {
  id: string;
  kind: string; // room | toilet | elevator | junction | entrance ...
  floor: number;
  label?: string;
  match?: { prop: string; value: string };
  coord?: [number, number]; // lon/lat optionnel
};

type IndoorEdge = {
  from: string;
  to: string;
  accessible?: boolean; // true = utilisable par PMR
};

type IndoorGraph = {
  nodes: IndoorNode[];
  edges: IndoorEdge[];
};

/* --------------------------- Limites & Polygone --------------------------- */
const CAMPUS_BOUNDS: [[number, number], [number, number]] = [
  [-75.6995, 45.4185],
  [-75.6735, 45.4305],
];

const CAMPUS_POLYGON: number[][] = [
  [-75.6938, 45.4279],
  [-75.6909, 45.4279],
  [-75.6891, 45.42755],
  [-75.6876, 45.4267],
  [-75.6865, 45.4254],
  [-75.6858, 45.4242],
  [-75.6846, 45.4237],
  [-75.6831, 45.4237],
  [-75.6817, 45.4227],
  [-75.6816, 45.4218],
  [-75.6821, 45.4208],
  [-75.6845, 45.4201],
  [-75.6869, 45.4201],
  [-75.6902, 45.4203],
  [-75.6925, 45.4217],
  [-75.6936, 45.4239],
  [-75.6938, 45.4256],
  [-75.6938, 45.4279],
];

/* --------------------------- Couleurs indoor --------------------------- */
const ACCESSIBLE_COLOR = "#0063b4ff";
const ROOM_COLOR = "#c49a6c";
const DEFAULT_COLOR = "#ffffffff";

/* ---------------------------- Utils géométriques ---------------------------- */
function pointInRing([x, y]: [number, number], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const inter =
      (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (inter) inside = !inside;
  }
  return inside;
}

const pointInPolygon = (pt: [number, number], outer: number[][]) =>
  pointInRing(pt, outer);

function walkCoords(a: any, collect: number[][]) {
  Array.isArray(a?.[0])
    ? a.forEach((b: any) => walkCoords(b, collect))
    : collect.push(a as number[]);
}

function bboxOf(feature: any): [[number, number], [number, number]] {
  const pts: number[][] = [];
  walkCoords(feature.geometry.coordinates, pts);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

function bboxArea(feature: any): number {
  const [[minX, minY], [maxX, maxY]] = bboxOf(feature);
  return Math.max(0, (maxX - minX) * (maxY - minY));
}

function centroidOf(feature: any): [number, number] {
  const coords: number[][] = [];
  walkCoords(feature.geometry.coordinates, coords);
  let sx = 0,
    sy = 0;
  for (const [x, y] of coords) {
    sx += x;
    sy += y;
  }
  const n = Math.max(coords.length, 1);
  return [sx / n, sy / n];
}

/* ------------------------------ Reprojection ------------------------------ */
function mercatorToLonLat([x, y]: [number, number]): [number, number] {
  const R = 6378137;
  const lng = (x / R) * (180 / Math.PI);
  const lat =
    (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lng, lat];
}

function reproject3857to4326(fc: any): GeoJSON.FeatureCollection {
  const convert = (coords: any): any =>
    Array.isArray(coords[0])
      ? coords.map(convert)
      : mercatorToLonLat(coords as [number, number]);

  return {
    type: "FeatureCollection",
    features: fc.features.map((f: any) => ({
      ...f,
      geometry: {
        ...f.geometry,
        coordinates: convert(f.geometry.coordinates),
      },
    })),
  } as GeoJSON.FeatureCollection;
}

/* --------------------------------- Types --------------------------------- */
type BFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, any>;

function isUCU(f: any): boolean {
  const p = f?.properties || {};
  const name = (
    p["name:fr"] ||
    p["name:en"] ||
    p.name ||
    ""
  ).toLowerCase();
  const code = (p.code || "").toString().toLowerCase();
  return code === "ucu" || name.includes("jock turcot");
}

/* --------------------------------- Page ---------------------------------- */
export default function Home() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const [showNavigatePanel, setShowNavigatePanel] = useState(false);
  const [showBuildingsPanel, setShowBuildingsPanel] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [showEventsPanel, setShowEventsPanel] = useState(false);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<CampusEvent[]>([]);

  const [buildingsFC, setBuildingsFC] =
    useState<GeoJSON.FeatureCollection | null>(null);

  const [selected, setSelected] = useState<BFeature | null>(null);

  const geolocateRef = useRef<maplibregl.GeolocateControl | null>(null);
  const [start, setStart] = useState<[number, number] | null>(null);
  const [dest, setDest] = useState<[number, number] | null>(null);
  const [steps, setSteps] = useState<NavStep[]>([]);
  const [pickMode, setPickMode] = useState<null | "start" | "dest">(null);

  const [indoorVisible, setIndoorVisible] = useState(false);
  const [floor, setFloor] = useState<number>(0);

  const INDOOR_SRC = "indoor-ucu";
  const INDOOR_WALLS_SRC = "indoor-ucu-walls";
  const INDOOR_ACCESS_SRC = "indoor-access";
  const INDOOR_ROUTE_SRC = "indoor-route";

  const floorToCode = (n: number): "F0" | "F1" | "F2" => `F${n}` as any;
  const codeToFloor = (s: "F0" | "F1" | "F2"): number => Number(s.slice(1));

  /* --------- Refs pour graph indoor + features de chaque étage --------- */
  const indoorGraphRef = useRef<IndoorGraph | null>(null);
  const indoorFCRef = useRef<Record<number, GeoJSON.FeatureCollection>>({});

  /* --------------------------- Helpers indoor --------------------------- */
  const hideIndoor = () => {
    const map = mapInstance.current;
    setIndoorVisible(false);
    if (!map) return;

    [
      "indoor-fill",
      "indoor-outline",
      "indoor-labels",
      "indoor-walls",
      "indoor-access",
      "indoor-route-line",
    ].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });

    [INDOOR_SRC, INDOOR_WALLS_SRC, INDOOR_ACCESS_SRC, INDOOR_ROUTE_SRC].forEach(
      (srcId) => {
        if (map.getSource(srcId)) {
          map.removeSource(srcId);
        }
      }
    );

    if (map.getLayer("b-fill")) {
      map.setLayoutProperty("b-fill", "visibility", "visible");
      map.setPaintProperty("b-fill", "fill-opacity", 0.62);
    }
  };

  const showOnlyBuilding = (f: BFeature | null) => {
    const map = mapInstance.current;
    if (!map) return;

    const layers = ["b-fill", "b-outline", "b-label"];

    if (!f) {
      layers.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setFilter(layerId, null as any);
        }
      });
      return;
    }

    const p = f.properties || {};
    const code = p.code;
    const name = p["name:fr"] || p["name:en"] || p.name || "";

    let filter: any = null;

    if (code) {
      filter = ["==", ["get", "code"], code];
    } else if (name) {
      filter = ["==", ["get", "name"], name];
    } else if (f.id !== undefined && f.id !== null) {
      filter = ["==", ["id"], f.id as any];
    }

    if (!filter) return;

    layers.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, filter);
      }
    });
  };

  const focusFeature = (f: BFeature) => {
    const map = mapInstance.current;
    if (!map) return;

    popupRef.current?.remove();
    map.fitBounds(bboxOf(f), { padding: 84, duration: 480 });

    const p = f.properties || {};
    const name = p["name:fr"] ?? p["name:en"] ?? p.name ?? "Building";

    popupRef.current = new maplibregl.Popup({ closeButton: true })
      .setLngLat(centroidOf(f))
      .setHTML(`<strong>${name}</strong>`)
      .addTo(map);

    setSelected(f);
    setDest(centroidOf(f));
    showOnlyBuilding(f);
  };

  /* ------------------- Trouver un nœud indoor ------------------- */
  function findIndoorNodeCoord(
    nodeId: string
  ): { coord: [number, number]; label: string; node: IndoorNode } | null {
    const graph = indoorGraphRef.current;
    if (!graph) return null;

    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    // 1) Si coord explicite dans le graphe → priorité
    if (node.coord) {
      return {
        coord: node.coord,
        label: node.label ?? node.id,
        node,
      };
    }

    // 2) Sinon, on essaie de retrouver la salle dans le GeoJSON de l’étage
    const fc = indoorFCRef.current[node.floor];
    if (!fc || !node.match) {
      return null;
    }

    const { prop, value } = node.match;
    const feats = (fc.features || []) as any[];
    const feat = feats.find(
      (f) => f.properties && f.properties[prop] === value
    );
    if (!feat) return null;

    const coord = centroidOf(feat) as [number, number];
    const p = feat.properties || {};
    const label =
      node.label ||
      p.Classroom ||
      p.elevator ||
      p.toilet ||
      p.name ||
      p["name:fr"] ||
      p["name:en"] ||
      node.id;

    return { coord, label, node };
  }

  /* ------------------- Construire un chemin indoor (BFS) ------------------ */
  function buildIndoorRouteByIds(
    startId: string,
    destId: string,
    accessibleOnly = true
  ) {
    const graph = indoorGraphRef.current;
    const map = mapInstance.current;
    if (!graph || !map) {
      console.warn("Graph indoor ou carte non prêts");
      return;
    }

    if (startId === destId) {
      console.warn("Start et dest identiques pour indoor");
      return;
    }

    const edges = graph.edges.filter(
      (e) => !accessibleOnly || e.accessible !== false
    );

    const adj: Record<string, string[]> = {};
    for (const e of edges) {
      if (!adj[e.from]) adj[e.from] = [];
      if (!adj[e.to]) adj[e.to] = [];
      adj[e.from].push(e.to);
      adj[e.to].push(e.from);
    }

    const q: string[] = [];
    const visited = new Set<string>();
    const prev: Record<string, string | null> = {};

    q.push(startId);
    visited.add(startId);
    prev[startId] = null;

    let found = false;

    while (q.length > 0) {
      const cur = q.shift() as string;
      if (cur === destId) {
        found = true;
        break;
      }
      for (const nb of adj[cur] || []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          prev[nb] = cur;
          q.push(nb);
        }
      }
    }

    if (!found) {
      console.warn("Aucun chemin indoor trouvé entre", startId, "et", destId);
      return;
    }

    const path: string[] = [];
    let cur: string | null = destId;
    while (cur) {
      path.push(cur);
      cur = prev[cur] ?? null;
    }
    path.reverse();

    const coords: [number, number][] = [];
    const newSteps: NavStep[] = [];

    for (let i = 0; i < path.length; i++) {
      const id = path[i];
      const info = findIndoorNodeCoord(id);
      if (!info) continue;

      coords.push(info.coord);
      if (Math.abs(coords[i][0]) < 1 && Math.abs(coords[i][1]) > 1) {
  coords[i] = [coords[i][1], coords[i][0]];
}


      const isStart = i === 0;
      const isEnd = i === path.length - 1;

      const notes: string[] = [];
      let hasStairs = false;

      if (info.node.kind === "elevator") {
        notes.push("Ascenseur accessible");
      }
      if (info.node.kind === "toilet") {
        notes.push("Toilettes accessibles");
      }
      if (info.node.kind === "stairs") {
        hasStairs = true;
        notes.push("Attention : escaliers");
      }

      const instruction = isStart
        ? `Point de départ : ${info.label}`
        : isEnd
        ? `Arrivée : ${info.label}`
        : `Aller vers ${info.label}`;

      newSteps.push({
        instruction,
        distance: 0,
        hasStairs,
        notes: notes.length ? notes : undefined,
      });
    }

    const src = map.getSource(INDOOR_ROUTE_SRC) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (src && coords.length >= 2) {
      const fc: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              kind: "indoor-route",
              from: startId,
              to: destId,
            },
            geometry: {
              type: "LineString",
              coordinates: coords,
            } as any,
          },
        ],
      };
      src.setData(fc);

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const [x, y] of coords) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      map.fitBounds(
        [
          [minX, minY],
          [maxX, maxY],
        ],
        { padding: 80, duration: 500 }
      );
    }

    setSteps(newSteps);
  }

  /* --------------------------- ROUTING (OSRM EXTÉRIEUR) --------------------------- */
  async function buildRoute(profile: "foot" | "driving" | "cycling" = "foot") {
    if (!start || !dest || !mapInstance.current) return;

    const url =
      `https://router.project-osrm.org/route/v1/${profile}/` +
      `${start[0]},${start[1]};${dest[0]},${dest[1]}` +
      `?overview=full&geometries=geojson&steps=true`;

    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes?.length) return;

    const route = data.routes[0];
    const gj = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            distance: route.distance,
            duration: route.duration,
          },
          geometry: route.geometry,
        },
      ],
    };
    (mapInstance.current!.getSource("route") as maplibregl.GeoJSONSource).setData(
      gj
    );

    const out: NavStep[] = [];
    for (const leg of route.legs || []) {
      for (const s of leg.steps || []) {
        const inst: string =
          s.maneuver?.instruction || s.name || "Continue tout droit";

        const lowered = inst.toLowerCase();
        const notes: string[] = [];
        let hasStairs = false;

        if (
          lowered.includes("stairs") ||
          lowered.includes("steps") ||
          lowered.includes("escaliers") ||
          lowered.includes("escalier")
        ) {
          hasStairs = true;
          notes.push("Présence possible d’escaliers");
        }

        out.push({
          instruction: inst,
          distance: s.distance,
          hasStairs,
          notes: notes.length ? notes : undefined,
        });
      }
    }
    setSteps(out);

    const coords: [number, number][] = route.geometry.coordinates;
    let minX = 999,
      minY = 999,
      maxX = -999,
      maxY = -999;
    for (const [x, y] of coords) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    mapInstance.current!.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 80, duration: 500 }
    );
  }

  /* --------------------------- INDOOR: charge étage --------------------------- */
  async function loadIndoorUCU(level: number, fit = true) {
    const map = mapInstance.current;
    if (!map) return;

    // 1) Salles / pièces
    const url = `/data/ucu-level-${level}.geojson`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Indoor file not found:", url);
      return;
    }
    let fc: any = await res.json();
    if (fc?.crs?.properties?.name?.includes("3857")) {
      fc = reproject3857to4326(fc);
    }

    indoorFCRef.current[level] = fc as GeoJSON.FeatureCollection;

    if (map.getSource(INDOOR_SRC)) {
      (map.getSource(INDOOR_SRC) as maplibregl.GeoJSONSource).setData(fc);
    } else {
      map.addSource(INDOOR_SRC, { type: "geojson", data: fc });

      map.addLayer({
        id: "indoor-fill",
        type: "fill",
        source: INDOOR_SRC,
        paint: {
  "fill-color": [
    "match",
    ["get", "type"],
    "corridor", "#ffffffff",
    "toilet", "#2196F3",
    "elevator", "#9C27B0",
    "piece", "#c49a6c",
    /* default */ "#ffffff"
  ],
  "fill-opacity": 0.8,
},

      });

      map.addLayer({
        id: "indoor-outline",
        type: "line",
        source: INDOOR_SRC,
        paint: {
          "line-color": "#111827",
          "line-width": 1,
        },
      });

      map.addLayer({
        id: "indoor-labels",
        type: "symbol",
        source: INDOOR_SRC,
        layout: {
          "text-field": [
            "coalesce",
            ["get", "Classroom"],
            ["get", "elevator"],
            ["get", "toilet"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-offset": [0, 0.9],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#111",
          "text-halo-color": "rgba(255,255,255,0.9)",
          "text-halo-width": 1.2,
        },
      });
    }

    // 2) Murs (niveau 0 uniquement)
    if (level === 0) {
      try {
        const wallRes = await fetch("/data/ucu_floor0_mur.geojson");
        if (wallRes.ok) {
          let wallFc: any = await wallRes.json();
          if (wallFc?.crs?.properties?.name?.includes("3857")) {
            wallFc = reproject3857to4326(wallFc);
          }

          if (map.getSource(INDOOR_WALLS_SRC)) {
            (map.getSource(INDOOR_WALLS_SRC) as maplibregl.GeoJSONSource).setData(
              wallFc
            );
          } else {
            map.addSource(INDOOR_WALLS_SRC, {
              type: "geojson",
              data: wallFc,
            });
            map.addLayer({
              id: "indoor-walls",
              type: "line",
              source: INDOOR_WALLS_SRC,
              paint: {
                "line-color": "#0f172a",
                "line-width": 2.2,
              },
            });
          }
        } else {
          console.warn("ucu_floor0_mur.geojson introuvable");
        }
      } catch (e) {
        console.warn("Erreur chargement murs UCU:", e);
      }
    } else {
      if (map.getLayer("indoor-walls")) {
        map.removeLayer("indoor-walls");
      }
      if (map.getSource(INDOOR_WALLS_SRC)) {
        map.removeSource(INDOOR_WALLS_SRC);
      }
    }

    // 3) Points d’accessibilité
    try {
      const accRes = await fetch("/data/pointaccessible.geojson");
      if (accRes.ok) {
        let accFc: any = await accRes.json();
        if (accFc?.crs?.properties?.name?.includes("3857")) {
          accFc = reproject3857to4326(accFc);
        }

        const filteredFeatures = accFc.features.filter(
          (f: any) =>
            !f.properties?.floor || f.properties.floor === String(level)
        );

        const accData: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: filteredFeatures,
        };

        if (!map.getSource(INDOOR_ACCESS_SRC)) {
          map.addSource(INDOOR_ACCESS_SRC, {
            type: "geojson",
            data: accData,
          });

          map.addLayer({
            id: "indoor-access",
            type: "symbol",
            source: INDOOR_ACCESS_SRC,
            layout: {
             "icon-image": [
  "match",
  ["get", "type"],
  "elevator", "elevator",
  "stairs", "stairs",
  "toilet", "toilet_access",
  /* fallback */
  "elevator"
],

              "icon-size": 0.25,
              "icon-anchor": "center",
              "icon-allow-overlap": true,
            },
          });
        } else {
          (
            map.getSource(INDOOR_ACCESS_SRC) as maplibregl.GeoJSONSource
          ).setData(accData);
        }
      } else {
        console.warn("pointaccessible.geojson introuvable");
      }
    } catch (e) {
      console.warn("Erreur chargement points accessibilité:", e);
    }

    // 4) Source pour la route indoor
    if (!map.getSource(INDOOR_ROUTE_SRC)) {
      map.addSource(INDOOR_ROUTE_SRC, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "indoor-route-line",
        type: "line",
        source: INDOOR_ROUTE_SRC,
        paint: {
          "line-color": "#16a34a",
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });
    }

    if (map.getLayer("b-fill")) {
      map.setLayoutProperty("b-fill", "visibility", "none");
    }
    setIndoorVisible(true);

    if (fit) {
      const pts: number[][] = [];
      for (const f of fc.features) walkCoords((f as any).geometry.coordinates, pts);
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const [x, y] of pts) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      map.fitBounds(
        [
          [minX, minY],
          [maxX, maxY],
        ],
        { padding: 80, duration: 500 }
      );
    }
  }

  useEffect(() => {
    if (indoorVisible) loadIndoorUCU(floor, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor]);

  /* --------------------------- MAP INIT --------------------------- */
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const style: StyleSpecification = {
      version: 8,
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        cartoVoyager: {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors, © CARTO",
        },
      },
      layers: [{ id: "basemap", type: "raster", source: "cartoVoyager" }],
    };

    const map = new maplibregl.Map({
      container: mapRef.current,
      style,
      center: [-75.685, 45.4236],
      zoom: 15.8,
      maxBounds: CAMPUS_BOUNDS,
      hash: false,
    });
    mapInstance.current = map;

    geolocateRef.current = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
      fitBoundsOptions: { maxZoom: 17 },
    });
    map.addControl(geolocateRef.current, "top-right");
    geolocateRef.current.on("geolocate", (e) => {
      const { longitude, latitude } = e.coords as any;
      setStart([longitude, latitude]);
    });

    map.on("load", async () => {
      const iconDefs: Record<string, string> = {
        elevator: "/icons/elevator.png",
        stairs: "/icons/stairs.png",
        toilet_access: "/icons/toilet_access.png",
        
      };

      Object.entries(iconDefs).forEach(([name, url]) => {
        if (map.hasImage(name)) return;
        map.loadImage(url, (err, image) => {
          if (err || !image) {
            console.error("Erreur loadImage pour", name, err);
            return;
          }
          if (!map.hasImage(name)) {
            map.addImage(name, image);
          }
        });
      });

      // Graphe indoor
      // Graphe indoor
try {
  const gRes = await fetch("/data/ucu-indoor-graph.json");
  if (gRes.ok) {
    const g = (await gRes.json()) as IndoorGraph;

    // 🔧 Correction ici : conversion des coords EPSG:3857 en WGS84 si besoin
    g.nodes.forEach((node) => {
      if (
        node.coord &&
        Math.abs(node.coord[0]) > 200 && // valeur typique de EPSG:3857
        Math.abs(node.coord[1]) > 200
      ) {
        node.coord = mercatorToLonLat(node.coord); // convertit en lon/lat
      }
    });

    indoorGraphRef.current = g;
    console.log("Indoor graph chargé :", g.nodes.length, "nœuds (coords vérifiées)");
  } else {
    console.warn("ucu-indoor-graph.json introuvable");
  }
} catch (e) {
  console.warn("Erreur chargement indoor graph:", e);
}


      // Bâtiments
      const resp = await fetch("/data/buildings.geojson");
      const raw = await resp.json();

      const filtered = (raw.features || []).filter((f: any) => {
        const p = f.properties || {};
        const name = (
          p["name:fr"] ||
          p["name:en"] ||
          p.name ||
          ""
        ).toLowerCase();
        const op = (p.operator || "").toLowerCase();
        const inside = pointInPolygon(centroidOf(f), CAMPUS_POLYGON);
        const text =
          name.includes("university of ottawa") ||
          name.includes("uottawa") ||
          op.includes("university of ottawa");
        return inside || text;
      });

      const feats = filtered.map((f: any, idx: number) => {
        const p = f.properties || {};
        const name = (
          p["name:fr"] ||
          p["name:en"] ||
          p.name ||
          ""
        ).toLowerCase();
        const op = (p.operator || "").toLowerCase();
        const isUO =
          name.includes("university of ottawa") ||
          name.includes("uottawa") ||
          op.includes("university of ottawa");
        const area = bboxArea(f);
        const areaNorm = Math.min(800, Math.round(area * 1e6));
        const id = f.id ?? idx;
        return {
          ...f,
          id,
          properties: {
            ...p,
            __pri: (isUO ? 1000 : 0) + areaNorm,
          },
        };
      });

      const data = {
        type: "FeatureCollection",
        features: feats,
      };
      map.addSource("buildings", { type: "geojson", data });

      setBuildingsFC(data as GeoJSON.FeatureCollection);

      map.addLayer({
        id: "b-fill",
        type: "fill",
        source: "buildings",
        paint: { "fill-color": "#b89a6d", "fill-opacity": 0.62 },
      });
      map.addLayer({
        id: "b-outline",
        type: "line",
        source: "buildings",
        paint: {
          "line-color": "#3b2f26",
          "line-width": 1,
        },
      });
      const labelExpr: any = [
        "coalesce",
        ["get", "name:fr"],
        ["get", "name:en"],
        ["get", "name"],
        ["get", "code"],
        ["concat", "Bldg ", ["to-string", ["id"]]],
      ];
      map.addLayer({
        id: "b-label",
        type: "symbol",
        source: "buildings",
        minzoom: 13.6,
        layout: {
          "text-field": labelExpr,
          "text-font": ["Noto Sans Regular"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            10.5,
            15,
            13.0,
            17,
            16.0,
          ],
          "text-variable-anchor": ["center", "top", "bottom", "left", "right"],
          "text-padding": 1,
          "text-max-width": 10,
          "text-allow-overlap": false,
          "symbol-sort-key": ["-", ["get", "__pri"]],
          "symbol-z-order": "auto",
        },
        paint: {
          "text-color": "#111",
          "text-halo-color": "rgba(255,255,255,0.95)",
          "text-halo-width": 1.6,
        },
      });

      map.addLayer({
        id: "b-hover",
        type: "line",
        source: "buildings",
        paint: { "line-color": "#111", "line-width": 3 },
        filter: ["==", ["id"], ""],
      });

      map.on("mousemove", "b-fill", (e) => {
        const id = e.features?.[0]?.id ?? "";
        map.setFilter("b-hover", ["==", ["id"], id]);
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "b-fill", () => {
        map.setFilter("b-hover", ["==", ["id"], ""]);
        map.getCanvas().style.cursor = "";
      });

      const clickHandler = (f?: BFeature) => {
        if (!f) return;
        focusFeature(f);
        if (isUCU(f)) {
          setFloor(0);
          loadIndoorUCU(0, true);
        } else {
          hideIndoor();
        }
      };

      map.on("click", "b-fill", (e) =>
        clickHandler(e.features?.[0] as BFeature)
      );
      map.on("click", "b-label", (e) =>
        clickHandler(e.features?.[0] as BFeature)
      );

      map.addSource("route", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#2563eb",
          "line-width": 5,
          "line-opacity": 0.85,
        },
      });
    });

    map.on("click", (e) => {
      if (!pickMode) return;
      const xy: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (pickMode === "start") setStart(xy);
      if (pickMode === "dest") setDest(xy);
      setPickMode(null);
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickMode]);

  // Liste des nœuds indoor pour l’UI (menu déroulant)
  const indoorNodesForUI: { id: string; label: string; floor: number }[] =
    (indoorGraphRef.current?.nodes || []).map((n) => ({
      id: n.id,
      floor: n.floor,
      label: n.label || n.id,
    }));

  // Onglet actif pour le sidebar (optionnel mais propre)
  const activeSection: string | null =
    showNavigatePanel
      ? "navigate"
      : showBuildingsPanel
      ? "buildings"
      : showAlertsPanel
      ? "alerts"
      : showEventsPanel
      ? "events"
      : null;

  return (
    <main className="w-screen h-screen relative bg-neutral-100">
      <div ref={mapRef} className="w-full h-full" />

      <Sidebar
        active={activeSection}
        onSelect={(section) => {
          // on ferme tout
          setShowBuildingsPanel(false);
          setShowNavigatePanel(false);
          setShowAlertsPanel(false);
          setShowEventsPanel(false);

          // on ouvre seulement la section choisie
          if (section === "buildings") setShowBuildingsPanel(true);
          if (section === "navigate") setShowNavigatePanel(true);
          if (section === "alerts") setShowAlertsPanel(true);
          if (section === "events") setShowEventsPanel(true);
        }}
      />

      {showBuildingsPanel && (
        <BuildingsPanel
          limit={150}
          onSelect={(f) => {
            const bf = f as BFeature;
            focusFeature(bf);
            if (isUCU(bf)) {
              setFloor(0);
              loadIndoorUCU(0, true);
            } else {
              hideIndoor();
            }
          }}
        />
      )}

      <BuildingDetails
        feature={selected}
        floor={floorToCode(floor)}
        onChangeFloor={(lvl) => {
          const n = codeToFloor(lvl);
          setFloor(n);
          loadIndoorUCU(n, false);
        }}
        onClose={() => {
          setSelected(null);
          hideIndoor();
          showOnlyBuilding(null);
        }}
      />

      {showNavigatePanel && (
        <NavigatePanel
          // extérieur
          start={start}
          dest={dest}
          steps={steps}
          buildings={buildingsFC}
          onUseMyPosition={() => geolocateRef.current?.trigger()}
          onPickStartOnMap={() => setPickMode("start")}
          onPickDestOnMap={() => setPickMode("dest")}
          onSetStartFromCenter={() => {
            const c = mapInstance.current?.getCenter();
            if (c) setStart([c.lng, c.lat]);
          }}
          onSetStart={(p) => setStart(p)}
          onSetDest={(p) => setDest(p)}
          onRouteFoot={() => buildRoute("foot")}
          onClearRoute={() => {
            const src = mapInstance.current?.getSource(
              "route"
            ) as maplibregl.GeoJSONSource | undefined;
            src?.setData({
              type: "FeatureCollection",
              features: [],
            } as any);

            const indoorSrc = mapInstance.current?.getSource(
              INDOOR_ROUTE_SRC
            ) as maplibregl.GeoJSONSource | undefined;
            indoorSrc?.setData({
              type: "FeatureCollection",
              features: [],
            } as any);

            setSteps([]);
            setStart(null);
            setDest(null);
          }}
          onClose={() => setShowNavigatePanel(false)}
          // 🔥 nouveau : navigation indoor
          indoorNodes={indoorNodesForUI}
          onIndoorRoute={(fromId: string, toId: string, accessible: boolean) =>
            buildIndoorRouteByIds(fromId, toId, accessible)
          }
        />
      )}

     {showAlertsPanel && (
  <AlertsPanel onClose={() => setShowAlertsPanel(false)} />
)}


      {showEventsPanel && (
        <EventsPanel
          events={events}
          onClose={() => setShowEventsPanel(false)}
          onFocusEvent={(ev) => {
            const map = mapInstance.current;
            if (!map || !ev.coord) return;
            map.flyTo({ center: ev.coord, zoom: 18, essential: true });
          }}
        />
      )}
    </main>
  );
}
