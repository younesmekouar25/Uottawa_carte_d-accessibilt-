"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map, StyleSpecification } from "maplibre-gl";
import Sidebar from "@/components/Sidebar";
import BuildingsPanel from "@/components/panels/BuildingsPanel";
import BuildingDetails from "@/components/panels/BuildingDetails";

import NavigatePanel from "@/components/panels/NavigatePanel"; // AJOUT


/* --------------------------- Limites & Polygone --------------------------- */
const CAMPUS_BOUNDS: [[number, number], [number, number]] = [
  [-75.6995, 45.4185],
  [-75.6735, 45.4305],
];
const CAMPUS_POLYGON: number[][] = [
  [-75.6938, 45.4279], [-75.6909, 45.4279], [-75.6891, 45.42755],
  [-75.6876, 45.4267], [-75.6865, 45.4254], [-75.6858, 45.4242],
  [-75.6846, 45.4237], [-75.6831, 45.4237], [-75.6817, 45.4227],
  [-75.6816, 45.4218], [-75.6821, 45.4208], [-75.6845, 45.4201],
  [-75.6869, 45.4201], [-75.6902, 45.4203], [-75.6925, 45.4217],
  [-75.6936, 45.4239], [-75.6938, 45.4256], [-75.6938, 45.4279],
];

/* ---------------------------- Utils géométriques ---------------------------- */
function pointInRing([x, y]: [number, number], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const inter = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (inter) inside = !inside;
  }
  return inside;
}
const pointInPolygon = (pt: [number, number], outer: number[][]) => pointInRing(pt, outer);

function walkCoords(a: any, collect: number[][]) {
  Array.isArray(a?.[0]) ? a.forEach((b: any) => walkCoords(b, collect)) : collect.push(a as number[]);
}
function bboxOf(feature: any): [[number, number], [number, number]] {
  const pts: number[][] = [];
  walkCoords(feature.geometry.coordinates, pts);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  return [[minX, minY], [maxX, maxY]];
}
function bboxArea(feature: any): number {
  const [[minX, minY], [maxX, maxY]] = bboxOf(feature);
  return Math.max(0, (maxX - minX) * (maxY - minY));
}
function centroidOf(feature: any): [number, number] {
  const coords: number[][] = [];
  walkCoords(feature.geometry.coordinates, coords);
  let sx = 0, sy = 0;
  for (const [x, y] of coords) { sx += x; sy += y; }
  const n = Math.max(coords.length, 1);
  return [sx / n, sy / n];
}

/* ------------------------------ Reprojection ------------------------------ */
function mercatorToLonLat([x, y]: [number, number]): [number, number] {
  const R = 6378137;
  const lng = (x / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lng, lat];
}
function reproject3857to4326(fc: any): GeoJSON.FeatureCollection {
  const convert = (coords: any): any =>
    Array.isArray(coords[0]) ? coords.map(convert) : mercatorToLonLat(coords as [number, number]);

  return {
    type: "FeatureCollection",
    features: fc.features.map((f: any) => ({
      ...f,
      geometry: { ...f.geometry, coordinates: convert(f.geometry.coordinates) },
    })),
  } as GeoJSON.FeatureCollection;
}

/* --------------------------------- Types --------------------------------- */
type BFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, any>;
function isUCU(f: any): boolean {
  const p = f?.properties || {};
  const name = (p["name:fr"] || p["name:en"] || p.name || "").toLowerCase();
  const code = (p.code || "").toString().toLowerCase();
  return code === "ucu" || name.includes("jock turcot");
}

