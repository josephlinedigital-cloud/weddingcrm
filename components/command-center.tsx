"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Armchair,
  ArrowRight,
  BarChart3,
  Clock3,
  FileText,
  LayoutDashboard,
  ListTodo,
  MailCheck,
  Music2,
  Plus,
  Search,
  Settings,
  Sparkles,
  Store,
  Users,
  WalletCards,
  X,
} from "lucide-react";

type SearchResult = { id: string; title: string; subtitle: string; href: string; type: string };
type Command = SearchResult & { icon?: React.ComponentType<{ className?: string }> };

const destinations: Command[] = [
  ["Dashboard", "/dashboard", LayoutDashboard], ["Guests", "/guests", Users], ["RSVPs", "/rsvps", MailCheck],
  ["Tables", "/tables", Armchair], ["Budget", "/budget", WalletCards], ["Suppliers", "/suppliers", Store],
  ["Timeline", "/timeline", Clock3], ["Tasks", "/tasks", ListTodo], ["Documents", "/documents", FileText],
  ["Music", "/music", Music2], ["Reports", "/reports", BarChart3], ["Settings", "/settings", Settings],
].map(([title, href, icon]) => ({ id: href as string, title: title as string, subtitle: "Go to page", href: href as string, type: "Navigation", icon: icon as Command["icon"] }));

const createActions: Command[] = [
  { id: "new-guest", title: "Add a guest", subtitle: "Open the guest form", href: "/guests?new=1", type: "Quick create", icon: Plus },
  { id: "new-task", title: "Create a task", subtitle: "Add a planning action", href: "/tasks?new=1", type: "Quick create", icon: Plus },
  { id: "new-supplier", title: "Add a supplier", subtitle: "Create a supplier record", href: "/suppliers?new=1", type: "Quick create", icon: Plus },
  { id: "new-song", title: "Add a song", subtitle: "Update the wedding soundtrack", href: "/music?new=1", type: "Quick create", icon: Plus },
];

const shortcutRoutes: Record<string, string> = { g: "/guests", t: "/tasks", b: "/budget", s: "/suppliers" };

export function CommandCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const editing = target.matches("input, textarea, select, [contenteditable='true']");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (!editing && event.key === "/") {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (!editing && !event.metaKey && !event.ctrlKey && !event.altKey && shortcutRoutes[event.key.toLowerCase()]) {
        router.push(shortcutRoutes[event.key.toLowerCase()]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const body = response.ok ? await response.json() : { results: [] };
        setResults(body.results || []);
        setActive(0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  const visible = useMemo<Command[]>(() => {
    const term = query.trim().toLowerCase();
    if (term.length >= 2) return results;
    if (term) return [...createActions, ...destinations].filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(term));
    return [...createActions, ...destinations.slice(0, 7)];
  }, [query, results]);

  function choose(item: Command) {
    setOpen(false);
    router.push(item.href);
  }

  function handleDialogKey(event: React.KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, visible.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
    if (event.key === "Enter" && visible[active]) { event.preventDefault(); choose(visible[active]); }
  }

  return (
    <>
      <button className="command-trigger" type="button" onClick={() => setOpen(true)} aria-label="Search Wedding HQ">
        <Search />
        <span>Search anything</span>
        <kbd>⌘ K</kbd>
      </button>
      {open && (
        <div className="command-layer" role="dialog" aria-modal="true" aria-label="Search and commands" onKeyDown={handleDialogKey}>
          <button className="command-backdrop" onClick={() => setOpen(false)} aria-label="Close search" />
          <section className="command-panel">
            <header className="command-input-wrap">
              <Search />
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guests, tasks, suppliers and more…" aria-label="Search Wedding HQ" />
              {loading ? <span className="command-spinner" aria-label="Searching" /> : <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X /></button>}
            </header>
            <div className="command-results" role="listbox" aria-label="Results">
              {visible.length ? visible.map((item, index) => {
                const Icon = item.icon || Sparkles;
                return <button key={`${item.type}-${item.id}`} className={index === active ? "active" : ""} onMouseEnter={() => setActive(index)} onClick={() => choose(item)} role="option" aria-selected={index === active}>
                  <span className="command-icon"><Icon /></span>
                  <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                  <em>{item.type}</em><ArrowRight />
                </button>;
              }) : <div className="command-empty"><Search /><strong>No matches</strong><span>Try a name, task, supplier or document.</span></div>}
            </div>
            <footer><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></footer>
          </section>
        </div>
      )}
    </>
  );
}
