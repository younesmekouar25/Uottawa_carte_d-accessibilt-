"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map, StyleSpecification } from "maplibre-gl";
import Sidebar from "@/components/Sidebar";
import BuildingsPanel from "@/components/panels/BuildingsPanel";
import BuildingDetails from "@/components/panels/BuildingDetails";

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
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
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

/* --------------------------------- Types --------------------------------- */
type BFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, any>;

/* --------------------------------- Page ---------------------------------- */
export default function Home() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // === panneaux
  const [selected, setSelected] = useState<BFeature | null>(null);
  const [showBuildingsPanel, setShowBuildingsPanel] = useState(false);
  const toggleBuildingsPanel = () => setShowBuildingsPanel((s) => !s);

  // === géoloc + routage
  const geolocateRef = useRef<maplibregl.GeolocateControl | null>(null);
  const [start, setStart] = useState<[number, number] | null>(null); // A
  const [dest, setDest]   = useState<[number, number] | null>(null); // B
  const [steps, setSteps] = useState<Array<{ instruction: string; distance: number }>>([]);
  const [pickMode, setPickMode] = useState<null | "start" | "dest">(null);

  // zoom/centrage + popup + sélection (+ AJOUT: B = bâtiment)
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

    // destination = centroïde du bâtiment
    setDest(centroidOf(f));
  };

  // construire route (OSRM public)
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

    // trace
    const gj = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { distance: route.distance, duration: route.duration },
        geometry: route.geometry,
      }],
    };
    (mapInstance.current.getSource("route") as maplibregl.GeoJSONSource).setData(gj);

    // steps
    const out: Array<{ instruction: string; distance: number }> = [];
    for (const leg of route.legs || []) {
      for (const s of leg.steps || []) {
        const inst = s.maneuver?.instruction || s.name || "Continue";
        out.push({ instruction: inst, distance: s.distance });
      }
    }
    setSteps(out);

    // fit sur la route
    const coords: [number, number][] = route.geometry.coordinates;
    let minX =  999, minY =  999, maxX = -999, maxY = -999;
    for (const [x, y] of coords) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    mapInstance.current.fitBounds([[minX, minY], [maxX, maxY]], { padding: 80, duration: 500 });
  }

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

    // contrôle géoloc
    geolocateRef.current = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
      fitBoundsOptions: { maxZoom: 17 },
    });
    map.addControl(geolocateRef.current, "top-right");

    // si tu veux mettre A automatiquement quand la géoloc se fixe :
    geolocateRef.current.on("geolocate", (e) => {
      const { longitude, latitude } = e.coords as any;
      setStart([longitude, latitude]);
    });

    map.on("load", async () => {
      const resp = await fetch("/data/buildings.geojson");
      const raw = await resp.json();

      // 1) buildings uOttawa
      const filtered = (raw.features || []).filter((f: any) => {
        const p = f.properties || {};
        const name = (p["name:fr"] || p["name:en"] || p.name || "").toLowerCase();
        const op = (p.operator || "").toLowerCase();
        const inside = pointInPolygon(centroidOf(f), CAMPUS_POLYGON);
        const text = name.includes("university of ottawa") || name.includes("uottawa") || op.includes("university of ottawa");
        return inside || text;
      });

      // 2) priorité labels
      const feats = filtered.map((f: any) => {
        const p = f.properties || {};
        const name = (p["name:fr"] || p["name:en"] || p.name || "").toLowerCase();
        const op = (p.operator || "").toLowerCase();
        const isUO = name.includes("university of ottawa") || name.includes("uottawa") || op.includes("university of ottawa");
        const area = bboxArea(f);
        const areaNorm = Math.min(800, Math.round(area * 1e6));
        return {
          ...f,
          properties: {
            ...p,
            __pri: (isUO ? 1000 : 0) + areaNorm,
          },
        };
      });

      const data = { type: "FeatureCollection", features: feats };

      // buildings layers
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
          "text-size": [
            "interpolate", ["linear"], ["zoom"],
            13, 10.5,
            15, 13.0,
            17, 16.0
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

      map.on("click", "b-fill", (e) => {
        const f = e.features?.[0] as BFeature | undefined;
        if (f) focusFeature(f);
      });
      map.on("click", "b-label", (e) => {
        const f = e.features?.[0] as BFeature | undefined;
        if (f) focusFeature(f);
      });

      // ── source + layer route
      map.addSource("route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
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

    // click libre pour choisir A/B
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

      {/* Sidebar : re-cliquer “Buildings” ferme/ouvre le panneau */}
      <Sidebar
        onSelect={(section) => {
          if (section === "buildings") toggleBuildingsPanel();
        }}
      />

      {/* Panneau "Buildings" (ouvert/fermé via toggle) */}
      {showBuildingsPanel && (
        <BuildingsPanel
          limit={150}
          onSelect={(f) => focusFeature(f as BFeature)}
          // onMoreInfo={(f) => focusFeature(f as BFeature)}
        />
      )}

      {/* Panneau “Building Details” (même page) */}
      <BuildingDetails feature={selected} onClose={() => setSelected(null)} />

      {/* ── Panneau Itinéraire ── */}
      <div className="absolute z-30 bottom-6 right-6 w-[320px] bg-white/95 border border-black/10 shadow-lg rounded-2xl p-3 space-y-2">
        <div className="text-sm font-semibold mb-1">Itinéraire</div>

        <div className="flex gap-2">
          <button
            className="flex-1 border rounded-lg px-3 py-2 text-sm hover:bg-black/5"
            onClick={() => geolocateRef.current?.trigger()}
            title="Utiliser ma position (point bleu)"
          >
            📍 Ma position
          </button>
          <button
            className={`flex-1 border rounded-lg px-3 py-2 text-sm hover:bg-black/5 ${pickMode==='start' ? 'bg-black/5' : ''}`}
            onClick={() => setPickMode(pickMode === "start" ? null : "start")}
            title="Cliquer sur la carte pour définir le départ"
          >
            A sur la carte
          </button>
          <button
            className={`flex-1 border rounded-lg px-3 py-2 text-sm hover:bg-black/5 ${pickMode==='dest' ? 'bg-black/5' : ''}`}
            onClick={() => setPickMode(pickMode === "dest" ? null : "dest")}
            title="Cliquer sur la carte pour définir l’arrivée"
          >
            B sur la carte
          </button>
        </div>

        <div className="text-xs text-black/70">
          {start ? <>A: {start[1].toFixed(5)}, {start[0].toFixed(5)}</> : "A: non défini"}
          <br/>
          {dest ?  <>B: {dest[1].toFixed(5)}, {dest[0].toFixed(5)}</>  : "B: non défini"}
        </div>

        <div className="flex gap-2">
          <button
            className="flex-1 border rounded-lg px-3 py-2 text-sm hover:bg-black/5"
            onClick={() => buildRoute("foot")}
            disabled={!start || !dest}
            title="Calculer un itinéraire piéton"
          >
            🚶‍♂️ Marche
          </button>
          <button
            className="border rounded-lg px-3 py-2 text-sm hover:bg-black/5"
            onClick={() => {
              const c = mapInstance.current?.getCenter();
              if (c) setStart([c.lng, c.lat]);
            }}
            title="Définir A = centre de la carte"
          >
            ⊙ A = centre
          </button>
        </div>

        {steps && steps.length > 0 && (
          <div className="mt-2 max-h-40 overflow-auto border-t pt-2">
            <div className="text-xs font-medium mb-1">Étapes</div>
            <ol className="space-y-1 text-xs">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-black/50">{i + 1}.</span>
                  <span className="flex-1">{s.instruction}</span>
                  <span className="text-black/50 whitespace-nowrap">{Math.round(s.distance)} m</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </main>
  );
}
