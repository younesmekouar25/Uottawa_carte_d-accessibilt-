"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Props = {
  feature: any | null;
  floor?: "F0" | "F1" | "F2";
  onChangeFloor?: (f: "F0" | "F1" | "F2") => void;
  onClose: () => void;
};

type FloorAccessSummary = {
  classrooms: string[];
  toilets: string[];
  elevators: number;
  stairs: number;
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
  const code = (p.code as string) ?? "UCU";

  const [accessSummary, setAccessSummary] = useState<FloorAccessSummary | null>(
    null
  );
  const [loadingAccess, setLoadingAccess] = useState(false);

  // -------- Charger les infos "accessibilité" pour le building / étage courant ----------
  useEffect(() => {
    // Pour l'instant on ne le fait que pour UCU
    if (code !== "UCU") {
      setAccessSummary(null);
      return;
    }

    const lvl = Number(floor.slice(1)); // "F0" -> 0, etc.
    setLoadingAccess(true);

    const load = async () => {
      try {
        const [roomsRes, accRes] = await Promise.all([
          fetch(`/data/ucu-level-${lvl}.geojson`),
          fetch("/data/pointaccessible.geojson"),
        ]);

        if (!roomsRes.ok) throw new Error("ucu-level not found");
        const rooms = await roomsRes.json();

        const classrooms: string[] = [];
        const toilets: string[] = [];
        const elevatorsFromRooms: string[] = [];

        for (const f of rooms.features ?? []) {
          const pr = f.properties || {};
          if (pr.Classroom) classrooms.push(String(pr.Classroom));
          if (pr.toilet) toilets.push(String(pr.toilet));
          if (pr.elevator) elevatorsFromRooms.push(String(pr.elevator));
        }

        let stairsCount = 0;
        let elevatorsCount = elevatorsFromRooms.length;

        if (accRes.ok) {
          const acc = await accRes.json();
          const perFloor = (acc.features ?? []).filter((f: any) => {
            const fp = f.properties || {};
            // si propriété floor existe, on filtre; sinon on accepte tout
            return !fp.floor || String(fp.floor) === String(lvl);
          });

          perFloor.forEach((f: any) => {
            const t = f.properties?.type;
            if (t === "stairs") stairsCount += 1;
            if (t === "elevator") elevatorsCount += 1;
          });
        }

        const uniq = (arr: string[]) => Array.from(new Set(arr));

        setAccessSummary({
          classrooms: uniq(classrooms).sort(),
          toilets: uniq(toilets).sort(),
          elevators: elevatorsCount,
          stairs: stairsCount,
        });
      } catch (e) {
        console.warn("Erreur chargement access summary:", e);
        setAccessSummary(null);
      } finally {
        setLoadingAccess(false);
      }
    };

    load();
  }, [code, floor]);

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
          alt={code}
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
            <div className="text-lg font-semibold leading-tight truncate">
              {title}
            </div>
            <div className="text-xs text-neutral-500">{code}</div>
          </div>

          {/* Sélecteur d’étages */}
          <div className="relative">
            <div className="text-xs text-neutral-500 mb-1 text-right">
              {code} — Étages
            </div>
            <div className="flex gap-1">
              {(["F2", "F1", "F0"] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => onChangeFloor?.(lvl)}
                  className={`px-3 py-1 rounded-lg border text-sm ${
                    floor === lvl
                      ? "bg-neutral-900 text-white"
                      : "bg-white hover:bg-neutral-100"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Infos horaires / contact */}
        <section className="border rounded-2xl p-3">
          <div className="text-xs font-semibold text-neutral-500 mb-1">
            WORKING HOURS
          </div>
          <div className="text-sm">07:00 – 22:00 (lun–dim)</div>
        </section>

        <section className="border rounded-2xl p-3">
          <div className="text-xs font-semibold text-neutral-500 mb-1">
            PHONE
          </div>
          <div className="text-sm">
            <a className="underline" href="tel:+16135625800">
              +1 613-562-5800
            </a>
          </div>
        </section>

        <section className="border rounded-2xl p-3">
          <div className="text-xs font-semibold text-neutral-500 mb-1">
            WEBSITE
          </div>
          <div className="text-sm">
            <a
              className="underline"
              href="https://www.uottawa.ca"
              target="_blank"
              rel="noreferrer"
            >
              uottawa.ca
            </a>
          </div>
        </section>

        {/* 🔎 Section ACCESSIBILITÉ par étage */}
        <section className="border rounded-2xl p-3">
          <div className="text-xs font-semibold text-neutral-500 mb-2">
            ACCESSIBILITÉ — Niveau {floor}
          </div>

          {loadingAccess && (
            <div className="text-xs text-neutral-400">Chargement…</div>
          )}

          {!loadingAccess && !accessSummary && (
            <div className="text-xs text-neutral-500">
              Aucune donnée d’accessibilité disponible pour ce bâtiment.
            </div>
          )}

          {!loadingAccess && accessSummary && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Toilettes :</span>{" "}
                {accessSummary.toilets.length
                  ? accessSummary.toilets.join(", ")
                  : "non répertoriées"}
              </div>
              <div>
                <span className="font-medium">Ascenseurs :</span>{" "}
                {accessSummary.elevators > 0
                  ? `${accessSummary.elevators} ascenseur(s)`
                  : "aucun répertorié"}
              </div>
              <div>
                <span className="font-medium">Escaliers :</span>{" "}
                {accessSummary.stairs > 0
                  ? `${accessSummary.stairs} escalier(s)`
                  : "non répertoriés"}
              </div>
              <div>
                <span className="font-medium">Salles (extrait) :</span>{" "}
                {accessSummary.classrooms.length ? (
                  <>
                    {accessSummary.classrooms.slice(0, 12).join(", ")}
                    {accessSummary.classrooms.length > 12 && (
                      <span className="text-xs text-neutral-500">
                        {" "}
                        (+{accessSummary.classrooms.length - 12} autres)
                      </span>
                    )}
                  </>
                ) : (
                  "non répertoriées"
                )}
              </div>
            </div>
          )}
        </section>

        {/* Description */}
        <section className="text-xs text-neutral-600 leading-relaxed">
          Centre étudiant du campus. Accès intérieur vers UCU Terrace et
          Morisset. Entrées principales au niveau 0 proches de l’entrée sud.
        </section>
      </div>
    </aside>
  );
}
