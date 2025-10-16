"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map, StyleSpecification } from "maplibre-gl";
import Sidebar from "@/components/Sidebar";

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

/* ---------------------------- Utils géométriques ---------------------------- */

function pointInRing([x, y]: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
const pointInPolygon = (pt: [number, number], outer: number[][]) => pointInRing(pt, outer);

function bboxOf(feature: any): [[number, number], [number, number]] {
  const pts: number[][] = [];
  const walk = (a: any) => (Array.isArray(a?.[0]) ? a.forEach(walk) : pts.push(a as number[]));
  walk(feature.geometry.coordinates);
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
  return [[minX, minY], [maxX, maxY]];
}
function centroidOf(feature: any): [number, number] {
  const coords: number[][] = [];
  const pushAll = (a: any) => (Array.isArray(a?.[0]) ? a.forEach(pushAll) : coords.push(a as number[]));
  pushAll(feature.geometry.coordinates);
  let sx = 0,
    sy = 0;
  for (const [x, y] of coords) {
    sx += x;
    sy += y;
  }
  const n = Math.max(coords.length, 1);
  return [sx / n, sy / n];
}

/* ----------------------- Normalisation des coordonnées ---------------------- */

function needsSwap(geojson: any): boolean {
  const samples: [number, number][] = [];
  const pushPairs = (a: any) => {
    if (samples.length > 200) return;
    if (typeof a?.[0] === "number" && typeof a?.[1] === "number") samples.push([a[0], a[1]]);
    else if (Array.isArray(a)) a.forEach(pushPairs);
  };
  for (const f of geojson.features ?? []) pushPairs(f.geometry?.coordinates);
  if (samples.length === 0) return false;

  let looksSwapped = 0;
  for (const [a, b] of samples) {
    const lonOk = a < -60 && a > -100;
    const latOk = b > 40 && b < 50;
    if (!(lonOk && latOk)) {
      const lon2Ok = b < -60 && b > -100;
      const lat2Ok = a > 40 && a < 50;
      if (lon2Ok && lat2Ok) looksSwapped++;
    }
  }
  return looksSwapped > samples.length * 0.5;
}
const swapAll = (coords: any): any =>
  typeof coords?.[0] === "number" && typeof coords?.[1] === "number"
    ? [coords[1], coords[0]]
    : Array.isArray(coords)
    ? coords.map(swapAll)
    : coords;

function normalizeLonLat(geojson: any): any {
  const clone = JSON.parse(JSON.stringify(geojson));
  if (needsSwap(clone)) {
    for (const f of clone.features ?? []) f.geometry.coordinates = swapAll(f.geometry.coordinates);
    console.info("✅ Coordonnées inversées détectées : correction appliquée.");
  }
  return clone;
}

/* --------------------------------- Composant -------------------------------- */

type BFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, any>;

export default function Home() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);
  const hoverReq = useRef<number | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // === ÉTATS RECHERCHE ===
  const [buildings, setBuildings] = useState<BFeature[]>([]);
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<BFeature[]>([]);

  // === FILTRE POI ===
  const [poiFilter, setPoiFilter] = useState<"all" | "elevator" | "ramp" | "toilet">("all");

  // helpers recherche
  const norm = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const labelOf = (p: any) => p?.["name:fr"] ?? p?.["name:en"] ?? p?.name ?? "";

  const score = (item: BFeature, nq: string) => {
    const p = item.properties || {};
    const hay = norm(
      [labelOf(p), p.alt_name, p["name:short"], p.operator, p.code].filter(Boolean).join(" | ")
    );
    if (!nq) return 0;
    if (hay.startsWith(nq)) return 100; // boost début de chaîne
    if (hay.includes(nq)) return 60;
    return 0;
  };

  const runSearch = (text: string) => {
    const nq = norm(text.trim());
    if (!nq) {
      setSuggestions([]);
      return;
    }
    const ranked = buildings
      .map((f) => ({ f, s: score(f, nq) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.f);
    setSuggestions(ranked);
  };

  const zoomTo = (f: BFeature) => {
    const map = mapInstance.current;
    if (!map) return;
    const p = f.properties || {};
    const name = labelOf(p) || "Bâtiment";
    popupRef.current?.remove();
    map.fitBounds(bboxOf(f), { padding: 80, duration: 480 });
    const c = centroidOf(f);
    popupRef.current = new maplibregl.Popup({ closeButton: true }).setLngLat(c).setHTML(`<strong>${name}</strong>`).addTo(map);
    setSuggestions([]);
  };

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

    map.on("load", async () => {
      // 1) charge GeoJSON + normalise
      const bResp = await fetch("/data/buildings.geojson");
      const raw = await bResp.json();
      const normed = normalizeLonLat(raw);

      // 2) filtre uOttawa
      const filtered: GeoJSON.FeatureCollection = {
        ...normed,
        features: (normed.features || []).filter((f: any) => {
          const p = f.properties || {};
          const name = (p["name:fr"] || p["name:en"] || p.name || "").toLowerCase();
          const op = (p.operator || "").toLowerCase();
          const inside = pointInPolygon(centroidOf(f), CAMPUS_POLYGON);
          const textMatch =
            name.includes("university of ottawa") ||
            name.includes("uottawa") ||
            op.includes("university of ottawa");
          return inside || textMatch;
        }),
      };

      const sourceData =
        (filtered.features?.length ?? 0) > 0 ? filtered : normed; // fallback diag

      // garde une copie pour la recherche
      setBuildings(sourceData.features as BFeature[]);

      // 3) sources
      map.addSource("buildings", { type: "geojson", data: sourceData, promoteId: "id" });
      map.addSource("pois", { type: "geojson", data: "/data/pois.geojson" });

      // 4) couches
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
      const nameExpr: any = [
        "coalesce",
        ["get", "name:fr"],
        ["get", "name:en"],
        ["get", "name"],
        ["concat", "Bldg ", ["to-string", ["id"]]],
      ];
      map.addLayer({
        id: "b-label",
        type: "symbol",
        source: "buildings",
        minzoom: 15.1,
        layout: {
          "text-field": nameExpr,
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 15, 11, 17, 13.5, 18.5, 16],
          "text-variable-anchor": ["center", "top", "bottom", "left", "right"],
          "text-padding": 2,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#111",
          "text-halo-color": "rgba(255,255,255,0.94)",
          "text-halo-width": 1.4,
        },
      });

      // survol
      map.addLayer({
        id: "b-hover",
        type: "line",
        source: "buildings",
        paint: { "line-color": "#111", "line-width": 3 },
        filter: ["==", ["id"], ""],
      });
      map.on("mousemove", "b-fill", (e) => {
        if (hoverReq.current) cancelAnimationFrame(hoverReq.current);
        hoverReq.current = requestAnimationFrame(() => {
          const id = e.features?.[0]?.id ?? "";
          map.setFilter("b-hover", ["==", ["id"], id]);
          map.getCanvas().style.cursor = "pointer";
        });
      });
      map.on("mouseleave", "b-fill", () => {
        if (hoverReq.current) cancelAnimationFrame(hoverReq.current);
        map.setFilter("b-hover", ["==", ["id"], ""]);
        map.getCanvas().style.cursor = "";
      });

      // POI
      map.addLayer({
        id: "poi-circle",
        type: "circle",
        source: "pois",
        paint: {
          "circle-color": [
            "match",
            ["get", "type"],
            "elevator",
            "#1e90ff",
            "ramp",
            "#16a34a",
            "toilet",
            "#9333ea",
            /* else */ "#111827",
          ],
          "circle-radius": 6,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });

      // popups
      popupRef.current = new maplibregl.Popup({ closeButton: true, closeOnClick: true });
      map.on("click", "b-fill", (e) => {
        const f = e.features?.[0] as BFeature | undefined;
        if (!f) return;
        zoomTo(f);
      });
      map.on("click", "poi-circle", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as any;
        popupRef.current!
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:13px/1.3 system-ui">
              <strong>${p.name || p.type}</strong><br/>
              <small>Type: ${p.type} • Bldg: ${p.building ?? "-"} • Floor: ${p.floor ?? "-"}</small>
            </div>`
          )
          .addTo(map);
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");
    });

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && popupRef.current?.remove();
    window.addEventListener("keydown", onKey);
    map.fitBounds(CAMPUS_BOUNDS, { padding: 40, duration: 0 });

    return () => {
      window.removeEventListener("keydown", onKey);
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Filtres POI
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !map.getLayer("poi-circle")) return;
    map.setFilter("poi-circle", poiFilter === "all" ? true : ["==", ["get", "type"], poiFilter]);
  }, [poiFilter]);

  // Recherche : mise à jour suggestions
  useEffect(() => {
    runSearch(q);
  }, [q, buildings]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions[0]) zoomTo(suggestions[0]);
  };

  return (
    <main className="w-screen h-screen relative bg-neutral-100">
      {/* Carte */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Barre de recherche */}
      <form
        onSubmit={submitSearch}
        className="absolute top-5 left-[120px] right-10 z-30 flex items-start"
        autoComplete="off"
      >
        <div className="relative w-full max-w-2xl">
          <div className="flex items-center gap-3 bg-white/95 backdrop-blur-xl border border-black/10 shadow-[0_8px_24px_rgba(0,0,0,.12)] px-5 py-2 rounded-[28px]">
            <span aria-hidden className="text-blue-600 text-lg">🔎</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un bâtiment, une salle, un accès…"
              className="w-full bg-transparent outline-none text-sm"
            />
            <button
              type="submit"
              className="rounded-full border border-black/15 hover:bg-black/5 px-4 py-1 text-sm font-medium"
            >
              Rechercher
            </button>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <ul className="absolute mt-2 w-full max-w-2xl bg-white rounded-xl border border-black/10 shadow-lg overflow-hidden">
              {suggestions.map((f, i) => {
                const p: any = f.properties || {};
                const name = labelOf(p) || `Bâtiment ${i + 1}`;
                const sub =
                  [p.code, p.operator === "University of Ottawa" ? "uOttawa" : ""]
                    .filter(Boolean)
                    .join(" • ") || null;
                return (
                  <li
                    key={i}
                    className="px-4 py-2 text-sm hover:bg-black/5 cursor-pointer"
                    onClick={() => zoomTo(f)}
                  >
                    <div className="font-medium">{name}</div>
                    {sub && <div className="text-xs text-black/60">{sub}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="ml-3 rounded-full border border-black/15 hover:bg-black/5 px-4 py-2 text-sm font-medium bg-white/95"
        >
          Filtres
        </button>
      </form>

      {/* Filtres POI */}
      <div className="absolute top-[86px] left-[120px] z-30 flex gap-2">
        {[
          { key: "all", label: "Tous" },
          { key: "elevator", label: "Ascenseurs" },
          { key: "ramp", label: "Rampes" },
          { key: "toilet", label: "Toilettes" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPoiFilter(key as any)}
            className={`rounded-full border px-3 py-1 text-sm bg-white/95 shadow ${
              poiFilter === key ? "border-black/40" : "border-black/15 hover:bg-black/5"
            }`}
            aria-pressed={poiFilter === key}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sidebar */}
      <Sidebar onSelect={(id) => console.log("clicked:", id)} />
    </main>
  );
}
