"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderTree, Layers, Grid3X3,
  History, Settings, Search, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COMMANDS = [
  { id: "dashboard",   label: "Go to Dashboard",   icon: LayoutDashboard, href: "/dashboard",   desc: "Select an ad account" },
  { id: "explorer",    label: "Go to Explorer",     icon: FolderTree,      href: "/explorer",    desc: "Browse and duplicate campaigns" },
  { id: "drafts",      label: "Go to Drafts",       icon: Layers,          href: "/drafts",      desc: "Edit and publish campaign drafts" },
  { id: "wide-create", label: "Go to Wide Create",  icon: Grid3X3,   href: "/wide-create", desc: "Build bulk campaign structures" },
  { id: "ai-create",   label: "Go to AI Create",    icon: Sparkles,  href: "/ai-create",   desc: "Describe your campaign — AI builds the drafts" },
  { id: "history",     label: "Go to History",      icon: History,   href: "/history",     desc: "Duplication and conversion job log" },
  { id: "settings",    label: "Go to Settings",     icon: Settings,        href: "/settings",    desc: "Account, team, and connection settings" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filtered = query.trim()
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.desc.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS;

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    const toggleHandler = () => setOpen(prev => !prev);
    window.addEventListener("keydown", keyHandler);
    window.addEventListener("adspawn:open-palette", toggleHandler);
    return () => {
      window.removeEventListener("keydown", keyHandler);
      window.removeEventListener("adspawn:open-palette", toggleHandler);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const close = () => setOpen(false);

  const execute = (cmd: typeof COMMANDS[number]) => {
    router.push(cmd.href);
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(activeIndex + 1, filtered.length - 1);
      setActiveIndex(next);
      itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      setActiveIndex(prev);
      itemRefs.current[prev]?.scrollIntoView({ block: "nearest" });
    }
    if (e.key === "Enter" && filtered[activeIndex]) execute(filtered[activeIndex]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]" onClick={close}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 bg-gray-900 border border-gray-700/60 rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60">
          <Search className="w-4 h-4 text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder:text-gray-600 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-gray-700/80 bg-gray-800/60 text-[10px] text-gray-500 font-mono select-none">
            Esc
          </kbd>
        </div>

        {/* Command list */}
        <div className="py-1.5 max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-600">
              No commands match &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                ref={el => { itemRefs.current[i] = el; }}
                onClick={() => execute(cmd)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  i === activeIndex ? "bg-blue-600/15" : "hover:bg-gray-800/40"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
                  i === activeIndex ? "bg-blue-500/20 text-blue-400" : "bg-gray-800/60 text-gray-500"
                )}>
                  <cmd.icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium transition-colors",
                    i === activeIndex ? "text-gray-100" : "text-gray-300"
                  )}>
                    {cmd.label}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5">{cmd.desc}</p>
                </div>
                {i === activeIndex && (
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-gray-700/80 bg-gray-800/60 text-[10px] text-gray-500 font-mono shrink-0 select-none">
                    ↵
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-800/40 flex items-center gap-4 text-[10px] text-gray-600">
          <span className="flex items-center gap-1">
            <kbd className="font-mono border border-gray-700/60 bg-gray-800/40 px-1 rounded">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono border border-gray-700/60 bg-gray-800/40 px-1 rounded">↵</kbd> open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono border border-gray-700/60 bg-gray-800/40 px-1 rounded">Esc</kbd> close
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="font-mono border border-gray-700/60 bg-gray-800/40 px-1 rounded">Ctrl+K</kbd> toggle
          </span>
        </div>
      </div>
    </div>
  );
}
