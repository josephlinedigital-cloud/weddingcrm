"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Armchair,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  Clock3,
  Files,
  LayoutDashboard,
  ListTodo,
  MailCheck,
  Menu,
  Mic2,
  Music2,
  PanelLeft,
  Settings,
  Store,
  Users,
  WalletCards,
  X,
} from "lucide-react";

type NavigationItem = readonly [string, string, React.ComponentType<{ className?: string }>];

const overview: NavigationItem[] = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["Calendar", "/calendar", CalendarDays],
  ["Guests", "/guests", Users],
  ["RSVPs", "/rsvps", MailCheck],
];

const planning: NavigationItem[] = [
  ["Tables", "/tables", Armchair],
  ["Budget", "/budget", WalletCards],
  ["Suppliers", "/suppliers", Store],
  ["Entertainment", "/entertainment", Mic2],
  ["Timeline", "/timeline", Clock3],
  ["Tasks", "/tasks", ListTodo],
  ["Documents", "/documents", Files],
  ["Music", "/music", Music2],
  ["Reports", "/reports", BarChart3],
];

const mobilePrimary: NavigationItem[] = [overview[0], overview[1], overview[2], planning[5]];

export function Sidebar({ hasWedding = true }: { hasWedding?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("wedding-hq-sidebar-collapsed") === "true";
    setCollapsed(saved);
    document.documentElement.dataset.sidebar = saved ? "collapsed" : "expanded";
    return () => { delete document.documentElement.dataset.sidebar; };
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem("wedding-hq-sidebar-collapsed", String(next));
    document.documentElement.dataset.sidebar = next ? "collapsed" : "expanded";
  }

  function render(item: NavigationItem, mobile = false) {
    const [label, href, Icon] = item;
    const disabled = !hasWedding && href !== "/dashboard";
    const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        key={`${mobile ? "mobile" : "desktop"}-${href}`}
        className={`nav-link ${active ? "active" : ""} ${disabled ? "disabled" : ""}`}
        href={disabled ? "/dashboard" : href}
        aria-current={active ? "page" : undefined}
        aria-disabled={disabled}
        title={collapsed && !mobile ? label : undefined}
      >
        <Icon />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-head">
          <Link className="brand" href="/dashboard" aria-label="Wedding HQ dashboard">
            <span className="brand-mark">WH</span>
            <span className="brand-copy">
              <span className="brand-name">Wedding HQ</span>
              <span className="brand-caption">Private planner</span>
            </span>
          </Link>
          <button className="sidebar-toggle" onClick={toggleSidebar} type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeft /> : <ChevronLeft />}
          </button>
        </div>
        <nav className="desktop-navigation">
          <div className="nav-group">
            <p className="nav-label">Overview</p>
            {overview.map((item) => render(item))}
          </div>
          <div className="nav-group">
            <p className="nav-label">Planning</p>
            {planning.map((item) => render(item))}
          </div>
          <div className="nav-group nav-manage">
            <p className="nav-label">Workspace</p>
            {render(["Settings", "/settings", Settings])}
          </div>
        </nav>
      </aside>

      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {mobilePrimary.map((item) => render(item, true))}
        <button className={`nav-link ${mobileOpen ? "active" : ""}`} type="button" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen}>
          <Menu />
          <span>More</span>
        </button>
      </nav>

      {mobileOpen && (
        <div className="mobile-menu-layer" role="dialog" aria-modal="true" aria-label="All planning areas">
          <button className="mobile-menu-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
          <section className="mobile-menu-sheet">
            <header>
              <div>
                <p className="eyebrow">Wedding HQ</p>
                <h2>All planning areas</h2>
              </div>
              <button className="button button-secondary icon-button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></button>
            </header>
            <div className="mobile-menu-grid">
              {[...overview.filter((item) => !mobilePrimary.includes(item)), ...planning.filter((item) => !mobilePrimary.includes(item)), ["Settings", "/settings", Settings] as NavigationItem].map((item) => render(item, true))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
