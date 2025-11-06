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

/* ---------------------------- Utils géométriques ---------------------------- */
function walkCoords(a: any, out: number[][]) {
  Array.isArray(a?.[0]) ? a.forEach((b: any) => walkCoords(b, out)) : out.push(a as number[]);
}
function bboxOf(feature: any): [[number, number], [number, number]] {
  const pts: number[][] = [];
  walkCoords(feature.geometry.coordinates, pts);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  return [[minX, minY], [maxX, maxY]];
}
function centroidOf(feature: any): [number, number] {
  const pts: number[][] = [];
  walkCoords(feature.geometry.coordinates, pts);
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  const n = Math.max(pts.length, 1);
  return [sx / n, sy / n];
}

/* ----------------------------- Utils attributs ----------------------------- */
function slugify(s: string): string {
  return s
    .normalize?.("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function getBuildingName(p: any): string {
  return (
    p?.["name:fr"] ||
    p?.["name:en"] ||
    p?.name ||
    p?.short_name ||
    p?.code ||
    p?.ref ||
    ""
  );
}

function candidateIds(p: any): string[] {
  const raw = [
    p?.short_name,          // "UCU"  ✅ présent dans ton exemple
    p?.ref,
    p?.code,
    p?.["name:en"],
    p?.["name:fr"],
    p?.name,                // "Jock Turcot University Centre"
  ].filter(Boolean) as string[];

  const uniq = new Set<string>();
  for (const r of raw) {
    const s = String(r);
    uniq.add(slugify(s));            // ex: "ucu", "jock_turcot_university_centre"
    // variantes utiles : garder tel quel en minuscule (si tu veux déposer le fichier sans slug)
    uniq.add(s.toLowerCase());
  }
  return Array.from(uniq);
}

/* --------------------------------- Types --------------------------------- */
type BFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, any>;

/* --------------------------------- Page ---------------------------------- */
export default function Home() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);

  const [selected, setSelected] = useState<BFeature | null>(null);
  const [showBuildingsPanel, setShowBuildingsPanel] = useState(false);
  const [isInsideView, setIsInsideView] = useState(false);

  const toggleBuildingsPanel = () => setShowBuildingsPanel((s) => !s);

  /* --------------------------- Vue intérieure --------------------------- */
  async function tryLoadFloor0For(feature: BFeature): Promise<boolean> {
    const map = mapInstance.current!;
    const p = feature.properties || {};
    const ids = candidateIds(p);

    // chemins candidats, du plus structuré au plus simple
    const paths = [];
    for (const id of ids) {
      paths.push(`/data/floors/${id}_floor0.geojson`);
      paths.push(`/data/${id}_floor0.geojson`);
    }

    // Essaye dans l'ordre jusqu'à trouver un fichier valide (HTTP 200)
    let foundUrl: string | null = null;
    for (const url of paths) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) {
          foundUrl = url;
          const gj = await r.json();

          if (!map.getSource("floor0")) {
            map.addSource("floor0", { type: "geojson", data: gj });
          } else {
            (map.getSource("floor0") as maplibregl.GeoJSONSource).setData(gj);
          }

          if (!map.getLayer("floor0-fill")) {
            map.addLayer({
              id: "floor0-fill",
              type: "fill",
              source: "floor0",
              paint: {
                "fill-color": "#2b83ba",
                "fill-opacity": 0.6,
              },
            });
          }
          if (!map.getLayer("floor0-outline")) {
            map.addLayer({
              id: "floor0-outline",
              type: "line",
              source: "floor0",
              paint: {
                "line-color": "#084081",
                "line-width": 2,
              },
            });
          }

         map.setPaintProperty("b-fill", "fill-opacity", 0.15);

          setIsInsideView(true);
          console.info("✅ floor0 chargé :", foundUrl);
          return true;
        }
      } catch {
        // ignore et teste le chemin suivant
      }
    }

    console.info("ℹ️ Aucun floor0 trouvé pour", ids, "(chemins testés: ", paths, ")");
    return false;
    const bounds = maplibregl.LngLatBounds.convert(bboxOf(feature));
map.fitBounds(bounds, { padding: 50, duration: 600 });

  }

  function removeFloorLayers(map: Map) {
    if (map.getLayer("floor0-fill")) map.removeLayer("floor0-fill");
    if (map.getLayer("floor0-outline")) map.removeLayer("floor0-outline");
    if (map.getSource("floor0")) map.removeSource("floor0");
  }

  function safeSetVisibility(map: Map, layerId: string, vis: "none" | "visible") {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", vis);
  }

  function exitInteriorView() {
    const map = mapInstance.current;
    if (!map || !isInsideView) return;

    removeFloorLayers(map);
    safeSetVisibility(map, "b-fill", "visible");
    safeSetVisibility(map, "b-outline", "visible");
    safeSetVisibility(map, "b-label", "visible");
    setIsInsideView(false);
    setSelected(null);
  }

  /* --------------------------- Focus sur bâtiment --------------------------- */
  async function focusFeature(f: BFeature) {
    const map = mapInstance.current;
    if (!map) return;

    setSelected(f);
    const bounds = bboxOf(f);
    map.fitBounds(bounds, { padding: 64, duration: 600 });

    // Essaye d’ouvrir une vue intérieure si un floor0 existe
    const ok = await tryLoadFloor0For(f);
    if (!ok) {
      // si pas de floor0, on reste en vue extérieure
      exitInteriorView();
    }
  }

  /* --------------------------- Initialisation carte --------------------------- */
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
    });
    mapInstance.current = map;

    map.on("load", async () => {
      // Charge TES bâtiments (assure-toi d’avoir /public/data/buildings.geojson)
      const resp = await fetch("/data/buildings.geojson", { cache: "no-store" });
      const buildings = await resp.json();

      map.addSource("buildings", { type: "geojson", data: buildings });

      map.addLayer({
        id: "b-fill",
        type: "fill",
        source: "buildings",
        paint: { "fill-color": "#b89a6d", "fill-opacity": 0.6 },
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
        ["get", "short_name"], // ex: "UCU"
      ];

      map.addLayer({
        id: "b-label",
        type: "symbol",
        source: "buildings",
        minzoom: 13,
        layout: {
          "text-field": labelExpr,
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#222",
          "text-halo-color": "rgba(255,255,255,0.9)",
          "text-halo-width": 1.2,
        },
      });

      // Curseur "pointer" sur les bâtiments
      map.on("mousemove", "b-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "b-fill", () => (map.getCanvas().style.cursor = ""));

      // Clic sur bâtiment → zoom + essai vue intérieure (floor0)
      map.on("click", "b-fill", (e) => {
        const f = e.features?.[0] as BFeature | undefined;
        if (f) focusFeature(f);
      });

      // Clic hors bâtiment & hors floor0 → quitter vue intérieure
      map.on("click", (e) => {
  const layersToCheck = ["b-fill"];
  if (map.getLayer("floor0-fill")) layersToCheck.push("floor0-fill");

  const feats = map.queryRenderedFeatures(e.point, { layers: layersToCheck });
  if (feats.length === 0) exitInteriorView();
});

    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  return (
    <main className="w-screen h-screen relative bg-neutral-100">
      <div ref={mapRef} className="w-full h-full" />
      <Sidebar onSelect={() => setShowBuildingsPanel((s) => !s)} />
      {showBuildingsPanel && (
        <BuildingsPanel onSelect={(f) => focusFeature(f as BFeature)} />
      )}
      <BuildingDetails feature={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
