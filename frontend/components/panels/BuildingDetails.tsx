"use client";

import Image from "next/image";

type Feature = {
  id?: string | number;
  properties?: Record<string, any>;
  geometry?: any;
};

export default function BuildingDetails({
  feature,
  onClose,
}: {
  feature: Feature | null;
  onClose: () => void;
}) {
  if (!feature) return null;

  const p = feature.properties ?? {};

  // Libellés
  const title =
    p["name:fr"] ?? p["name:en"] ?? p.name ?? "Building";
  const code = p.code ?? p["name:short"] ?? "";
  const hours = p.opening_hours ?? "—";
  const phone = p.phone ?? p["contact:phone"] ?? null;
  const website = p.website ?? p["contact:website"] ?? null;

  // Mini-image si tu en as dans les props (sinon on met un placeholder)
  const thumb =
    p.image ??
    "https://placehold.co/160x120/png?text=Building";

  return (
    <aside className="absolute right-4 top-4 bottom-4 z-40 w-[420px] max-w-[92vw] bg-white/95 backdrop-blur-lg border border-neutral-200 rounded-3xl shadow-2xl overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={onClose}
          className="mr-1 rounded-full w-9 h-9 flex items-center justify-center hover:bg-neutral-100"
          aria-label="Close details"
          title="Close"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold">Building Details</h2>
      </div>

      {/* Cover */}
      <div className="relative h-40 w-full bg-neutral-200">
        {/* si tu mets de vraies images de couverture, remplace ceci */}
        {/* <Image src={coverUrl} fill alt="" className="object-cover" /> */}
      </div>

      {/* Body */}
      <div className="p-4 space-y-6">
        <div className="flex items-start gap-3">
          <img
            src={thumb}
            alt=""
            className="w-14 h-14 rounded-xl object-cover border"
          />
          <div className="flex-1">
            <div className="text-2xl font-semibold leading-tight">{title}</div>
            {!!code && (
              <div className="text-sm text-neutral-500 mt-0.5">{code}</div>
            )}
          </div>

          {/* Actions (share/nav placeholders) */}
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border px-3 py-1.5 text-sm hover:bg-neutral-50"
              title="Directions"
            >
              🧭
            </button>
            <button
              className="rounded-full border px-3 py-1.5 text-sm hover:bg-neutral-50"
              title="Share"
            >
              ↗
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <section className="border rounded-2xl p-4">
            <div className="text-sm font-medium mb-2">Working Hours</div>
            <div className="text-[15px]">{hours}</div>
          </section>

          <section className="border rounded-2xl p-4 space-y-2">
            <div className="text-sm font-medium">Phone</div>
            <div className="text-[15px]">
              {phone ? (
                <a href={`tel:${phone}`} className="text-blue-600 hover:underline">
                  {phone}
                </a>
              ) : (
                "—"
              )}
            </div>
          </section>

          <section className="border rounded-2xl p-4 space-y-2">
            <div className="text-sm font-medium">Website</div>
            <div className="text-[15px] break-words">
              {website ? (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {website}
                </a>
              ) : (
                "—"
              )}
            </div>
          </section>
        </div>

        {/* Extra: tu peux afficher les propriétés brutes si besoin */}
        {/* <pre className="text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl overflow-x-auto">
          {JSON.stringify(p, null, 2)}
        </pre> */}
      </div>
    </aside>
  );
}
