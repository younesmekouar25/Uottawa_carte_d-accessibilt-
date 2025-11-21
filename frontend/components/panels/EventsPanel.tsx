"use client";

import { useEffect, useState } from "react";

type CrowdLevel = "low" | "medium" | "high";

type CampusEvent = {
  id: string;
  title: string;
  description: string;
  buildingCode?: string;
  buildingName?: string;
  floor?: number;
  startsAt?: string;
  endsAt?: string;
  impactsAccessibility?: boolean;
  impactDescription?: string;
  expectedCrowdLevel?: CrowdLevel;
};

type EventsResponse = {
  events?: CampusEvent[];
};

type Props = {
  onClose: () => void;
};

/* ----------------------------- Labels & Styles ----------------------------- */
function crowdLabel(level?: CrowdLevel) {
  switch (level) {
    case "high":
      return "Affluence élevée";
    case "medium":
      return "Affluence modérée";
    case "low":
      return "Affluence faible";
    default:
      return "Affluence inconnue";
  }
}

function crowdClasses(level?: CrowdLevel) {
  switch (level) {
    case "high":
      return "bg-red-50 border-red-200 text-red-900";
    case "medium":
      return "bg-amber-50 border-amber-200 text-amber-900";
    case "low":
      return "bg-emerald-50 border-emerald-200 text-emerald-900";
    default:
      return "bg-neutral-50 border-neutral-200 text-neutral-900";
  }
}

function crowdPillClasses(level?: CrowdLevel) {
  switch (level) {
    case "high":
      return "bg-red-100 text-red-800";
    case "medium":
      return "bg-amber-100 text-amber-800";
    case "low":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-neutral-200 text-neutral-700";
  }
}

/* ----------------------------- Date formatting ----------------------------- */
function formatDateRange(start?: string, end?: string): string | null {
  if (!start && !end) return null;

  try {
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;

    const optsDate: Intl.DateTimeFormatOptions = {
      day: "2-digit",
      month: "short",
    };
    const optsTime: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
    };

    if (s && e) {
      const same = s.toDateString() === e.toDateString();

      if (same) {
        return `${s.toLocaleDateString("fr-CA", optsDate)} — ${s.toLocaleTimeString(
          "fr-CA",
          optsTime
        )} → ${e.toLocaleTimeString("fr-CA", optsTime)}`;
      }

      return `${s.toLocaleDateString("fr-CA", optsDate)} ${s.toLocaleTimeString(
        "fr-CA",
        optsTime
      )} — ${e.toLocaleDateString("fr-CA", optsDate)} ${e.toLocaleTimeString(
        "fr-CA",
        optsTime
      )}`;
    }

    if (s && !e)
      return `Dès ${s.toLocaleDateString("fr-CA", optsDate)} ${
        s.toLocaleTimeString("fr-CA", optsTime)
      }`;

    if (!s && e)
      return `Jusqu’au ${e.toLocaleDateString("fr-CA", optsDate)} ${
        e.toLocaleTimeString("fr-CA", optsTime)
      }`;

    return null;
  } catch {
    return null;
  }
}

/* -------------------------------- Component -------------------------------- */
export default function EventsPanel({ onClose }: Props) {
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/data/events.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as EventsResponse;
        if (!cancel) setEvents(json.events ?? []);
      } catch {
        if (!cancel) setError("Impossible de charger les événements.");
      } finally {
        if (!cancel) setLoading(false);
      }
    }

    load();
    return () => {
      cancel = true;
    };
  }, []);

  /* -------------------------------- RENDER -------------------------------- */
  return (
    <aside
      className="
        pointer-events-auto absolute left-[90px] top-4
        w-[380px] max-h-[80vh] bg-white/95
        border border-black/10 shadow-xl rounded-2xl
        px-4 py-3 flex flex-col gap-3 overflow-y-auto
      "
      aria-label="Événements du campus"
    >
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">
            Événements & affluence
          </h2>
          <p className="text-[11px] text-neutral-600 mt-0.5">
            Déplacements potentiellement affectés par la foule, kiosques ou
            activités spéciales.
          </p>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      {/* LOADING */}
      {loading && (
        <p className="text-xs text-neutral-500 italic py-4">Chargement…</p>
      )}

      {/* ERROR */}
      {error && !loading && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* EMPTY */}
      {!loading && !error && events.length === 0 && (
        <p className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
          Aucun événement à forte affluence.
        </p>
      )}

      {/* LISTE DES ÉVÉNEMENTS */}
      <div className="space-y-2">
        {events.map((ev) => {
          const range = formatDateRange(ev.startsAt, ev.endsAt);
          const level = ev.expectedCrowdLevel ?? "medium";

          return (
            <article
              key={ev.id}
              className={`
                border rounded-xl px-3 py-2.5
                flex flex-col gap-2 text-[12px] leading-tight
                ${crowdClasses(level)}
              `}
            >
              {/* TITRE + BADGE */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-[13px]">{ev.title}</h3>
                <span
                  className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium ${crowdPillClasses(
                    level
                  )}`}
                >
                  {crowdLabel(level)}
                </span>
              </div>

              {/* LIEU */}
              {(ev.buildingName || ev.buildingCode) && (
                <p className="text-[11px] font-medium text-neutral-800">
                  {ev.buildingCode && <span>{ev.buildingCode}</span>}
                  {ev.buildingCode && ev.buildingName && " · "}
                  {ev.buildingName && <span>{ev.buildingName}</span>}
                  {typeof ev.floor === "number" && (
                    <span className="text-neutral-700"> · étage {ev.floor}</span>
                  )}
                </p>
              )}

              {/* DESCRIPTION */}
              <p className="text-[11px] text-neutral-900">{ev.description}</p>

              {/* IMPACT ACCESSIBILITÉ */}
              {ev.impactsAccessibility && (
                <p className="text-[11px] font-medium text-red-800">
                  Impact accessibilité :{" "}
                  <span className="font-normal">
                    {ev.impactDescription ??
                      "Cet événement peut compliquer les déplacements pour certaines personnes."}
                  </span>
                </p>
              )}

              {/* DATES */}
              <div className="flex items-center justify-between">
                {range && (
                  <span className="text-[10px] text-neutral-700">{range}</span>
                )}
                <span className="text-[10px] text-neutral-500">
                  Événement campus
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