/* --------------------------------- Page ---------------------------------- */
export default function Home() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const [showNavigatePanel, setShowNavigatePanel] = useState(false);


  // panneaux
  const [selected, setSelected] = useState<BFeature | null>(null);
  const [showBuildingsPanel, setShowBuildingsPanel] = useState(false);
  const toggleBuildingsPanel = () => setShowBuildingsPanel((s) => !s);

  // géoloc + routage
  const geolocateRef = useRef<maplibregl.GeolocateControl | null>(null);
  const [start, setStart] = useState<[number, number] | null>(null); // A
  const [dest, setDest]   = useState<[number, number] | null>(null); // B
  const [steps, setSteps] = useState<Array<{ instruction: string; distance: number }>>([]);
  const [pickMode, setPickMode] = useState<null | "start" | "dest">(null);

  // indoor
  const [indoorVisible, setIndoorVisible] = useState(false);
  const [floor, setFloor] = useState<number>(0);
  const [floorMax] = useState<number>(2);
  const INDOOR_SRC = "indoor-ucu";

  const floorToCode = (n: number): "F0" | "F1" | "F2" => (`F${n}` as any);
  const codeToFloor = (s: "F0" | "F1" | "F2"): number => Number(s.slice(1));

  // helpers indoor
  const hideIndoor = () => {
    const map = mapInstance.current;
    setIndoorVisible(false);
    if (!map) return;
    if (map.getLayer("indoor-fill")) map.removeLayer("indoor-fill");
    if (map.getLayer("indoor-outline")) map.removeLayer("indoor-outline");
    if (map.getLayer("indoor-labels")) map.removeLayer("indoor-labels");
    if (map.getSource(INDOOR_SRC)) map.removeSource(INDOOR_SRC);
    if (map.getLayer("b-fill")) map.setPaintProperty("b-fill", "fill-opacity", 0.62);
  };

  // zoom/centrage + popup
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
  };

  /* --------------------------- ROUTING (OSRM) --------------------------- */
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
      features: [{
        type: "Feature",
        properties: { distance: route.distance, duration: route.duration },
        geometry: route.geometry,
      }],
    };
    (mapInstance.current!.getSource("route") as maplibregl.GeoJSONSource).setData(gj);

    const out: Array<{ instruction: string; distance: number }> = [];
    for (const leg of route.legs || []) {
      for (const s of leg.steps || []) {
        const inst = s.maneuver?.instruction || s.name || "Continue";
        out.push({ instruction: inst, distance: s.distance });
      }
    }
    setSteps(out);

    const coords: [number, number][] = route.geometry.coordinates;
    let minX =  999, minY =  999, maxX = -999, maxY = -999;
    for (const [x, y] of coords) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    mapInstance.current!.fitBounds([[minX, minY], [maxX, maxY]], { padding: 80, duration: 500 });
  }

  /* --------------------------- INDOOR: charge étage --------------------------- */
  async function loadIndoorUCU(level: number, fit = true) {
    const map = mapInstance.current;
    if (!map) return;

    const url = `/data/ucu-level-${level}.geojson`;
    const res = await fetch(url);
    if (!res.ok) { console.warn("Indoor file not found:", url); return; }
    let fc: any = await res.json();
    if (fc?.crs?.properties?.name?.includes("3857")) fc = reproject3857to4326(fc);

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
            "case",
            ["!=", ["get", "Classroom"], null], "#93c5fd",
            ["!=", ["get", "toilet"], null], "#10b981",
            ["!=", ["get", "elevator"], null], "#f59e0b",
            "#cbd5e1",
          ],
          "fill-opacity": 0.58,
        },
      });
      map.addLayer({
        id: "indoor-outline",
        type: "line",
        source: INDOOR_SRC,
        paint: { "line-color": "#111827", "line-width": 1 },
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

    if (map.getLayer("b-fill")) map.setPaintProperty("b-fill", "fill-opacity", 0.25);
    setIndoorVisible(true);

    if (fit) {
      const pts: number[][] = [];
      for (const f of fc.features) walkCoords((f as any).geometry.coordinates, pts);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
      map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 80, duration: 500 });
    }
  }

  useEffect(() => { if (indoorVisible) loadIndoorUCU(floor, false); }, [floor]); // recharger à même emprise

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
      const resp = await fetch("/data/buildings.geojson");
      const raw = await resp.json();

      const filtered = (raw.features || []).filter((f: any) => {
        const p = f.properties || {};
        const name = (p["name:fr"] || p["name:en"] || p.name || "").toLowerCase();
        const op = (p.operator || "").toLowerCase();
        const inside = pointInPolygon(centroidOf(f), CAMPUS_POLYGON);
        const text = name.includes("university of ottawa") || name.includes("uottawa") || op.includes("university of ottawa");
        return inside || text;
      });

      const feats = filtered.map((f: any) => {
        const p = f.properties || {};
        const name = (p["name:fr"] || p["name:en"] || p.name || "").toLowerCase();
        const op = (p.operator || "").toLowerCase();
        const isUO = name.includes("university of ottawa") || name.includes("uottawa") || op.includes("university of ottawa");
        const area = bboxArea(f);
        const areaNorm = Math.min(800, Math.round(area * 1e6));
        return { ...f, properties: { ...p, __pri: (isUO ? 1000 : 0) + areaNorm } };
      });

      const data = { type: "FeatureCollection", features: feats };
      map.addSource("buildings", { type: "geojson", data });

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
        paint: { "line-color": "#3b2f26", "line-width": 1 },
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
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10.5, 15, 13.0, 17, 16.0],
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

      // survol / clic
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
        if (isUCU(f)) { setFloor(0); loadIndoorUCU(0, true); }
        else { hideIndoor(); }
      };
      map.on("click", "b-fill", (e) => clickHandler(e.features?.[0] as BFeature));
      map.on("click", "b-label", (e) => clickHandler(e.features?.[0] as BFeature));

      // source route
      map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#2563eb", "line-width": 5, "line-opacity": 0.85 },
      });
    });

    map.on("click", (e) => {
      if (!pickMode) return;
      const xy: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (pickMode === "start") setStart(xy);
      if (pickMode === "dest")  setDest(xy);
      setPickMode(null);
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  return (
    <main className="w-screen h-screen relative bg-neutral-100">
      {/* Carte */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Sidebar */}
      <Sidebar onSelect={(section) => { if (section === "buildings") toggleBuildingsPanel();
        if (section === "navigate") setShowNavigatePanel((s) => !s); // AJOUT

       }} />

      {/* Panel Buildings */}
      {showBuildingsPanel && (
        <BuildingsPanel
          limit={150}
          onSelect={(f) => {
            const bf = f as BFeature;
            focusFeature(bf);
            if (isUCU(bf)) { setFloor(0); loadIndoorUCU(0, true); } else { hideIndoor(); }
          }}
        />
      )}

      {/* Panel Détails (avec étages intégrés) */}
      <BuildingDetails
        feature={selected}
        floor={floorToCode(floor)}
        onChangeFloor={(lvl) => { setFloor(codeToFloor(lvl)); loadIndoorUCU(codeToFloor(lvl), false); }}
        onClose={() => { setSelected(null); hideIndoor(); }}
      />

      {/* Panel Navigate (AJOUT) */}
      {showNavigatePanel && (
  <div>
    <NavigatePanel
      start={start}
      dest={dest}
      steps={steps}
      onUseMyPosition={() => geolocateRef.current?.trigger()}
      onPickStartOnMap={() => setPickMode("start")}
      onPickDestOnMap={() => setPickMode("dest")}
      onSetStartFromCenter={() => {
        const c = mapInstance.current?.getCenter();
        if (c) setStart([c.lng, c.lat]);
      }}
      onRouteFoot={() => buildRoute("foot")}
      onClearRoute={() => {
        const src = mapInstance.current?.getSource("route") as maplibregl.GeoJSONSource | undefined;
        src?.setData({ type: "FeatureCollection", features: [] } as any);
        setSteps([]);
      }}
      onClose={() => setShowNavigatePanel(false)}
    />
  </div>
)}



      

      
    </main>
  );
}
