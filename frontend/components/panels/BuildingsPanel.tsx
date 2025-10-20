"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ------------------ Campus polygon (same as page.tsx) ------------------ */
const CAMPUS_POLYGON: number[][] = [
  [-75.6938, 45.4279], [-75.6909, 45.4279], [-75.6891, 45.42755],
  [-75.6876, 45.4267], [-75.6865, 45.4254], [-75.6858, 45.4242],
  [-75.6846, 45.4237], [-75.6831, 45.4237], [-75.6817, 45.4227],
  [-75.6816, 45.4218], [-75.6821, 45.4208], [-75.6845, 45.4201],
  [-75.6869, 45.4201], [-75.6902, 45.4203], [-75.6925, 45.4217],
  [-75.6936, 45.4239], [-75.6938, 45.4256], [-75.6938, 45.4279],
];

/* ------------------------------ Geo utils ------------------------------ */
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

function centroidOf(feature: any): [number, number] {
  const coords: number[][] = [];
  (function pushAll(a: any) {
    Array.isArray(a?.[0]) ? a.forEach(pushAll) : coords.push(a as number[]);
  })(feature.geometry.coordinates);
  let sx = 0, sy = 0;
  for (const [x, y] of coords) { sx += x; sy += y; }
  const n = Math.max(coords.length, 1);
  return [sx / n, sy / n];
}

/* ------------------------------ Types ------------------------------ */
export type Feature = {
  id?: string | number;
  properties?: Record<string, any>;
  geometry: any;
};
type FC = { type: "FeatureCollection"; features: Feature[] };

export default function BuildingsPanel({
  onSelect,
  onMoreInfo,      // <-- NEW
  limit = 150,
}: {
  onSelect: (feature: Feature) => void;
  onMoreInfo?: (feature: Feature) => void;  // <-- NEW
  limit?: number;
}) {
  const [raw, setRaw] = useState<FC | null>(null);
  const [query, setQuery] = useState("");
  const [countAll, setCountAll] = useState(0);
  const debounceRef = useRef<number | null>(null);

  /* ---------------------------- Load data ---------------------------- */
  useEffect(() => {
    let cancelled = false;
    fetch("/data/buildings.geojson")
      .then((r) => r.json())
      .then((data: FC) => { if (!cancelled) setRaw(data); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, []);

  /* --------------------- uOttawa filter + index --------------------- */
  const indexed = useMemo(() => {
    if (!raw) return [];

    const onlyUO = (raw.features || []).filter((f: any) => {
      const p = f.properties || {};
      const name = (p["name:fr"] || p["name:en"] || p.name || "").toLowerCase();
      const op   = (p.operator || "").toLowerCase();
      const inside = pointInPolygon(centroidOf(f), CAMPUS_POLYGON);
      const text  = name.includes("university of ottawa") || name.includes("uottawa") || op.includes("university of ottawa");
      return inside || text;
    });

    const seen = new Set<string>();
    const dedup = onlyUO.filter((f) => {
      const p = f.properties || {};
      const name = (p["name:fr"] || p["name:en"] || p.name || "Building").trim();
      const code = (p.code || "").toString().trim();
      const key = `${name}__${code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const norm = (s: string) =>
      (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

    const items = dedup.map((f, idx) => {
      const p = f.properties || {};
      const name = (p["name:fr"] || p["name:en"] || p.name || "Building") as string;
      const code = (p.code || name.slice(0, 3).toUpperCase()) as string;
      const key = norm([name, code, p.operator, p["name:short"], p.alt_name].filter(Boolean).join(" | "));
      return { id: f.id ?? `${idx}-${code}`, name, code, key, f };
    });

    setCountAll(items.length);
    return items;
  }, [raw]);

  /* --------------------------- Fast search --------------------------- */
  const [results, setResults] = useState<typeof indexed>([]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const norm = (s: string) =>
        (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
      const nq = norm(query.trim());
      if (!nq) {
        setResults(indexed.slice(0, limit));
        return;
      }
      const ranked = indexed
        .map((it) => {
          let s = 0;
          if (it.key.startsWith(nq)) s = 100;
          else if (it.key.includes(nq)) s = 60;
          return { it, s };
        })
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map((x) => x.it);
      setResults(ranked);
    }, 150) as unknown as number;

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, indexed, limit]);

  return (
    <aside className="absolute top-4 left-24 z-30 w-[420px] max-h-[84vh] bg-white/95 backdrop-blur-md border border-neutral-200 rounded-3xl shadow-xl overflow-hidden">
      <header className="px-4 py-3 border-b text-sm font-semibold flex items-center justify-between">
        <span>Buildings</span>
        <span className="text-xs text-neutral-500">{countAll}</span>
      </header>

      <div className="p-3 space-y-3 overflow-auto max-h-[74vh]">
        <div className="flex items-center gap-2">
          <input
            className="w-full border rounded-xl px-3 py-2 text-sm"
            placeholder="Search buildings (uOttawa)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="text-xs text-neutral-500 min-w-[56px] text-right">
            {results.length}
          </span>
        </div>

        {raw ? (
          <ul className="space-y-1">
            {results.map(({ id, name, code, f }) => (
              <li key={String(id)}>
                <div className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-neutral-100">
                  <button
                    onClick={() => onSelect(f)}
                    className="flex-1 flex items-center gap-3 text-left"
                    title={name}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-900 text-white text-xs">
                      {String(code).slice(0, 4)}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{name}</div>
                      {code && <div className="text-xs text-neutral-500">{code}</div>}
                    </div>
                  </button>

                  {onMoreInfo && (
                    <button
                      onClick={() => onMoreInfo(f)}
                      className="text-blue-600 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50"
                    >
                      More Info →
                    </button>
                  )}
                </div>
              </li>
            ))}
            {results.length === 0 && (
              <li className="text-sm text-neutral-500 px-1 py-6 text-center">
                No results
              </li>
            )}
          </ul>
        ) : (
          <div className="text-sm text-neutral-500 px-1 py-6">Loading…</div>
        )}
      </div>

      <div className="px-4 py-2 text-[11px] text-neutral-500 border-t">
        Showing up to {limit} matches. Type to narrow down.
      </div>
    </aside>
  );
}
