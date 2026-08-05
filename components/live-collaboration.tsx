"use client";

import { Circle, Users, WifiOff } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Person = { userId: string; email: string; page: string; activity: string; online_at: string };
const watched = ["guests", "households", "rsvp_submissions", "guest_table_assignments", "tables", "budget_items", "payment_records", "suppliers", "tasks", "timeline_items", "documents", "music_items", "venue_layouts", "venue_objects"];
const pageLabel = (path: string) => path === "/dashboard" ? "Dashboard" : path.split("/")[1]?.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase()) || "Wedding HQ";

export function LiveCollaboration({ weddingId, userId, email }: { weddingId?: string; userId: string; email: string }) {
  const path = usePathname();
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "offline">("connecting");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!weddingId) return;
    const supabase = createClient();
    const presence = supabase.channel(`wedding:${weddingId}:presence`, { config: { presence: { key: userId } } });
    const records = supabase.channel(`wedding:${weddingId}:records`);
    presence.on("presence", { event: "sync" }, () => {
      const state = presence.presenceState<Person>();
      setPeople(Object.values(state).flat().filter((person) => person.userId !== userId));
    });
    presence.subscribe(async (next) => {
      if (next === "SUBSCRIBED") {
        setStatus("connected");
        await presence.track({ userId, email, page: path, activity: `Viewing ${pageLabel(path)}`, online_at: new Date().toISOString() });
      }
      if (next === "CHANNEL_ERROR" || next === "TIMED_OUT") setStatus("offline");
    });
    watched.forEach((table) => records.on("postgres_changes", { event: "*", schema: "public", table, filter: `wedding_id=eq.${weddingId}` }, (payload) => {
      const changedByMe = (payload.new as Record<string, unknown> | undefined)?.updated_by === userId;
      if (changedByMe) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("wedding-hq:remote-change", { detail: { table, payload } }));
        router.refresh();
      }, 650);
    }));
    records.subscribe();
    const visibility = () => {
      if (document.hidden) presence.untrack();
      else presence.track({ userId, email, page: path, activity: `Viewing ${pageLabel(path)}`, online_at: new Date().toISOString() });
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", visibility);
      presence.untrack();
      supabase.removeChannel(presence);
      supabase.removeChannel(records);
    };
  }, [weddingId, userId, email, path, router]);

  if (!weddingId) return null;
  return <details className="presence-menu">
    <summary className={`presence-chip ${status}`} title="Wedding collaborators">
      {status === "offline" ? <WifiOff /> : <Users />}
      <span>{status === "connecting" ? "Connecting…" : status === "offline" ? "Offline" : people.length ? `${people.length + 1} online` : "You’re online"}</span>
      {people.slice(0, 3).map((person) => <i key={person.userId}>{person.email.slice(0, 2).toUpperCase()}</i>)}
      {people.length > 3 && <b>+{people.length - 3}</b>}
    </summary>
    <div className="presence-popover">
      <header><strong>Working together</strong><small>{status === "connected" ? "Live updates are connected" : "Trying to reconnect"}</small></header>
      <div><span className="avatar">{email.slice(0, 2)}</span><p><strong>You</strong><small>Viewing {pageLabel(path)}</small></p><em><Circle />Live</em></div>
      {people.map((person) => <div key={person.userId}><span className="avatar">{person.email.slice(0, 2)}</span><p><strong>{person.email.split("@")[0]}</strong><small>{person.activity || `Viewing ${pageLabel(person.page)}`}</small></p><em><Circle />Live</em></div>)}
      {!people.length && <p className="presence-empty">Other wedding users will appear here when they open Wedding HQ.</p>}
    </div>
  </details>;
}
