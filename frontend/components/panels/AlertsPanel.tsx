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

  source?: "system" | "user";
  reportedAt?: string;
};

type AlertsResponse = {
  alerts?: Alert[];
};

type Props = {
  onClose: () => void;
};

/* ---------------- LABEL ACCESSIBLE ---------------- */
function severityLabel(sev: AlertSeverity) {
  if (sev === "danger") return "Critique";
  if (sev === "warning") return "Avertissement";
  return "Information";
}

/* ---------------- WCAG: COULEURS SIMPLIFIÉES ----------------
   - danger → fond rouge très clair
   - warning → neutre
   - info → neutre
-------------------------------------------------------------- */
function severityClasses(sev: AlertSeverity) {
  if (sev === "danger") {
    return "bg-red-50 border border-red-300 text-red-900";
  }
  return "bg-neutral-50 border border-neutral-300 text-neutral-900";
}

/* ---------------- Pastille de statut ---------------- */
function severityPillClasses(sev: AlertSeverity) {
  if (sev === "danger") return "bg-red-100 text-red-800";
  return "bg-neutral-200 text-neutral-800"; // warning + info → neutre
}

/* ---------------- Format date ---------------- */
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
        return `${startDate.toLocaleDateString("fr-CA", optsDate)}
        · ${startDate.toLocaleTimeString("fr-CA", optsTime)}
        – ${endDate.toLocaleTimeString("fr-CA", optsTime)}`;
      }

      return `${startDate.toLocaleDateString("fr-CA", optsDate)}
      ${startDate.toLocaleTimeString("fr-CA", optsTime)}
      – ${endDate.toLocaleDateString("fr-CA", optsDate)}
      ${endDate.toLocaleTimeString("fr-CA", optsTime)}`;
    }

    if (startDate && !endDate) {
      return `Dès ${startDate.toLocaleDateString("fr-CA", optsDate)}
      ${startDate.toLocaleTimeString("fr-CA", optsTime)}`;
    }

    if (!startDate && endDate) {
      return `Jusqu’au ${endDate.toLocaleDateString("fr-CA", optsDate)}
      ${endDate.toLocaleTimeString("fr-CA", optsTime)}`;
    }
  } catch {
    return null;
  }

  return null;
}

/* ======================================================================== */

