"use client";

import { useState } from "react";
import {
  Building2,
  Layers3,
  History,
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
  { id: "categories", label: "Categories", icon: <Layers3 size={22} /> },
  { id: "history", label: "History", icon: <History size={22} /> },
  { id: "navigate", label: "Navigate", icon: <Navigation2 size={22} /> },
  { id: "alerts", label: "Alerts", icon: <TriangleAlert size={22} /> },
  { id: "events", label: "Events & News", icon: <Newspaper size={22} /> },
];

export default function Sidebar({
  onSelect,
  active,
}: {
  active?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [current, setCurrent] = useState(active ?? "buildings");

  const handleClick = (id: string) => {
    setCurrent(id);
    onSelect?.(id);
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
        aria-label="Menu"
      >
        ☰
      </button>

      {/* Liste d’icônes */}
      <div className="flex-1 flex flex-col items-center gap-4">
        {ITEMS.map((it) => {
          const isActive = current === it.id;
          return (
            <button
              key={it.id}
              onClick={() => handleClick(it.id)}
              className={`group flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl transition
                ${isActive ? "bg-neutral-200 text-black" : "text-neutral-600 hover:bg-neutral-100"}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span>{it.icon}</span>
              <span className="text-[11px] font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
