"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const SECTIONS = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], desc: "Open command palette" },
      { keys: ["?"],        desc: "Open this keyboard reference" },
    ],
  },
  {
    title: "Drafts page",
    shortcuts: [
      { keys: ["⌘", "↵"], desc: "Publish selected drafts" },
    ],
  },
  {
    title: "Workflow",
    shortcuts: [
      { keys: ["1"],  desc: "Explorer → select campaigns → Save as Draft" },
      { keys: ["2"],  desc: "Drafts → validate → Publish" },
    ],
    note: true,
  },
];

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "Escape") { setOpen(false); return; }
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "?") setOpen(prev => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-gray-900 border border-gray-700/60 rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
          <p className="text-sm font-semibold text-gray-200">Keyboard shortcuts</p>
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-gray-600 hover:text-gray-400 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-2">
                {section.title}
              </p>
              <div className="space-y-1.5">
                {section.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <span className="text-xs text-gray-400">{s.desc}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          className="inline-flex items-center px-1.5 py-0.5 rounded border border-gray-700/80 bg-gray-800/60 text-[10px] text-gray-400 font-mono select-none min-w-[20px] justify-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {section.note && (
                <p className="text-[10px] text-gray-600 mt-2">
                  These are the workflow steps, not literal key presses.
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="px-4 py-2.5 border-t border-gray-800/40">
          <p className="text-[10px] text-gray-600">
            Press <kbd className="font-mono border border-gray-700/60 bg-gray-800/40 px-1 rounded text-[9px]">?</kbd> or{" "}
            <kbd className="font-mono border border-gray-700/60 bg-gray-800/40 px-1 rounded text-[9px]">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
