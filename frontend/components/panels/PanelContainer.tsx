"use client";

export default function PanelContainer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <aside
      className="absolute top-4 left-24 z-30 w-[360px] max-h-[84vh] bg-white/95 backdrop-blur-md border border-neutral-200 rounded-3xl shadow-xl overflow-hidden"
      role="dialog" aria-label={title}
    >
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl hover:bg-neutral-100"
          aria-label="Close panel"
        >
          ✕
        </button>
      </header>
      <div className="p-3 overflow-auto max-h-[74vh]">{children}</div>
    </aside>
  );
}
