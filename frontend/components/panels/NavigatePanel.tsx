"use client";

import { useState } from "react";
import PointPickerSheet from "./PointPickerSheet";

type Props = {
  /** état et callbacks déjà fournis par page.tsx */
  start: [number, number] | null;
  dest: [number, number] | null;
  onUseMyPosition: () => void;
  onPickStartOnMap: () => void;
  onPickDestOnMap: () => void;
  onSetStartFromCenter: () => void;
  onRouteFoot: () => void;
  onClear?: () => void;
};

/** Petit bouton utilitaire */
const Btn = (p: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...p}
    className={`h-10 px-3 rounded-xl border bg-white hover:bg-neutral-50 text-sm ${p.className || ""}`}
  />
);

export default function NavigatePanel({
  start, dest,
  onUseMyPosition, onPickStartOnMap, onPickDestOnMap, onSetStartFromCenter,
  onRouteFoot, onClear,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState<false | "start" | "end">(false);

  return (
    <>
      {/* Panneau flottant (petit, paddé, non-collé au bord gauche) */}
      <aside
        className="
          absolute left-[98px] top-4 w-[360px] max-w-[92vw]
          bg-white/95 backdrop-blur
          border border-black/10 rounded-2xl shadow-xl
          p-4 space-y-3 z-[35]
        "
        role="region"
        aria-label="Navigate"
      >
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Navigate</div>
          {/* Si tu veux un close plus tard */}
          {/* <button className="rounded-lg px-2 py-1 hover:bg-neutral-100">✕</button> */}
        </div>

        {/* Start */}
        <button
          onClick={() => setPickerOpen("start")}
          className="w-full h-12 rounded-xl border bg-white hover:bg-neutral-50 text-left px-4 flex items-center gap-3"
        >
          <span className="text-lg">＋</span>
          <span className="font-medium">Add Start Point</span>
        </button>

        {/* End */}
        <button
          onClick={() => setPickerOpen("end")}
          className="w-full h-12 rounded-xl border bg-white hover:bg-neutral-50 text-left px-4 flex items-center gap-3"
        >
          <span className="text-lg">＋</span>
          <span className="font-medium">Add End Point</span>
        </button>

        {/* Infos A/B */}
        <div className="text-xs text-neutral-600">
          {start ? <>A: {start[1].toFixed(5)}, {start[0].toFixed(5)}</> : "A: not set"}<br/>
          {dest  ? <>B: {dest[1].toFixed(5)}, {dest[0].toFixed(5)}</>   : "B: not set"}
        </div>

        {/* actions rapides */}
        <div className="grid grid-cols-2 gap-2">
          <Btn onClick={onUseMyPosition}>📍 My position</Btn>
          <Btn onClick={onSetStartFromCenter}>⊙ A = center</Btn>
        </div>

        {/* route + clear */}
        <div className="grid grid-cols-[1fr,auto] gap-2">
          <button
            className="h-11 rounded-xl bg-black text-white text-sm px-4"
            onClick={onRouteFoot}
          >
            🚶 Walk
          </button>
          <Btn onClick={onClear}>✖ Clear</Btn>
        </div>

        {/* Choix sur la carte (optionnels si tu veux les garder) */}
        <div className="grid grid-cols-2 gap-2">
          <Btn onClick={onPickStartOnMap}>🗺️ Pick A on map</Btn>
          <Btn onClick={onPickDestOnMap}>🗺️ Pick B on map</Btn>
        </div>
      </aside>

      {/* Sheet de sélection (ouvre quand on clique Add Start/End) */}
      <PointPickerSheet
        open={pickerOpen !== false}
        mode={pickerOpen === "start" ? "start" : "end"}
        onClose={() => setPickerOpen(false)}
        onPick={(pt) => {
          if (pickerOpen === "start") {
            // renvoie dans page.tsx via onPickStartOnMap ? tu utilises déjà un mode “pick on map”.
            // ICI on déclenche un CustomEvent simple que page.tsx peut écouter si tu préfères.
            // Mais le plus simple: expose des setters via ‘onSetStartFromCenter’ etc.
            // -> On simule un clic “pick on map” en mettant A = pt via un événement global.
            window.dispatchEvent(new CustomEvent("nav:set-start", { detail: pt }));
          } else {
            window.dispatchEvent(new CustomEvent("nav:set-end", { detail: pt }));
          }
          setPickerOpen(false);
        }}
      />
    </>
  );
}
