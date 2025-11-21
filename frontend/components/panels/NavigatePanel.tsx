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
  onRouteWheelchair: () => void;   // 🔥 AJOUT POUR PMR
  onClearRoute: () => void;

  onClose: () => void;

  indoorNodes: IndoorNodeOption[];
  onIndoorRoute: (fromId: string, toId: string, accessible: boolean) => void;
};

/* Helper centroid */
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

function buildingLabel(f: GeoJSON.Feature): string {
  const p: any = f.properties || {};
  const code = p.code;
  const fr = p["name:fr"];
  const en = p["name:en"];
  const name = fr || en || p.name;
  if (code && name) return `${code} — ${name}`;
  return code || name || "Bâtiment sans nom";
}

export default function NavigatePanel(props: Props) {
  const {
    start,
    dest,
    steps,
    buildings,
    onUseMyPosition,
    onPickStartOnMap,
    onPickDestOnMap,
    onSetStartFromCenter,
    onSetStart,
    onSetDest,
    onRouteFoot,
    onRouteWheelchair,         // 🔥 AJOUT PMR
    onClearRoute,
    onClose,
    indoorNodes,
    onIndoorRoute,
  } = props;

  const [selectedStartId, setSelectedStartId] = useState("");
  const [selectedDestId, setSelectedDestId] = useState("");
  const [accessibleViewOnly, setAccessibleViewOnly] = useState(false);
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

  const buildingsList = useMemo(
    () =>
      (buildings?.features || []).map((f, idx) => ({
        id: (f.id ?? idx).toString(),
        feature: f,
        label: buildingLabel(f),
      })),
    [buildings]
  );

  const handleStartBuildingChange = (id: string) => {
    setSelectedStartId(id);
    const row = buildingsList.find((b) => b.id === id);
    if (!row) return;
    onSetStart(centroidOfFeature(row.feature));
  };

  const handleDestBuildingChange = (id: string) => {
    setSelectedDestId(id);
    const row = buildingsList.find((b) => b.id === id);
    if (!row) return;
    onSetDest(centroidOfFeature(row.feature));
  };

  const stairsCount = useMemo(
    () => steps.filter((s) => s.hasStairs).length,
    [steps]
  );

  const displayedSteps = useMemo(
    () =>
      accessibleViewOnly
        ? steps.filter((s) => !s.hasStairs)
        : steps,
    [steps, accessibleViewOnly]
  );

  const canRunIndoorRoute =
    indoorFromId.trim().length > 0 && indoorToId.trim().length > 0;

  return (
    <aside
      className="
        pointer-events-auto absolute left-[90px] top-4
        w-[390px] max-h-[90vh]
        bg-white border border-neutral-300 shadow-2xl
        rounded-2xl px-4 py-4
        flex flex-col gap-4
        overflow-y-auto
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
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-neutral-800">
            Point A — Départ
          </div>
          <span className="text-xs text-neutral-500">
            {start ? "défini" : "non défini"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onUseMyPosition}
            className="flex-1 min-w-[120px] border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-neutral-100"
          >
            📍 Ma position
          </button>

          <button
            onClick={onPickStartOnMap}
            className="flex-1 min-w-[120px] border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-neutral-100"
          >
            A sur la carte
          </button>

          <button
            onClick={onSetStartFromCenter}
            className="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-neutral-100"
          >
            ⊙ centre
          </button>
        </div>

        {/* bâtiment */}
        <div>
          <label className="text-xs text-neutral-600">A depuis bâtiment</label>
          <select
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white mt-1"
            value={selectedStartId}
            onChange={(e) => handleStartBuildingChange(e.target.value)}
          >
            <option value="">Choisir…</option>
            {buildingsList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-neutral-600">
          {start ? (
            <>A: {start[1].toFixed(5)}, {start[0].toFixed(5)}</>
          ) : (
            "A encore vide"
          )}
        </div>
      </section>

      {/* POINT B */}
      <section className="border border-neutral-300 rounded-xl p-4 space-y-3 bg-neutral-50">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-neutral-800">
            Point B — Arrivée
          </div>
          <span className="text-xs text-neutral-500">
            {dest ? "défini" : "non défini"}
          </span>
        </div>

        <button
          onClick={onPickDestOnMap}
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-neutral-100"
        >
          B sur la carte
        </button>

        <div>
          <label className="text-xs text-neutral-600">B depuis bâtiment</label>
          <select
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white mt-1"
            value={selectedDestId}
            onChange={(e) => handleDestBuildingChange(e.target.value)}
          >
            <option value="">Choisir…</option>
            {buildingsList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-neutral-600">
          {dest ? (
            <>B: {dest[1].toFixed(5)}, {dest[0].toFixed(5)}</>
          ) : (
            "B encore vide"
          )}
        </div>
      </section>

      {/* ITINÉRAIRE EXTÉRIEUR */}
      <section className="border border-neutral-300 rounded-xl p-4 space-y-3 bg-neutral-50">
        <div className="text-sm font-semibold text-neutral-800">
          Itinéraire extérieur
        </div>

        <div className="flex gap-2">
          <button
            onClick={onRouteFoot}
            disabled={!start || !dest}
            className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-neutral-100 disabled:opacity-50"
          >
            🚶 Marche
          </button>

          {/* 🔥 BOUTON PMR */}
          <button
            onClick={onRouteWheelchair}
            disabled={!start || !dest}
            className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-neutral-100 disabled:opacity-50"
          >
            ♿ Accessible
          </button>

          <button
            onClick={onClearRoute}
            className="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-neutral-100"
          >
            🧹 Clear
          </button>
        </div>
      </section>

      {/* ITINÉRAIRE INTÉRIEUR */}
      {displayedIndoorNodes.length > 0 && (
        <section className="border border-neutral-300 rounded-xl p-4 space-y-3 bg-neutral-50">
          <div className="text-sm font-semibold text-neutral-800">
            Itinéraire intérieur (UCU)
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-neutral-600">Départ</label>
              <select
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white mt-1"
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
            </div>

            <div>
              <label className="text-xs text-neutral-600">Arrivée</label>
              <select
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white mt-1"
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
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-neutral-700">
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
              onIndoorRoute(
                indoorFromId,
                indoorToId,
                indoorAccessibleOnly
              )
            }
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-neutral-100 disabled:opacity-40"
          >
            ♿ Calculer
          </button>
        </section>
      )}
    </aside>
  );
}
