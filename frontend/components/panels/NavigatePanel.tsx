"use client";

import { useMemo, useState } from "react";

type Coord = [number, number];

type NavStep = {
  instruction: string;
  distance: number;
  hasStairs?: boolean;
  notes?: string[];
};

type IndoorNodeOption = {
  id: string;
  label: string;
  floor: number;
  kind?: string;
  hidden?: boolean;
};

type OutdoorNodeOption = {
  id: string;
  label: string;
  coord: Coord;
};

type Props = {
  start: Coord | null;
  dest: Coord | null;
  steps: NavStep[];

  buildings?: GeoJSON.FeatureCollection | null;

  onUseMyPosition: () => void;
  onPickStartOnMap: () => void;
  onPickDestOnMap: () => void;
  onSetStartFromCenter: () => void;

  onSetStart: (p: Coord) => void;
  onSetDest: (p: Coord) => void;

  onRouteFoot: () => void;
  onRouteWheelchair: () => void;
  onClearRoute: () => void;

  onClose: () => void;

  indoorNodes: IndoorNodeOption[];

  /* 🔥 NOUVEAU → liste filtrée des nœuds OUTDOOR */
  outdoorNodes: OutdoorNodeOption[];

  onIndoorRoute: (fromId: string, toId: string, accessible: boolean) => void;
};

/* ---------------------------------- Utils ---------------------------------- */

function walkCoords(a: any, out: number[][]) {
  if (Array.isArray(a?.[0])) a.forEach((b: any) => walkCoords(b, out));
  else out.push(a as number[]);
}

function centroidOfFeature(f: GeoJSON.Feature): Coord {
  const coords: number[][] = [];
  walkCoords(f.geometry.coordinates as any, coords);
  if (!coords.length) return [0, 0];
  let sx = 0,
    sy = 0;
  for (const [x, y] of coords) {
    sx += x;
    sy += y;
  }
  return [sx / coords.length, sy / coords.length];
}

