import Link from "next/link";
import { Armchair, CalendarDays, Check, CircleDollarSign, Clock3, FileText, Store, UserPlus } from "lucide-react";
import { createWedding } from "./actions";
import { DashboardAddMenu, DashboardPriorities, type DashboardPriority } from "@/components/dashboard-controls";
import type { CalendarEvent } from "@/lib/calendar";
import { calendarCategoryLabel } from "@/lib/calendar";
import { formatDate, formatMoney, getWeddingContext } from "@/lib/wedding";

type Guest = { id: string; first_name: string; last_name: string; rsvp_status: string; meal_option_id: string | null; dietary_requirements: string | null; allergies: string | null };
type Budget = { id: string; name: string; estimated_amount: number; quoted_amount: number; final_amount: number; amount_paid: number; payment_due_date: string | null; payment_status: string; supplier_id: string | null; suppliers: { business_name: string } | null };
type Task = { id: string; status: string; due_date: string | null; title: string; priority: string; assigned_user_id: string | null; supplier_id: string | null; description: string | null; suppliers: { business_name: string } | null };
type Timeline = { id: string; title: string; description: string | null; event_date: string | null; start_time: string | null; end_time: string | null; status: string; assigned_user_id: string | null; location: string | null; category: string | null; supplier_id: string | null; suppliers: { business_name: string } | null };
type Activity = { id: string; action: string; description: string | null; entity_type: string | null; created_at: string };
type Upcoming = { id: string; source: string; date: string; time?: string; title: string; category: string; detail?: string; href: string };
type GuestAttention = { id: string; name: string; issue: string; urgency: number };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const { supabase, wedding, membership, error: membershipError } = await getWeddingContext();
  if (!membership || !wedding) return <Setup error={params.error || membershipError?.message} />;

  const today = new Date(); const todayIso = today.toISOString().slice(0, 10); const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7); const weekEndIso = weekEnd.toISOString().slice(0, 10);
  const [guestRes, budgetRes, taskRes, activityRes, assignmentRes, tableRes, timelineRes, supplierRes, settingsRes] = await Promise.all([
    supabase.from("guests").select("id,first_name,last_name,rsvp_status,meal_option_id,dietary_requirements,allergies").eq("wedding_id", wedding.id),
    supabase.from("budget_items").select("id,name,estimated_amount,quoted_amount,final_amount,amount_paid,payment_due_date,payment_status,supplier_id,suppliers(business_name)").eq("wedding_id", wedding.id),
    supabase.from("tasks").select("id,status,due_date,title,priority,assigned_user_id,supplier_id,description,suppliers(business_name)").eq("wedding_id", wedding.id),
    supabase.from("activity_log").select("id,action,description,entity_type,created_at").eq("wedding_id", wedding.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("guest_table_assignments").select("guest_id,table_id").eq("wedding_id", wedding.id),
    supabase.from("tables").select("id,name,capacity").eq("wedding_id", wedding.id),
    supabase.from("timeline_items").select("id,title,description,event_date,start_time,end_time,status,assigned_user_id,location,category,supplier_id,suppliers(business_name)").eq("wedding_id", wedding.id).not("event_date", "is", null),
    supabase.from("suppliers").select("id,business_name,next_payment_date").eq("wedding_id", wedding.id),
    supabase.from("app_settings").select("value").eq("wedding_id", wedding.id).eq("key", "calendar_events_v1").maybeSingle(),
  ]);
  const queryError = [guestRes.error, budgetRes.error, taskRes.error, activityRes.error, assignmentRes.error, tableRes.error, timelineRes.error, supplierRes.error, settingsRes.error].find(Boolean);
  const guests = (guestRes.data || []) as Guest[]; const budgets = (budgetRes.data || []) as unknown as Budget[]; const tasks = (taskRes.data || []) as unknown as Task[]; const timeline = (timelineRes.data || []) as unknown as Timeline[]; const activity = (activityRes.data || []) as Activity[]; const tables = tableRes.data || [];
  const assigned = new Set((assignmentRes.data || []).map((item) => item.guest_id));
  const confirmed = guests.filter((guest) => guest.rsvp_status === "attending").length; const declined = guests.filter((guest) => guest.rsvp_status === "declined").length; const awaiting = guests.filter((guest) => ["not_sent", "invited", "awaiting", "maybe"].includes(guest.rsvp_status)).length;
  const committed = budgets.reduce((sum, item) => sum + Number(item.final_amount || item.quoted_amount || item.estimated_amount || 0), 0); const paid = budgets.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0); const budgetRemaining = Math.max(Number(wedding.budget_target || 0) - committed, 0);
  const openTasks = tasks.filter((task) => !["completed", "cancelled"].includes(task.status)); const overdue = openTasks.filter((task) => task.due_date && task.due_date < todayIso); const dueToday = openTasks.filter((task) => task.due_date === todayIso); const dueWeek = openTasks.filter((task) => task.due_date && task.due_date > todayIso && task.due_date <= weekEndIso);
  const priorities: DashboardPriority[] = [...overdue, ...dueToday, ...dueWeek].sort((a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"))).slice(0, 5).map((task) => ({ id: task.id, title: task.title, dueLabel: task.due_date ? `${task.due_date < todayIso ? "Was due" : task.due_date === todayIso ? "Due today" : "Due"} ${task.due_date === todayIso ? "" : formatDate(task.due_date)}`.trim() : "No due date", priority: task.priority, attention: task.due_date! < todayIso ? "overdue" : task.due_date === todayIso ? "today" : "week" }));
  const weddingDay = new Date(`${wedding.wedding_date}T12:00:00`); const days = Math.max(0, Math.ceil((weddingDay.getTime() - today.getTime()) / 86400000));
  const attendingAssigned = guests.filter((guest) => guest.rsvp_status === "attending" && assigned.has(guest.id)).length; const unassigned = Math.max(confirmed - attendingAssigned, 0); const tableCapacity = tables.reduce((sum, table) => sum + Number(table.capacity || 0), 0); const seatsRemaining = Math.max(tableCapacity - attendingAssigned, 0);
  const rsvpPct = guests.length ? Math.round(((confirmed + declined) / guests.length) * 100) : 0;
  const nextPayments = budgets.filter((item) => item.payment_due_date && item.payment_due_date >= todayIso && item.payment_status !== "paid").sort((a, b) => String(a.payment_due_date).localeCompare(String(b.payment_due_date))).slice(0, 3);
  const nextPayment = nextPayments[0];

  const customValue = settingsRes.data?.value as { events?: CalendarEvent[] } | null;
  const upcomingCandidates: Upcoming[] = [
    ...tasks.filter((task) => task.due_date && task.due_date >= todayIso && !["completed", "cancelled"].includes(task.status)).map((task) => ({ id: task.id, source: "task", date: task.due_date!, title: task.title, category: "Task", detail: task.suppliers?.business_name || undefined, href: "/tasks" })),
    ...budgets.filter((item) => item.payment_due_date && item.payment_due_date >= todayIso && item.payment_status !== "paid").map((item) => ({ id: item.id, source: "payment", date: item.payment_due_date!, title: `Payment · ${item.name}`, category: "Payment", detail: item.suppliers?.business_name || undefined, href: "/budget" })),
    ...timeline.filter((item) => item.event_date && item.event_date >= todayIso && item.status !== "cancelled").map((item) => ({ id: item.id, source: "timeline", date: item.event_date!, time: item.start_time?.slice(0, 5), title: item.title, category: item.category || "Timeline", detail: item.suppliers?.business_name || item.location || undefined, href: "/calendar" })),
    ...((Array.isArray(customValue?.events) ? customValue.events : []).filter((event) => event.date >= todayIso && !["completed", "cancelled"].includes(event.status)).map((event) => ({ id: event.id, source: "custom", date: event.date, time: event.startTime, title: event.title, category: calendarCategoryLabel(event.category), detail: event.supplierName || event.assignedLabel || undefined, href: `/calendar?view=day&date=${event.date}` }))),
    { id: "wedding-date", source: "wedding", date: wedding.wedding_date, time: wedding.ceremony_time?.slice(0, 5), title: wedding.couple_names, category: "Wedding", detail: wedding.venue || undefined, href: `/calendar?view=day&date=${wedding.wedding_date}` },
    ...(wedding.rsvp_deadline && wedding.rsvp_deadline >= todayIso ? [{ id: "rsvp-deadline", source: "wedding", date: wedding.rsvp_deadline, title: "RSVP deadline", category: "Deadline", href: `/calendar?view=day&date=${wedding.rsvp_deadline}` }] : []),
  ];
  const upcoming = upcomingCandidates.sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`)).filter((item, index, items) => items.findIndex((candidate) => candidate.source === item.source && candidate.id === item.id) === index).slice(0, 5);

  const attention = new Map<string, GuestAttention>();
  function flagGuest(guest: Guest, issue: string, urgency: number) { if (!attention.has(guest.id)) attention.set(guest.id, { id: guest.id, name: `${guest.first_name} ${guest.last_name}`.trim(), issue, urgency }); }
  guests.filter((guest) => ["not_sent", "invited", "awaiting", "maybe"].includes(guest.rsvp_status)).forEach((guest) => flagGuest(guest, "RSVP still needed", 4));
  guests.filter((guest) => guest.rsvp_status === "attending" && !guest.meal_option_id).forEach((guest) => flagGuest(guest, "Meal choice missing", 3));
  guests.filter((guest) => Boolean(guest.dietary_requirements?.trim() || guest.allergies?.trim())).forEach((guest) => flagGuest(guest, "Dietary details to review", 2));
  guests.filter((guest) => guest.rsvp_status === "attending" && !assigned.has(guest.id)).forEach((guest) => flagGuest(guest, "No table assigned", 1));
  const guestAttention = Array.from(attention.values()).sort((a, b) => b.urgency - a.urgency).slice(0, 5);
  const hrefForActivity = (item: Activity) => item.entity_type === "task" ? "/tasks" : item.entity_type === "guest" ? "/guests" : item.entity_type === "budget_item" ? "/budget" : item.entity_type === "table" ? "/tables" : item.entity_type === "supplier" ? "/suppliers" : item.entity_type === "timeline_item" ? "/timeline" : "/dashboard";

  return <div className="page editorial-dashboard">
    <header className="editorial-wedding-header">
      <div><p className="eyebrow">Wedding overview</p><h1>{wedding.couple_names}</h1></div>
      <dl><div><dt>Date</dt><dd>{formatDate(wedding.wedding_date)}</dd></div><div><dt>Venue</dt><dd>{wedding.venue || "Venue not set"}</dd></div><div><dt>Countdown</dt><dd><strong>{days}</strong> days to go</dd></div></dl>
      <DashboardAddMenu />
    </header>
    {queryError && <div className="alert alert-error">Some dashboard data could not be loaded: {queryError.message}</div>}

    <nav className="editorial-overview-strip" aria-label="Wedding overview metrics">
      <Link href="/guests"><span>Guests confirmed</span><strong>{confirmed}</strong></Link>
      <Link href="/rsvps"><span>Awaiting RSVP</span><strong>{awaiting}</strong></Link>
      <Link href="/budget"><span>Budget remaining</span><strong>{formatMoney(budgetRemaining, wedding.currency)}</strong></Link>
      <Link href="/tasks"><span>Open tasks</span><strong>{openTasks.length}</strong></Link>
      <Link href="/tables"><span>Unassigned guests</span><strong>{unassigned}</strong></Link>
    </nav>

    <section className="editorial-focus-grid">
      <article className="editorial-surface editorial-coming-up"><SectionHeading title="Coming Up" note="Your next events and deadlines" href="/calendar" link="View calendar" />{upcoming.length ? <div className="editorial-event-list">{upcoming.map((item) => <Link href={item.href} key={`${item.source}-${item.id}`}><time><strong>{new Date(`${item.date}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date(`${item.date}T12:00:00`))}</span></time><div><strong>{item.title}</strong><span>{item.time || "All day"}{item.detail ? ` · ${item.detail}` : ""}</span></div><em>{item.category}</em></Link>)}</div> : <Empty text="Nothing is scheduled yet." href="/calendar?new=1" action="Add an event" />}</article>
      <article className="editorial-surface editorial-priorities"><SectionHeading title="Your Priorities" note={`${overdue.length} overdue · ${dueToday.length} due today · ${dueWeek.length} this week`} /><DashboardPriorities initialItems={priorities} /></article>
    </section>

    <section className="editorial-surface editorial-guest-section">
      <div className="editorial-rsvp-panel"><SectionHeading title="RSVP Progress" note={`${confirmed + declined} of ${guests.length} guests have responded`} href="/rsvps" link="Open inbox" /><div className="editorial-response-score"><strong>{rsvpPct}%</strong><span>response rate</span></div><div className="editorial-rsvp-bar" aria-label={`${rsvpPct}% of guests have responded`}><i style={{ width: `${guests.length ? confirmed / guests.length * 100 : 0}%` }} /><i style={{ width: `${guests.length ? declined / guests.length * 100 : 0}%` }} /></div><dl className="editorial-rsvp-totals"><div><dt>Confirmed</dt><dd>{confirmed}</dd></div><div><dt>Awaiting</dt><dd>{awaiting}</dd></div><div><dt>Declined</dt><dd>{declined}</dd></div></dl></div>
      <div className="editorial-guest-attention"><SectionHeading title="Guest Attention" note="The most important details to resolve" href="/guests" link="View guest list" />{guestAttention.length ? <div>{guestAttention.map((guest) => <Link href={`/guests/${guest.id}`} key={guest.id}><span>{guest.name}</span><em>{guest.issue}</em></Link>)}</div> : <Empty text="No guest details need attention." href="/guests" action="View guests" />}</div>
    </section>

    <section className="editorial-surface editorial-budget"><SectionHeading title="Budget" note="A concise view of your wedding finances" href="/budget" link="View full budget" /><div className="editorial-budget-summary"><div><span>Total budget</span><strong>{formatMoney(wedding.budget_target, wedding.currency)}</strong></div><div><span>Amount paid</span><strong>{formatMoney(paid, wedding.currency)}</strong></div><div><span>Amount remaining</span><strong>{formatMoney(budgetRemaining, wedding.currency)}</strong></div><div><span>Next payment due</span><strong>{nextPayment ? formatDate(nextPayment.payment_due_date) : "Nothing scheduled"}</strong></div></div><div className="editorial-budget-progress"><i style={{ width: `${Math.min(100, wedding.budget_target ? paid / wedding.budget_target * 100 : 0)}%` }} /></div>{nextPayments.length ? <div className="editorial-payment-list">{nextPayments.map((item) => <Link href="/budget" key={item.id}><span>{formatDate(item.payment_due_date)}</span><div><strong>{item.name}</strong><small>{item.suppliers?.business_name || "Wedding payment"}</small></div><em>{formatMoney(Math.max(Number(item.final_amount || item.quoted_amount || item.estimated_amount || 0) - Number(item.amount_paid || 0), 0), wedding.currency)}</em></Link>)}</div> : <Empty text="No upcoming payments are scheduled." href="/budget" action="Open budget" />}</section>

    <section className="editorial-lower-grid">
      <article className="editorial-surface editorial-seating"><SectionHeading title="Seating Snapshot" note="A simple view of seating readiness" href="/tables" link="Open seating planner" /><dl><div><dt>Tables created</dt><dd>{tables.length}</dd></div><div><dt>Guests assigned</dt><dd>{attendingAssigned}</dd></div><div><dt>Guests unassigned</dt><dd>{unassigned}</dd></div><div><dt>Seats remaining</dt><dd>{seatsRemaining}</dd></div></dl><div className="editorial-seat-line"><i style={{ width: `${confirmed ? attendingAssigned / confirmed * 100 : 0}%` }} /></div></article>
      <article className="editorial-surface editorial-activity"><SectionHeading title="Recent Activity" note="Latest changes across your plans" />{activity.length ? <div>{activity.map((item) => <Link href={hrefForActivity(item)} key={item.id}><ActivityIcon type={item.entity_type} /><span>{(item.description || item.action.replaceAll("_", " ")).replace(/\s+null\b/gi, "")}</span><time>{relativeTime(item.created_at)}</time></Link>)}</div> : <Empty text="Activity will appear here as you plan." href="/tasks" action="Open tasks" />}</article>
    </section>
  </div>;
}

