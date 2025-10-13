"use client";

import { useEffect, useMemo, useState } from "react";

type Feature = {
  id?: string | number;
  properties?: Record<string, any>;
  geometry: any;
};
type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

export default function BuildingsPanel({
  onSelect,
}: {
  onSelect: (feature: Feature) => void;
}) {
  const [fc, setFc] = useState<FeatureCollection | null>(null);
  const [query, setQuery] = useState("");

  // Charger les bâtiments depuis /public/data/buildings.geojson
  useEffect(() => {
    let cancelled = false;
    fetch("/data/buildings.geojson")
      .then((r) => r.json())
      .then((data: FeatureCollection) => {
        if (!cancelled) setFc(data);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  // Normaliser + filtrer + trier
  const items = useMemo(() => {
    const feats = fc?.features ?? [];
    const q = query.trim().toLowerCase();
    return feats
      .map((f) => {
        const name = (f.properties?.name as string) ?? "Building";
        const code =
          (f.properties?.code as string) ??
          name.slice(0, 3).toUpperCase();
        const id = (f.id as string) ?? code;
        return { id, name, code, f };
      })
      .filter(({ name, code }) =>
        q ? name.toLowerCase().includes(q) || code.toLowerCase().includes(q) : true
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fc, query]);

  return (
    <aside className="absolute top-4 left-24 z-30 w-[360px] max-h-[84vh] bg-white/95 backdrop-blur-md border border-neutral-200 rounded-3xl shadow-xl overflow-hidden">
      <header className="px-4 py-3 border-b text-sm font-semibold">
        Buildings
      </header>

      <div className="p-3 space-y-3 overflow-auto max-h-[74vh]">
        <div className="flex items-center gap-2">
          <input
            className="w-full border rounded-xl px-3 py-2 text-sm"
            placeholder="Search buildings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="text-xs text-neutral-500 min-w-[50px] text-right">
            {items.length}
          </span>
        </div>

        {fc ? (
          <ul className="space-y-1">
            {items.map(({ id, name, code, f }) => (
              <li key={String(id)}>
                <button
                  onClick={() => onSelect(f)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-neutral-100 text-left"
                >
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-900 text-white text-xs">
                    {code}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{name}</div>
                    {code && (
                      <div className="text-xs text-neutral-500">{code}</div>
                    )}
                  </div>
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-sm text-neutral-500 px-1 py-6 text-center">
                No results
              </li>
            )}
          </ul>
        ) : (
          <div className="text-sm text-neutral-500 px-1 py-6">Loading…</div>
        )}
      </div>
    </aside>
  );
}
