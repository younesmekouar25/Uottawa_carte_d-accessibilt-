"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Navigation2,
  TriangleAlert,
  Newspaper,
} from "lucide-react";

type Item = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const ITEMS: Item[] = [
  { id: "buildings", label: "Buildings", icon: <Building2 size={22} /> },
  { id: "navigate", label: "Navigate", icon: <Navigation2 size={22} /> },
  { id: "alerts", label: "Alerts", icon: <TriangleAlert size={22} /> },
  { id: "events", label: "Events & News", icon: <Newspaper size={22} /> },
];

export default function Sidebar({
  active,
  onSelect,
}: {
  active?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  // état interne synchronisé avec Home
  const [current, setCurrent] = useState<string | null>(active ?? null);

  // si Home modifie 'active', on met à jour le sidebar
  useEffect(() => {
    setCurrent(active ?? null);
  }, [active]);

  // toggle : ouvrir / fermer
  const handleClick = (id: string) => {
    if (current === id) {
      // 🔥 toggle OFF
      setCurrent(null);
      onSelect?.(null);
    } else {
      // 🔥 toggle ON
      setCurrent(id);
      onSelect?.(id);
    }
  };

  return (
    <aside
      className="absolute left-4 top-4 bottom-4 z-20 w-[72px] bg-white/90 backdrop-blur-lg border border-neutral-200 rounded-3xl shadow-lg flex flex-col items-center py-4"
      aria-label="Sidebar navigation"
    >
      {/* Menu bouton */}
      <button
        className="mb-4 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-neutral-100"
        title="Menu"
      >
        ☰
      </button>

      {/* Icones */}
      <div className="flex-1 flex flex-col items-center gap-4 overflow-y-auto">
        {ITEMS.map((it) => {
          const isActive = current === it.id;

          return (
            <button
              key={it.id}
              onClick={() => handleClick(it.id)}
              className={`group flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl transition
                ${
                  isActive
                    ? "bg-neutral-200 text-black"
                    : "text-neutral-600 hover:bg-neutral-100"
                }
              `}
            >
              <span>{it.icon}</span>
              <span className="text-[11px] font-medium text-center leading-tight">
                {it.label}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