export default function NavigatePanel(props: Props) {
  const {
    start,
    dest,
    steps,
    onUseMyPosition,
    onPickStartOnMap,
    onPickDestOnMap,
    onSetStartFromCenter,
    onSetStart,
    onSetDest,
    onRouteFoot,
    onRouteWheelchair,
    onClearRoute,
    onClose,

    /* indoor */
    indoorNodes,
    onIndoorRoute,

    /* 🔥 outdoor clean list */
    outdoorNodes,
  } = props;

  const [selectedStartOutdoor, setSelectedStartOutdoor] = useState("");
  const [selectedDestOutdoor, setSelectedDestOutdoor] = useState("");

  const [indoorFromId, setIndoorFromId] = useState("");
  const [indoorToId, setIndoorToId] = useState("");
  const [indoorAccessibleOnly, setIndoorAccessibleOnly] = useState(true);

  const displayedIndoorNodes = useMemo(
    () =>
      indoorNodes.filter(
        (n) =>
          !n.hidden &&
          ["room", "toilet", "elevator"].includes(n.kind || "")
      ),
    [indoorNodes]
  );

  const canRunIndoorRoute =
    indoorFromId.trim().length > 0 && indoorToId.trim().length > 0;

  /* ------------------------------- Render ------------------------------- */

  return (
    <aside
      className="
        pointer-events-auto absolute left-[90px] top-4
        w-[390px] max-h-[90vh]
        bg-white border border-neutral-300 shadow-2xl
        rounded-2xl px-4 py-4 flex flex-col gap-4 overflow-y-auto
      "
    >
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base font-semibold text-neutral-900">
            Navigation
          </div>
          <div className="text-sm text-neutral-600 mt-0.5">
            Choisis tes points A et B pour l’itinéraire.
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg px-3 py-1 text-sm bg-neutral-100 hover:bg-neutral-200 focus:ring-2 focus:ring-blue-600"
        >
          ✕
        </button>
      </div>

      {/* POINT A */}
      <section className="border border-neutral-300 rounded-xl p-4 space-y-3 bg-neutral-50">
        <div className="text-sm font-semibold text-neutral-800">Point A</div>

        <div className="flex flex-wrap gap-2">
         

          <button
            onClick={onPickStartOnMap}
            className=" w-full  rounded-lg px-3 py-2 text-sm disabled:opacity-600 
            bg-amber-300 text-neutral-900 hover:bg-amber-400"
          >
           Choisir ma position sur la carte
          </button>

         
        </div>

        <label className="text-base text-neutral-600">Ma position</label>
        <select
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white mt-1"
          value={selectedStartOutdoor}
          onChange={(e) => {
            setSelectedStartOutdoor(e.target.value);
            const n = outdoorNodes.find((x) => x.id === e.target.value);
            if (n) onSetStart(n.coord);
          }}
        >
          <option value="">Choisir…</option>
          {outdoorNodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>

        <div className="text-base text-neutral-600">
          {start ? `A: ${start[1].toFixed(5)}, ${start[0].toFixed(5)}` : "A vide"}
        </div>
      </section>

      {/* POINT B */}
      <section className="border border-neutral-300 rounded-xl p-4 space-y-3 bg-neutral-50">
        <div className="text-sm font-semibold text-neutral-800">Point B</div>

        <button
          onClick={onPickDestOnMap}
          className=" w-full  rounded-lg px-3 py-2 text-sm disabled:opacity-600 
            bg-amber-300 text-neutral-900 hover:bg-amber-400"

        >
          Choisir ma destination sur la carte
        </button>

        <label className="text-base text-neutral-600 mt-3">Destination</label>
        <select
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white mt-1"
          value={selectedDestOutdoor}
          onChange={(e) => {
            setSelectedDestOutdoor(e.target.value);
            const n = outdoorNodes.find((x) => x.id === e.target.value);
            if (n) onSetDest(n.coord);
          }}
        >
          <option value="">Choisir…</option>
          {outdoorNodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>

        <div className="text-base text-neutral-600">
          {dest ? `B: ${dest[1].toFixed(5)}, ${dest[0].toFixed(5)}` : "B vide"}
        </div>
      </section>

      {/* EXTÉRIEUR */}
      <section className="border border-neutral-300 rounded-xl p-4 space-y-3 bg-neutral-50">
        <div className="text-sm font-semibold text-neutral-800">
          Itinéraire extérieur
        </div>

        <div className="flex gap-2">
         

          <button
            onClick={onRouteWheelchair}
            disabled={!start || !dest}
            className="flex-1 rounded-lg px-3 py-2 text-sm disabled:opacity-600 
            bg-amber-300 text-neutral-900 hover:bg-amber-400
"
          >
            ♿ Naviguer
          </button>

          <button
            onClick={onClearRoute}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            🧹 Clear
          </button>
        </div>
      </section>

      {/* INTÉRIEUR */}
      {displayedIndoorNodes.length > 0 && (
        <section className="border border-neutral-300 rounded-xl p-4 space-y-3 bg-neutral-50">
          <div className="text-sm font-semibold text-neutral-800">
            Itinéraire intérieur (UCU)
          </div>

          <label className="text-xs">Départ</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={indoorFromId}
            onChange={(e) => setIndoorFromId(e.target.value)}
          >
            <option value="">Choisir…</option>
            {displayedIndoorNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label} — F{n.floor}
              </option>
            ))}
          </select>

          <label className="text-xs mt-2">Arrivée</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={indoorToId}
            onChange={(e) => setIndoorToId(e.target.value)}
          >
            <option value="">Choisir…</option>
            {displayedIndoorNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label} — F{n.floor}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs text-neutral-700 mt-2">
            <input
              type="checkbox"
              checked={indoorAccessibleOnly}
              onChange={(e) => setIndoorAccessibleOnly(e.target.checked)}
            />
            Éviter les escaliers
          </label>

          <button
            disabled={!canRunIndoorRoute}
            onClick={() =>
              onIndoorRoute(indoorFromId, indoorToId, indoorAccessibleOnly)
            }
            className=" w-full  rounded-lg px-3 py-2 text-sm disabled:opacity-600 
            bg-amber-300 text-neutral-900 hover:bg-amber-400"
          >
            ♿ Naviguer
          </button>

          
        </section>
      )}
    </aside>
  );
}
