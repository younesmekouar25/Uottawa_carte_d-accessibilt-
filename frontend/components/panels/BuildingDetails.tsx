"use client";
import Image from "next/image";

type Props = {
  feature: any | null;
  floor?: "F0" | "F1" | "F2";
  onChangeFloor?: (f: "F0" | "F1" | "F2") => void;
  onClose: () => void;
};

export default function BuildingDetails({
  feature,
  floor = "F0",
  onChangeFloor,
  onClose,
}: Props) {
  if (!feature) return null;

  const p = feature.properties || {};
  const title = p["name:en"] ?? p["name:fr"] ?? p.name ?? "Building";
  const code  = p.code ?? "UCU";

  return (
    <aside
      className="
        pointer-events-auto absolute right-0 top-0 bottom-0
        z-50 w-[400px] max-w-[85vw]
        bg-white/95 backdrop-blur border-l border-neutral-200 shadow-xl
        flex flex-col
      "
      role="dialog"
      aria-label="Building details"
    >
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b">
        <div className="text-base font-semibold truncate">Building Details</div>
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-1 text-sm hover:bg-neutral-100"
          aria-label="Close"
        >
          ✕
        </button>
      </header>

      {/* Image bannière */}
      <div className="h-36 bg-neutral-100 overflow-hidden">
        <Image
          src="/images/ucu.png"
          alt="UCU"
          width={600}
          height={300}
          className="w-full h-full object-cover"
          priority
        />
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Titre + Étages */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center text-xs">
            {code}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold leading-tight truncate">{title}</div>
            <div className="text-xs text-neutral-500">{code}</div>
          </div>

          {/* Sélecteur d’étages */}
          <div className="relative">
            <div className="text-xs text-neutral-500 mb-1 text-right">{code} — Étages</div>
            <div className="flex gap-1">
              {(["F2","F1","F0"] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => onChangeFloor?.(lvl)}
                  className={`px-3 py-1 rounded-lg border text-sm ${
                    floor === lvl ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-100"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Infos */}
        <section className="border rounded-2xl p-3">
          <div className="text-xs font-semibold text-neutral-500 mb-1">WORKING HOURS</div>
          <div className="text-sm">07:00 – 22:00 (lun–dim)</div>
        </section>

        <section className="border rounded-2xl p-3">
          <div className="text-xs font-semibold text-neutral-500 mb-1">PHONE</div>
          <div className="text-sm">
            <a className="underline" href="tel:+16135625800">+1 613-562-5800</a>
          </div>
        </section>

        <section className="border rounded-2xl p-3">
          <div className="text-xs font-semibold text-neutral-500 mb-1">WEBSITE</div>
          <div className="text-sm">
            <a className="underline" href="https://www.uottawa.ca" target="_blank" rel="noreferrer">
              uottawa.ca
            </a>
          </div>
        </section>

        <section className="text-xs text-neutral-600 leading-relaxed">
          Centre étudiant du campus. Accès intérieur vers UCU Terrace et Morisset.
          Entrées principales au niveau 0 proches de l’entrée sud.
        </section>
      </div>
    </aside>
  );
}
