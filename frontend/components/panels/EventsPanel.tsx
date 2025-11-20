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
      return "bg-red-50 border-red-100 text-red-900";
    case "medium":
      return "bg-amber-50 border-amber-100 text-amber-900";
    case "low":
      return "bg-emerald-50 border-emerald-100 text-emerald-900";
    default:
      return "bg-slate-50 border-slate-100 text-slate-900";
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
      return "bg-slate-100 text-slate-700";
  }
}

function formatDateRange(start?: string, end?: string): string | null {
  if (!start && !end) return null;

  try {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    const optsDate: Intl.DateTimeFormatOptions = {
      day: "2-digit",
      month: "short",
    };
    const optsTime: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
    };

    if (startDate && endDate) {
      const sameDay =
        startDate.toDateString() === endDate.toDateString();

      if (sameDay) {
        return `${startDate.toLocaleDateString("fr-CA", optsDate)} · ${startDate.toLocaleTimeString(
          "fr-CA",
          optsTime
        )} – ${endDate.toLocaleTimeString("fr-CA", optsTime)}`;
      }

      return `${startDate.toLocaleDateString(
        "fr-CA",
        optsDate
      )} ${startDate.toLocaleTimeString(
        "fr-CA",
        optsTime
      )} – ${endDate.toLocaleDateString(
        "fr-CA",
        optsDate
      )} ${endDate.toLocaleTimeString("fr-CA", optsTime)}`;
    }

    if (startDate && !endDate) {
      return `Dès ${startDate.toLocaleDateString(
        "fr-CA",
        optsDate
      )} ${startDate.toLocaleTimeString("fr-CA", optsTime)}`;
    }

    if (!startDate && endDate) {
      return `Jusqu’au ${endDate.toLocaleDateString(
        "fr-CA",
        optsDate
      )} ${endDate.toLocaleTimeString("fr-CA", optsTime)}`;
    }
  } catch {
    return null;
  }

  return null;
}

export default function EventsPanel({ onClose }: Props) {
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/data/events.json", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = (await res.json()) as EventsResponse;
        if (!cancelled) {
          setEvents(json.events ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setError("Impossible de charger les événements du campus.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside
      className="
        pointer-events-auto
        absolute left-[90px] top-4
        w-[380px] max-h-[80vh]
        bg-white/95 border border-black/10 shadow-xl
        rounded-2xl px-4 py-3
        flex flex-col gap-3
        overflow-y-auto
      "
      aria-label="Événements impactant l’accessibilité"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold flex items-center gap-2">
            Événements & affluence
            {events.length > 0 && !loading && !error && (
              <span className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-800 text-[10px] px-2 py-0.5 font-medium">
                {events.length} à venir
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-500">
            Visualise les activités qui peuvent rendre les déplacements plus
            difficiles (foule, kiosques, files d’attente).
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs hover:bg-neutral-100"
        >
          ✕
        </button>
      </div>

      {/* Contenu */}
      {loading && (
        <div className="text-xs text-neutral-500 italic py-4">
          Chargement des événements…
        </div>
      )}

      {error && !loading && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2">
          Aucun événement à forte affluence enregistré dans les prochains
          jours.
        </div>
      )}

      <div className="space-y-2">
        {events.map((ev) => {
          const range = formatDateRange(ev.startsAt, ev.endsAt);
          const level = ev.expectedCrowdLevel ?? "medium";

          return (
            <article
              key={ev.id}
              className={`
                border rounded-xl px-3 py-2.5 text-xs
                flex flex-col gap-1.5
                ${crowdClasses(level)}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold leading-snug">
                  {ev.title}
                </div>
                <span
                  className={`
                    inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold
                    ${crowdPillClasses(level)}
                  `}
                >
                  {crowdLabel(level)}
                </span>
              </div>

              {(ev.buildingName || ev.buildingCode) && (
                <div className="text-[11px] font-medium">
                  {ev.buildingCode && (
                    <span className="font-semibold">{ev.buildingCode}</span>
                  )}
                  {ev.buildingCode && ev.buildingName && " · "}
                  {ev.buildingName && <span>{ev.buildingName}</span>}
                  {typeof ev.floor === "number" && (
                    <span className="text-[11px] text-neutral-700">
                      {" "}
                      · étage {ev.floor}
                    </span>
                  )}
                </div>
              )}

              <p className="text-[11px] leading-snug">{ev.description}</p>

              {ev.impactsAccessibility && (
                <div className="mt-1 text-[11px] text-red-800 font-medium">
                  Impact accessibilité :{" "}
                  <span className="font-normal">
                    {ev.impactDescription ??
                      "Cet événement peut compliquer les déplacements pour certaines personnes."}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between mt-0.5">
                {range && (
                  <div className="text-[10px] text-neutral-700">
                    {range}
                  </div>
                )}
                <div className="text-[10px] text-neutral-500">
                  Événement campus
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