function SectionHeading({ title, note, href, link }: { title: string; note: string; href?: string; link?: string }) { return <header className="editorial-section-heading"><div><h2>{title}</h2><p>{note}</p></div>{href && link && <Link href={href}>{link}</Link>}</header>; }
function Empty({ text, href, action }: { text: string; href: string; action: string }) { return <div className="editorial-empty"><p>{text}</p><Link href={href}>{action}</Link></div>; }
function ActivityIcon({ type }: { type: string | null }) { const Icon = type === "guest" ? UserPlus : type === "budget_item" ? CircleDollarSign : type === "table" ? Armchair : type === "supplier" ? Store : type === "timeline_item" ? CalendarDays : type === "document" ? FileText : type === "task" ? Check : Clock3; return <span><Icon /></span>; }
function relativeTime(value: string) { const delta = new Date(value).getTime() - Date.now(); const minutes = Math.round(delta / 60000); if (Math.abs(minutes) < 60) return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(minutes, "minute"); const hours = Math.round(minutes / 60); if (Math.abs(hours) < 24) return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(hours, "hour"); return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(hours / 24), "day"); }

function Setup({ error }: { error?: string }) { return <div className="page setup-page"><div className="card setup-card"><span className="brand-mark">WH</span><p className="eyebrow">One last step</p><h1>Create The Hume Wedding workspace</h1><p className="muted">This creates the private workspace that connects the dashboard, guests and RSVPs to your account.</p>{error && <div className="alert alert-error">{error}</div>}<form action={createWedding} className="form-grid"><div className="field span-2"><label htmlFor="couple_names">Wedding or couple names</label><input className="input" id="couple_names" name="couple_names" defaultValue="The Hume Wedding" required /></div><div className="field"><label htmlFor="wedding_date">Wedding date</label><input className="input" id="wedding_date" name="wedding_date" type="date" defaultValue="2027-03-20" required /></div><div className="field"><label htmlFor="venue">Venue</label><input className="input" id="venue" name="venue" placeholder="Venue name" /></div><button className="button button-primary span-2" type="submit">Create workspace</button></form></div></div>; }