export default function AlertsPanel({ onClose }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSeverity, setNewSeverity] =
    useState<AlertSeverity>("warning");
  const [newMessage, setNewMessage] = useState("");
  const [newBuildingCode, setNewBuildingCode] = useState("");
  const [newBuildingName, setNewBuildingName] = useState("");
  const [newFloor, setNewFloor] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  /* ---------------- Load alerts JSON ---------------- */
  useEffect(() => {
    let cancelled = false;

    async function loadAlerts() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/data/alerts.json", {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as AlertsResponse;

        if (!cancelled) {
          const base = (json.alerts ?? []).map((a) => ({
            ...a,
            source: a.source ?? "system",
          }));
          setAlerts(base);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Impossible de charger les alertes d’accessibilité."
          );
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

  /* ---------------- Form submission ---------------- */
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitMessage(null);

    if (!newTitle.trim() || !newMessage.trim()) {
      setSubmitMessage("Merci de préciser un titre");
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
      "Merci pour votre signalement. Il est maintenant en cours de vérification."
    );
  }

  /* ======================================================================== */

  return (
    <aside
      className="
        pointer-events-auto absolute left-[90px] top-4
        w-[380px] max-h-[80vh]
        bg-white border border-neutral-200 shadow-xl
        rounded-2xl px-4 py-3 flex flex-col gap-3 overflow-y-auto
      "
      aria-label="Alertes d’accessibilité"
    >
      {/* -------- Header -------- */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            Alertes d’accessibilité
            {alerts.length > 0 && !loading && !error && (
              <span className="
                inline-flex items-center justify-center
                rounded-full bg-red-100 text-red-800
                text-[10px] px-2 py-0.5 font-medium
              ">
                {alerts.length}
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-500">
            Statut quasi temps réel des équipements accessibles.
          </p>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-base hover:bg-neutral-100"
        >
          ✕
        </button>
      </div>

      {/* CTA signalement */}
      <div className="
        border border-neutral-300 bg-neutral-50 rounded-xl
        px-3 py-2.5 mb-1
      ">
        <div className="text-[11px] font-medium text-neutral-800 mb-1">
          Vous avez constaté un nouveau danger ?
        </div>
        <p className="text-[11px] text-neutral-700 mb-2">
          Ascenseur en panne, porte bloquée, couloir obstrué…
        </p>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setSubmitMessage(null);
          }}
          className=" w-full  rounded-lg px-3 py-2 text-sm disabled:opacity-600 
            bg-amber-300 text-neutral-900 hover:bg-amber-400"
        >
          Signaler une nouvelle alerte
        </button>
      </div>





      {/* Formulaire de signalement — version améliorée WCAG + UX */}
{showForm && (
  <form
    onSubmit={handleSubmit}
    className="border border-neutral-300 bg-white rounded-xl px-4 py-4 mb-3 space-y-4"
  >
    <div className="text-base font-semibold text-neutral-900 mb-2">
      Nouveau signalement d’accessibilité
    </div>

    {/* TYPE DE PROBLÈME */}
    <div className="space-y-1">
      <label className="text-sm font-medium text-neutral-800">
        Type de problème*
      </label>
      <select
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
        onChange={(e) => setNewTitle(e.target.value)}
        value={newTitle}
        required
      >
        <option value="">Choisir…</option>
        <option value="Ascenseur hors service">Ascenseur hors service</option>
        <option value="Toilettes accessibles fermées">
          Toilettes accessibles fermées
        </option>
        <option value="Couloir ou passage bloqué">Couloir ou passage bloqué</option>
        <option value="Rampe glissante / dangereuse">
          Rampe glissante / dangereuse
        </option>
        <option value="Porte automatique défectueuse">
          Porte automatique défectueuse
        </option>
        <option value="Autre problème">Autre problème</option>
      </select>
    </div>

    {/* GRAVITÉ */}
    <div className="space-y-1">
      <label className="text-sm font-medium text-neutral-800">
        Gravité estimée*
      </label>
      <select
        value={newSeverity}
        onChange={(e) => setNewSeverity(e.target.value as AlertSeverity)}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
      >
        <option value="info">Information (mineur)</option>
        <option value="warning">Avertissement (gêne modérée)</option>
        <option value="danger">Critique (bloque l’accès)</option>
      </select>
    </div>

    {/* LIEU */}
  {/* CHAMPS AVEC LISTES DÉROULANTES AMÉLIORÉES */}
<div className="grid grid-cols-2 gap-3">

  {/* CODE BÂTIMENT */}
  <div className="space-y-1">
    <label className="text-sm font-medium text-neutral-800">
      Code bâtiment
    </label>
    <select
      value={newBuildingCode}
      onChange={(e) => setNewBuildingCode(e.target.value)}
      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
    >
      <option value="">Sélectionner…</option>
      <option value="UCU">UCU – Jock Turcot</option>
      <option value="STEM">STEM – Complexe STEM</option>
      <option value="CRX">CRX – Learning Crossroads</option>
      <option value="MRT">MRT – Marion</option>
      <option value="FSS">FSS – Faculté des sciences sociales</option>
      <option value="SMD">SMD – Simard</option>
      <option value="MRN">MRN – Morisset</option>
      <option value="MNT">MNT – Montpetit</option>
      <option value="DMS">DMS – Desmarais</option>
    </select>
  </div>

  {/* NOM OU ZONE */}
  <div className="space-y-1">
    <label className="text-sm font-medium text-neutral-800">
      Nom / zone
    </label>
    <select
      value={newBuildingName}
      onChange={(e) => setNewBuildingName(e.target.value)}
      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white"
    >
      <option value="">Sélectionner…</option>
      <option value="Entrée principale">Entrée principale</option>
      <option value="Ascenseur central">Ascenseur central</option>
      <option value="Ascenseur secondaire">Ascenseur secondaire</option>
      <option value="Toilettes accessibles">Toilettes accessibles</option>
      <option value="Couloir O7">Couloir O7</option>
      <option value="Couloir principal">Couloir principal</option>
      <option value="Porte automatique Est">Porte automatique Est</option>
      <option value="Porte automatique Ouest">Porte automatique Ouest</option>
      <option value="Rampe nord">Rampe nord</option>
      <option value="Escalier A">Escalier A</option>
      <option value="Escalier B">Escalier B</option>
    </select>
  </div>
</div>


    {/* ÉTAGE */}
    <div className="space-y-1">
      <label className="text-sm font-medium text-neutral-800">
        Étage (optionnel)
      </label>
      <input
        type="number"
        value={newFloor}
        onChange={(e) => setNewFloor(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        placeholder="Ex. 0, 1, 2…"
      />
    </div>

    {/* DESCRIPTION (OPTIONNELLE) */}
    <div className="space-y-1">
      <label className="text-sm font-medium text-neutral-800">
        Description (optionnelle)
      </label>
      <textarea
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm min-h-[90px]"
        placeholder="Ajoutez des détails utiles (facultatif)."
      />
    </div>

    {/* PHOTO */}
    <div className="space-y-1">
      <label className="text-sm font-medium text-neutral-800">
        Photo (optionnelle)
      </label>

      <div className="rounded-lg border border-neutral-300 px-3 py-2 bg-neutral-50">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFileName(f ? f.name : null);
          }}
          className="w-full text-sm"
        />
        {fileName && (
          <p className="text-base text-neutral-600 mt-1">
            Fichier sélectionné : <span className="font-medium">{fileName}</span>
          </p>
        )}
        <p className="text-base text-neutral-500 mt-1">
          La photo aide les équipes à vérifier plus rapidement.
        </p>
      </div>
    </div>

    {/* ACTIONS */}
    <div className="flex items-center justify-between pt-2">
      <button
        type="button"
        onClick={() => {
          setShowForm(false);
          setSubmitMessage(null);
        }}
        className="text-sm px-3 py-2 rounded-lg hover:bg-neutral-100"
      >
        Annuler
      </button>

      <button
        type="submit"
        className="text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
      >
        Envoyer
      </button>
    </div>

    {submitMessage && (
      <p className="mt-1 text-sm text-emerald-700">{submitMessage}</p>
    )}
  </form>
)}

      {/* Chargement */}
      {loading && (
        <div className="text-base text-neutral-500 italic py-4">
          Chargement…
        </div>
      )}

      {/* Erreur */}
      {error && !loading && (
        <div className="
          text-base text-red-700 bg-red-50 border border-red-200
          rounded-lg px-3 py-2
        ">
          {error}
        </div>
      )}

      {/* Aucune alerte */}
      {!loading && !error && alerts.length === 0 && (
        <div className="
          text-base text-neutral-800 bg-neutral-100 border border-neutral-300
          rounded-lg px-3 py-2
        ">
          Aucune alerte d’accessibilité active.
        </div>
      )}

      {/* Liste des alertes */}
      <div className="space-y-2">
        {alerts.map((a) => {
          const range = formatDateRange(a.startsAt, a.endsAt);
          const sev = a.severity;
          const isUser = a.source === "user";

          return (
            <article
              key={a.id}
              className={`
                border rounded-xl px-3 py-2.5 text-base
                flex flex-col gap-1.5
                ${severityClasses(sev)}
              `}
            >
              <div className="flex items-start justify-between">
                <div className="font-semibold">{a.title}</div>

                <span
                  className={`
                    inline-flex items-center h-5 px-2 rounded-full
                    text-[10px] font-semibold
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
                    <span className="text-neutral-700">
                      {" "}· étage {a.floor}
                    </span>
                  )}
                </div>
              )}

              <p className="text-[11px] leading-snug">{a.message}</p>

              <div className="flex items-center justify-between">
                {range ? (
                  <div className="text-[10px] text-neutral-700">{range}</div>
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

                <div className="text-[10px] text-neutral-600">
                  {isUser
                    ? "En cours de vérification"
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
