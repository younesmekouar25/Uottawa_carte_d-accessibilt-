"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string | number;
  title: string;
  subtitle?: string;
  code?: string;
  center: [number, number]; // [lng, lat]
  thumb?: string | null;
};

type Props = {
  open: boolean;
  mode: "start" | "end";                   // pour l’entête "Add Start / End Point"
  onClose: () => void;
  onPick: (pt: [number, number], meta?: Item) => void;
};

/** Renvoie le centroïde très simple de polygone/multipolygone */
function centroidOfGeo(f: any): [number, number] {
  const coords: number[][] = [];
  const walk = (a: any) => (Array.isArray(a?.[0]) ? a.forEach(walk) : coords.push(a));
  walk(f.geometry.coordinates);
  let sx = 0, sy = 0;
  for (const [x, y] of coords) { sx += x; sy += y; }
  const n = Math.max(coords.length, 1);
  return [sx / n, sy / n];
}

export default function PointPickerSheet({ open, mode, onClose, onPick }: Props) {
  const [raw, setRaw] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"buildings" | "categories">("buildings");

  // Charge les bâtiments depuis le même fichier déjà utilisé par la carte
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    (async () => {
      try {
        const resp = await fetch("/data/buildings.geojson");
        if (!resp.ok) return;
        const gj = await resp.json();
        if (!ignore) setRaw(gj);
      } catch {}
    })();
    return () => { ignore = true; };
  }, [open]);

  const items: Item[] = useMemo(() => {
    if (!raw?.features) return [];
    const out: Item[] = [];
    for (const f of raw.features) {
      const p = f.properties || {};
      const title = p["name:en"] || p["name:fr"] || p.name || p.code || "Building";
      const subtitle = p.code || p.operator || "";
      out.push({
        id: f.id ?? title,
        title,
        subtitle,
        code: p.code,
        center: centroidOfGeo(f),
        // si tu as des miniatures un jour, mappe ici; pour l’instant on met null
        thumb: null,
      });
    }
    // tri léger : d’abord ceux qui mentionnent uOttawa
    out.sort((a, b) => {
      const auo = /ottawa|uottawa/i.test(a.title) || /ottawa/i.test(a.subtitle || "");
      const buo = /ottawa|uottawa/i.test(b.title) || /ottawa/i.test(b.subtitle || "");
      if (auo !== buo) return auo ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
    return out;
  }, [raw]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items.slice(0, 300);
    const qq = q.trim().toLowerCase();
    return items.filter(it =>
      it.title.toLowerCase().includes(qq) ||
      (it.subtitle || "").toLowerCase().includes(qq) ||
      (it.code || "").toLowerCase().includes(qq)
    ).slice(0, 300);
  }, [items, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* overlay clic-outside */}
      <div
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={onClose}
        aria-hidden
      />

      {/* sheet */}
      <div
        className="
          pointer-events-auto absolute left-1/2 top-6 -translate-x-1/2
          w-[min(780px,95vw)] max-h-[88vh]
          bg-white rounded-2xl shadow-2xl border border-black/10
          flex flex-col
        "
        role="dialog"
        aria-modal="true"
      >
        {/* header */}
        <div className="h-14 flex items-center justify-between px-4 border-b">
          <div className="font-semibold">
            {mode === "start" ? "Add Start Point" : "Add End Point"}
          </div>
          <button
            className="rounded-lg px-3 py-1 text-sm hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* barre de recherche + onglets */}
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Map…"
              className="
                w-full h-11 pl-10 pr-3 rounded-xl border bg-white outline-none
                placeholder:text-neutral-400
                focus:ring-2 focus:ring-black/10
              "
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">🔎</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setTab("buildings")}
              className={`h-10 px-3 rounded-xl border ${tab==="buildings" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-100"}`}
            >
              🏢 Buildings
            </button>
            <button
              onClick={() => setTab("categories")}
              className={`h-10 px-3 rounded-xl border ${tab==="categories" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-100"}`}
            >
              🧭 Categories
            </button>
          </div>
        </div>

        {/* contenu listable */}
        <div className="flex-1 overflow-auto">
          {tab === "categories" ? (
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {["Food", "Residence", "Library", "Sports", "Toilets", "Accessibility"].map(c => (
                <div key={c} className="h-24 rounded-xl border flex items-center justify-center text-sm text-neutral-700 bg-white hover:bg-neutral-50">
                  {c}
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((it) => (
                <li key={it.id}>
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-neutral-50 flex items-center gap-3"
                    onClick={() => onPick(it.center, it)}
                  >
                    {/* thumb ou badge code */}
                    {it.thumb ? (
                      <img
                        src={it.thumb}
                        alt=""
                        className="w-12 h-12 rounded-md object-cover border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md border bg-neutral-100 flex items-center justify-center text-xs font-semibold">
                        {it.code?.slice(0,3) || "BLD"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate">{it.title}</div>
                      <div className="text-xs text-neutral-500 truncate">{it.subtitle}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
