"use client";

import { useEffect, useState, FormEvent } from "react";

type AlertSeverity = "info" | "warning" | "danger";

type Alert = {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  buildingCode?: string;
  buildingName?: string;
  floor?: number;
  startsAt?: string;
  endsAt?: string;

  // facultatif pour distinguer les alertes
  source?: "system" | "user";
  reportedAt?: string;
};

type AlertsResponse = {
  alerts?: Alert[];
};

type Props = {
  onClose: () => void;
};

function severityLabel(sev: AlertSeverity) {
  switch (sev) {
    case "danger":
      return "Critique";
    case "warning":
      return "Attention";
    default:
      return "Information";
  }
}

function severityClasses(sev: AlertSeverity) {
  switch (sev) {
    case "danger":
      return "bg-red-50 border-red-200 text-red-900";
    case "warning":
      return "bg-amber-50 border-amber-200 text-amber-900";
    default:
      return "bg-sky-50 border-sky-200 text-sky-900";
  }
}

function severityPillClasses(sev: AlertSeverity) {
  switch (sev) {
    case "danger":
      return "bg-red-100 text-red-800";
    case "warning":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-sky-100 text-sky-800";
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
        return `${startDate.toLocaleDateString(
          "fr-CA",
          optsDate
        )} · ${startDate.toLocaleTimeString(
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

export default function AlertsPanel({ onClose }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // état pour le formulaire utilisateur
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSeverity, setNewSeverity] = useState<AlertSeverity>("warning");
  const [newMessage, setNewMessage] = useState("");
  const [newBuildingCode, setNewBuildingCode] = useState("");
  const [newBuildingName, setNewBuildingName] = useState("");
  const [newFloor, setNewFloor] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAlerts() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/data/alerts.json", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = (await res.json()) as AlertsResponse;
        if (!cancelled) {
          const base = (json.alerts ?? []).map((a) => ({
            ...a,
            source: a.source ?? "system" as const,
          }));
          setAlerts(base);
        }
      } catch (e) {
        if (!cancelled) {
          setError("Impossible de charger les alertes d’accessibilité.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAlerts();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitMessage(null);

    if (!newTitle.trim() || !newMessage.trim()) {
      setSubmitMessage("Merci de préciser au moins un titre et une description.");
      return;
    }

    const nowIso = new Date().toISOString();

    const userAlert: Alert = {
      id: `user-${Date.now()}`,
      title: newTitle.trim(),
      message: newMessage.trim(),
      severity: newSeverity,
      buildingCode: newBuildingCode.trim() || undefined,
      buildingName: newBuildingName.trim() || undefined,
      floor: newFloor ? Number(newFloor) : undefined,
      source: "user",
      reportedAt: nowIso,
    };

    setAlerts((prev) => [userAlert, ...prev]);

    setNewTitle("");
    setNewMessage("");
    setNewBuildingCode("");
    setNewBuildingName("");
    setNewFloor("");
    setFileName(null);
    setShowForm(false);
    setSubmitMessage(
      "Merci pour votre signalement. L’alerte est enregistrée et marquée comme « en cours de vérification »."
    );
  }

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
      aria-label="Alertes d’accessibilité"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold flex items-center gap-2">
            Alertes d’accessibilité
            {alerts.length > 0 && !loading && !error && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-800 text-[10px] px-2 py-0.5 font-medium">
                {alerts.length} active{alerts.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-500">
            Statut quasi temps réel des ascenseurs, toilettes accessibles,
            couloirs, rampes, etc.
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs hover:bg-neutral-100"
        >
          ✕
        </button>
      </div>

      {/* CTA signalement */}
      <div className="border border-dashed border-amber-200 bg-amber-50/60 rounded-xl px-3 py-2.5 mb-1">
        <div className="text-[11px] text-amber-900 font-medium mb-1">
          Vous avez constaté un nouveau danger ?
        </div>
        <p className="text-[11px] text-amber-900/90 mb-2">
          Par exemple : ascenseur en panne, rampe glissante, porte automatique
          qui ne fonctionne plus, couloir bloqué, etc.
        </p>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setSubmitMessage(null);
          }}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
        >
          Signaler une nouvelle alerte
        </button>
      </div>

      {/* Formulaire de signalement */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border border-amber-200 bg-white rounded-xl px-3 py-3 mb-2 space-y-2"
        >
          <div className="text-[11px] font-semibold text-neutral-800 mb-1">
            Nouveau signalement d’accessibilité
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-neutral-700">
              Titre du problème*
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px]"
              placeholder="Ex. Ascenseur UCU – niveau 0 hors service"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-neutral-700">
              Gravité estimée*
            </label>
            <select
              value={newSeverity}
              onChange={(e) =>
                setNewSeverity(e.target.value as AlertSeverity)
              }
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px]"
            >
              <option value="info">Information (mineur)</option>
              <option value="warning">Attention (gêne modérée)</option>
              <option value="danger">Critique (bloque l’accès)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-neutral-700">
                Code du bâtiment
              </label>
              <input
                type="text"
                value={newBuildingCode}
                onChange={(e) => setNewBuildingCode(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px]"
                placeholder="Ex. UCU, STEM…"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-neutral-700">
                Nom / zone
              </label>
              <input
                type="text"
                value={newBuildingName}
                onChange={(e) => setNewBuildingName(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px]"
                placeholder="Ex. Entrée principale, rampe nord…"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-neutral-700">
              Étage (optionnel)
            </label>
            <input
              type="number"
              value={newFloor}
              onChange={(e) => setNewFloor(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px]"
              placeholder="Ex. 0, 1, 2…"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-neutral-700">
              Description détaillée*
            </label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px] min-h-[70px]"
              placeholder="Décrivez le problème, l’impact sur l’accessibilité et tout détail utile."
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-neutral-700">
              Photo (optionnelle)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFileName(f ? f.name : null);
              }}
              className="w-full text-[10px]"
            />
            {fileName && (
              <p className="text-[10px] text-neutral-600">
                Fichier sélectionné : <span className="font-medium">{fileName}</span>
              </p>
            )}
            <p className="text-[10px] text-neutral-500">
              La photo aide les équipes à vérifier plus rapidement le problème.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setSubmitMessage(null);
              }}
              className="text-[11px] px-2 py-1 rounded-lg hover:bg-neutral-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Envoyer le signalement
            </button>
          </div>

          {submitMessage && (
            <p className="mt-1 text-[10px] text-emerald-700">
              {submitMessage}
            </p>
          )}
        </form>
      )}

      {/* Messages de chargement / erreur */}
      {loading && (
        <div className="text-xs text-neutral-500 italic py-4">
          Chargement des alertes…
        </div>
      )}

      {error && !loading && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {!loading && !error && alerts.length === 0 && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          Aucune alerte d’accessibilité active pour le moment.
          Tous les équipements semblent disponibles.
        </div>
      )}

      {/* Liste des alertes */}
      <div className="space-y-2">
        {alerts.map((a) => {
          const range = formatDateRange(a.startsAt, a.endsAt);
          const sev: AlertSeverity = a.severity ?? "info";

          const isUser = a.source === "user";

          return (
            <article
              key={a.id}
              className={`
                border rounded-xl px-3 py-2.5 text-xs
                flex flex-col gap-1.5
                ${severityClasses(sev)}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold leading-snug">{a.title}</div>
                <span
                  className={`
                    inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold
                    ${severityPillClasses(sev)}
                  `}
                >
                  {severityLabel(sev)}
                </span>
              </div>

              {(a.buildingName || a.buildingCode || typeof a.floor === "number") && (
                <div className="text-[11px] font-medium">
                  {a.buildingCode && (
                    <span className="font-semibold">{a.buildingCode}</span>
                  )}
                  {a.buildingCode && a.buildingName && " · "}
                  {a.buildingName && <span>{a.buildingName}</span>}
                  {typeof a.floor === "number" && (
                    <span className="text-[11px] text-neutral-700">
                      {" "}
                      · étage {a.floor}
                    </span>
                  )}
                </div>
              )}

              <p className="text-[11px] leading-snug">{a.message}</p>

              <div className="flex items-center justify-between mt-0.5">
                {range ? (
                  <div className="text-[10px] text-neutral-700">
                    {range}
                  </div>
                ) : isUser && a.reportedAt ? (
                  <div className="text-[10px] text-neutral-700">
                    Signalé le{" "}
                    {new Date(a.reportedAt).toLocaleString("fr-CA", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                ) : (
                  <span />
                )}
                <div className="text-[10px] text-neutral-500">
                  {isUser
                    ? "Signalement en cours de vérification"
                    : "Impact sur l’accessibilité"}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
