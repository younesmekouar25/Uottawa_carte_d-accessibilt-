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
  onClearRoute: () => void;

  onClose: () => void;

  // 🔥 Indoor
  indoorNodes: IndoorNodeOption[];
  onIndoorRoute: (fromId: string, toId: string, accessible: boolean) => void;
};

/* --- helpers pour centroid + label bâtiment --- */
function walkCoords(a: any, out: number[][]) {
  if (Array.isArray(a?.[0])) {
    a.forEach((b: any) => walkCoords(b, out));
  } else {
    out.push(a as number[]);
  }
}

function centroidOfFeature(f: GeoJSON.Feature): Coord {
  const coords: number[][] = [];
  // @ts-expect-error geometry typée large
  walkCoords(f.geometry.coordinates, coords);
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

export default function NavigatePanel({
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
  onClearRoute,
  onClose,
  indoorNodes,
  onIndoorRoute,
}: Props) {
  // sélecteurs A/B via bâtiments
  const [selectedStartId, setSelectedStartId] = useState<string>("");
  const [selectedDestId, setSelectedDestId] = useState<string>("");

  // vue filtrée “accessible” pour l’itinéraire extérieur
  const [accessibleViewOnly, setAccessibleViewOnly] = useState<boolean>(false);

  // choix indoor
  const [indoorFromId, setIndoorFromId] = useState<string>("");
  const [indoorToId, setIndoorToId] = useState<string>("");
  const [indoorAccessibleOnly, setIndoorAccessibleOnly] =
    useState<boolean>(true);

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
    const c = centroidOfFeature(row.feature as any);
    onSetStart(c);
  };

  const handleDestBuildingChange = (id: string) => {
    setSelectedDestId(id);
    const row = buildingsList.find((b) => b.id === id);
    if (!row) return;
    const c = centroidOfFeature(row.feature as any);
    onSetDest(c);
  };

  // 🔎 analyse accessibilité des étapes extérieures
  const stairsCount = useMemo(
    () => (steps || []).filter((s) => s.hasStairs).length,
    [steps]
  );

  const displayedSteps = useMemo(
    () =>
      accessibleViewOnly
        ? (steps || []).filter((s) => !s.hasStairs)
        : steps || [],
    [steps, accessibleViewOnly]
  );

  const canRunIndoorRoute =
    indoorFromId.trim().length > 0 && indoorToId.trim().length > 0;

  return (
    <aside
      className="
        pointer-events-auto
        absolute left-[90px] top-4
        w-[380px] max-h-[90vh]
        bg-white/95 border border-black/10 shadow-xl
        rounded-2xl px-4 py-3
        flex flex-col gap-3
        overflow-y-auto
      "
      aria-label="Navigation"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Navigation</div>
          <div className="text-[11px] text-neutral-500">
            Choisis tes points A et B pour l’itinéraire, intérieur ou extérieur.
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs hover:bg-neutral-100"
        >
          ✕
        </button>
      </div>

      {/* Point A */}
      <section className="border border-black/10 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-neutral-700">
            Point A — Départ
          </div>
          <span className="text-[11px] text-neutral-500">
            {start ? "défini" : "non défini"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onUseMyPosition}
            className="flex-1 min-w-[120px] border rounded-lg px-2 py-1.5 text-xs hover:bg-neutral-50"
          >
            📍 Ma position
          </button>
          <button
            onClick={onPickStartOnMap}
            className="flex-1 min-w-[120px] border rounded-lg px-2 py-1.5 text-xs hover:bg-neutral-50"
          >
            A sur la carte
          </button>
          <button
            onClick={onSetStartFromCenter}
            className="border rounded-lg px-2 py-1.5 text-xs hover:bg-neutral-50"
            title="A = centre de la carte"
          >
            ⊙ centre
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-neutral-500">
            A depuis un bâtiment
          </label>
          <select
            className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
            value={selectedStartId}
            onChange={(e) => handleStartBuildingChange(e.target.value)}
          >
            <option value="">Choisir un bâtiment…</option>
            {buildingsList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] text-neutral-500">
          {start ? (
            <>A: {start[1].toFixed(5)}, {start[0].toFixed(5)}</>
          ) : (
            "A encore vide"
          )}
        </div>
      </section>

      {/* Point B */}
      <section className="border border-black/10 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-neutral-700">
            Point B — Arrivée
          </div>
          <span className="text-[11px] text-neutral-500">
            {dest ? "défini" : "non défini"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onPickDestOnMap}
            className="flex-1 min-w-[120px] border rounded-lg px-2 py-1.5 text-xs hover:bg-neutral-50"
          >
            B sur la carte
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-neutral-500">
            B depuis un bâtiment
          </label>
          <select
            className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
            value={selectedDestId}
            onChange={(e) => handleDestBuildingChange(e.target.value)}
          >
            <option value="">Choisir un bâtiment…</option>
            {buildingsList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] text-neutral-500">
          {dest ? (
            <>B: {dest[1].toFixed(5)}, {dest[0].toFixed(5)}</>
          ) : (
            "B encore vide"
          )}
        </div>
      </section>

      {/* Itinéraire extérieur */}
      <section className="border border-black/10 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-neutral-700">
            Itinéraire extérieur (OSRM)
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRouteFoot}
            disabled={!start || !dest}
            className="flex-1 border rounded-lg px-3 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🚶‍♂️ Calculer (marche)
          </button>
          <button
            onClick={onClearRoute}
            className="border rounded-lg px-3 py-1.5 text-xs hover:bg-neutral-50"
          >
            🧹 Clear
          </button>
        </div>

        {/* 🧑‍🦽 Bloc Accessibilité pour l’itinéraire extérieur */}
        {steps && steps.length > 0 && (
          <div className="mt-2 border-t pt-2 space-y-2">
            {/* Résumé accessibilité */}
            <div className="flex items-start justify-between gap-2">
              <div className="text-[11px]">
                <div className="font-medium mb-0.5">
                  Accessibilité (extérieur)
                </div>

                {stairsCount === 0 ? (
                  <>
                    <div className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-[1px] text-[10px] mb-1">
                      ✅ Trajet probablement accessible
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      Aucune mention d&apos;escaliers dans les instructions OSRM.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-[1px] text-[10px] mb-1">
                      ⚠ {stairsCount} étape(s) mentionnent des escaliers / marches
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      Analyse basée sur les mots-clés (stairs/steps/escaliers).
                      La présence réelle de rampes ou d&apos;obstacles reste à
                      vérifier sur place.
                    </div>
                  </>
                )}
              </div>

              <label className="flex items-center gap-2 text-[11px] text-neutral-600">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={accessibleViewOnly}
                  onChange={(e) => setAccessibleViewOnly(e.target.checked)}
                />
                <span>Vue accessible</span>
              </label>
            </div>

            {/* Liste des étapes (filtrée ou non) */}
            {displayedSteps.length > 0 ? (
              <div className="max-h-40 overflow-y-auto">
                <div className="text-[11px] font-medium mb-1">Étapes</div>
                <ol className="space-y-1 text-[11px]">
                  {displayedSteps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-neutral-500">{i + 1}.</span>
                      <div className="flex-1 space-y-0.5">
                        <div>{s.instruction}</div>

                        {s.notes && s.notes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {s.notes.map((n, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded-full border px-2 py-[1px] text-[10px] text-neutral-700 bg-neutral-50"
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        )}

                        {s.hasStairs && !accessibleViewOnly && (
                          <span className="inline-flex mt-0.5 rounded-full bg-amber-100 text-amber-800 px-2 py-[1px] text-[10px]">
                            ⚠ Escaliers / marches possibles
                          </span>
                        )}
                      </div>
                      <span className="text-neutral-500 whitespace-nowrap ml-1">
                        {Math.round(s.distance)} m
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="text-[11px] text-neutral-500">
                Aucune étape à afficher
                {accessibleViewOnly
                  ? " (toutes les étapes contenaient des escaliers et ont été masquées)."
                  : "."}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 🔥 Bloc Navigation intérieure (graph UCU) */}
      {indoorNodes && indoorNodes.length > 0 && (
        <section className="border border-black/10 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-neutral-700">
              Itinéraire intérieur (UCU)
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-neutral-500">
                Départ (salle / nœud indoor)
              </label>
              <select
                className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
                value={indoorFromId}
                onChange={(e) => setIndoorFromId(e.target.value)}
              >
                <option value="">Choisir un point de départ…</option>
                {indoorNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} — F{n.floor}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-neutral-500">
                Arrivée (salle / nœud indoor)
              </label>
              <select
                className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
                value={indoorToId}
                onChange={(e) => setIndoorToId(e.target.value)}
              >
                <option value="">Choisir une destination…</option>
                {indoorNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} — F{n.floor}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-1">
            <label className="flex items-center gap-2 text-[11px] text-neutral-600">
              <input
                type="checkbox"
                className="rounded"
                checked={indoorAccessibleOnly}
                onChange={(e) => setIndoorAccessibleOnly(e.target.checked)}
              />
              <span>Éviter les escaliers (trajet accessible)</span>
            </label>
          </div>

          <button
            disabled={!canRunIndoorRoute}
            onClick={() =>
              onIndoorRoute(indoorFromId, indoorToId, indoorAccessibleOnly)
            }
            className="w-full mt-2 border rounded-lg px-3 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🧭 Calculer l’itinéraire intérieur
          </button>

          <p className="mt-1 text-[10px] text-neutral-500">
            Les trajets intérieurs utilisent le graphe du bâtiment (salles,
            jonctions, ascenseurs, escaliers). L&apos;option accessible
            privilégie les nœuds marqués comme accessibles.
          </p>
        </section>
      )}
    </aside>
  );
}
