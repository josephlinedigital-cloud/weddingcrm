"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CirclePlus, Clock3, Copy, Filter, GripVertical, PanelLeftClose, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { CalendarEvent, CalendarEventInput, CalendarSource } from "@/lib/calendar";
import { calendarCategories, calendarCategoryLabel } from "@/lib/calendar";
import { duplicateCalendarEvent, moveCalendarEvent, removeCalendarEvent, saveCalendarEvent, setCalendarEventStatus } from "@/app/(dashboard)/calendar/actions";

type Option = { id: string; name: string };
type View = "day" | "week" | "month" | "agenda" | "timeline";
const views: View[] = ["day", "week", "month", "agenda", "timeline"];
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const fullDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const monthTitle = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

function iso(date: Date) { return date.toISOString().slice(0, 10); }
function atNoon(value: string) { return new Date(`${value}T12:00:00`); }
function addDays(value: Date, days: number) { const next = new Date(value); next.setDate(next.getDate() + days); return next; }
function startOfWeek(value: Date) { const next = new Date(value); const day = (next.getDay() + 6) % 7; next.setDate(next.getDate() - day); return next; }
function isDone(event: CalendarEvent) { return ["completed", "paid", "cancelled"].includes(event.status); }

export function CalendarPlanner({ initialEvents, initialDate, initialView, startCreating = false, suppliers, guests, members }: { initialEvents: CalendarEvent[]; initialDate: string; initialView: string; startCreating?: boolean; suppliers: Option[]; guests: Option[]; members: Option[] }) {
  const [events, setEvents] = useState(() => [...initialEvents].sort((a, b) => `${a.date}${a.startTime || ""}`.localeCompare(`${b.date}${b.startTime || ""}`)));
  const [cursor, setCursor] = useState(atNoon(initialDate));
  const [view, setView] = useState<View>(views.includes(initialView as View) ? initialView as View : "month");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(true);
  const [memberFilter, setMemberFilter] = useState("");
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [creatingDate, setCreatingDate] = useState<string | null>(startCreating ? initialDate : null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const touchStart = useRef<number | null>(null);

  const filtered = useMemo(() => events.filter((event) => {
    if (!showCompleted && isDone(event)) return false;
    if (categories.size && !categories.has(event.category) && !categories.has(event.source)) return false;
    if (memberFilter && event.assignedUserId !== memberFilter) return false;
    const haystack = [event.title, event.description, event.location, event.notes, event.supplierName, ...(event.guestNames || [])].filter(Boolean).join(" ").toLowerCase();
    return !query || haystack.includes(query.toLowerCase());
  }), [events, query, categories, showCompleted, memberFilter]);

  const navigate = useCallback((direction: number) => {
    setCursor((current) => view === "month" ? new Date(current.getFullYear(), current.getMonth() + direction, 1) : addDays(current, direction * (view === "week" ? 7 : 1)));
  }, [view]);

  const changeView = useCallback((next: View) => { setView(next); }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.target as HTMLElement)?.matches("input,textarea,select")) return;
      const key = event.key.toLowerCase();
      if (key === "n") { event.preventDefault(); setCreatingDate(iso(cursor)); }
      if (key === "t") setCursor(new Date());
      if (key === "m") changeView("month");
      if (key === "w") changeView("week");
      if (key === "d") changeView("day");
      if (key === "a") changeView("agenda");
      if (event.key === "ArrowLeft") navigate(-1);
      if (event.key === "ArrowRight") navigate(1);
      if (event.key === "Escape") { setEditing(null); setCreatingDate(null); setSelected(null); }
      if (event.key === "Enter" && selected) setEditing(events.find((item) => item.id === selected) || null);
      if (event.key === "Delete" && selected) {
        const target = events.find((item) => item.id === selected);
        if (target && target.source !== "wedding") void removeEvent(target);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // removeEvent intentionally stays outside the dependency list so keyboard bindings remain stable while editing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeView, cursor, events, navigate, selected]);

  function optimistic(task: () => Promise<void>, rollback: CalendarEvent[]) {
    startTransition(async () => { try { await task(); } catch (error) { setEvents(rollback); toast.error(error instanceof Error ? error.message : "The calendar could not be updated."); } });
  }

  function moveEvent(event: CalendarEvent, date: string) {
    if (event.source === "wedding") return;
    const previous = events;
    setEvents((current) => current.map((item) => item.id === event.id && item.source === event.source ? { ...item, date } : item));
    optimistic(async () => { await moveCalendarEvent(event.id, event.source, date, event.startTime, event.endTime); toast.success("Event moved"); }, previous);
  }

  async function resizeEvent(event: CalendarEvent, minutes: number) {
    if (event.source === "wedding") return;
    const [hour, minute] = (event.endTime || event.startTime || "09:00").split(":").map(Number);
    const total = Math.max(0, Math.min(23 * 60 + 59, hour * 60 + minute + minutes));
    const endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    const previous = events;
    setEvents((current) => current.map((item) => item.id === event.id && item.source === event.source ? { ...item, endTime } : item));
    optimistic(() => moveCalendarEvent(event.id, event.source, event.date, event.startTime, endTime), previous);
  }

  async function removeEvent(event: CalendarEvent) {
    if (!window.confirm(event.source === "custom" ? `Delete “${event.title}”?` : `Remove “${event.title}” from the calendar? The linked record will be kept.`)) return;
    const previous = events;
    setEvents((current) => current.filter((item) => !(item.id === event.id && item.source === event.source)));
    setEditing(null); setSelected(null);
    optimistic(async () => { await removeCalendarEvent(event.id, event.source); toast.success("Removed from calendar"); }, previous);
  }

  async function duplicateEvent(event: CalendarEvent) {
    startTransition(async () => { try { const copy = await duplicateCalendarEvent(event); setEvents((current) => [...current, copy]); toast.success("Event duplicated"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not duplicate event."); } });
  }

  async function toggleDone(event: CalendarEvent) {
    if (event.source === "wedding") return;
    const status = isDone(event) ? "pending" : "completed";
    const previous = events;
    setEvents((current) => current.map((item) => item.id === event.id && item.source === event.source ? { ...item, status } : item));
    optimistic(() => setCalendarEventStatus(event.id, event.source, status), previous);
  }

  async function submit(input: CalendarEventInput) {
    const previous = events;
    startTransition(async () => {
      try {
        const saved = await saveCalendarEvent(input);
        setEvents((current) => input.id ? current.map((item) => item.id === input.id && item.source === "custom" ? saved : item) : [...current, saved]);
        setEditing(null); setCreatingDate(null); toast.success(input.id ? "Event updated" : "Event added");
      } catch (error) { setEvents(previous); toast.error(error instanceof Error ? error.message : "Could not save event."); }
    });
  }

  function onDrop(date: string, raw?: string) {
    if (!raw) return;
    const [source, id] = raw.split("::") as [CalendarSource, string];
    const event = events.find((item) => item.id === id && item.source === source);
    if (event) moveEvent(event, date);
  }

  const title = view === "month" ? monthTitle.format(cursor) : fullDate.format(cursor);
  return <div className={`calendar-shell ${isPending ? "is-saving" : ""}`} onPointerDown={(event) => { touchStart.current = event.clientX; }} onPointerUp={(event) => { if (view === "day" && touchStart.current !== null && Math.abs(event.clientX - touchStart.current) > 70) navigate(event.clientX < touchStart.current ? 1 : -1); touchStart.current = null; }}>
    <header className="calendar-toolbar">
      <div><p className="eyebrow">Planning calendar</p><h1>{title}</h1></div>
      <div className="calendar-nav"><button onClick={() => navigate(-1)} aria-label="Previous period"><ChevronLeft /></button><button onClick={() => setCursor(new Date())}>Today</button><button onClick={() => navigate(1)} aria-label="Next period"><ChevronRight /></button></div>
      <div className="calendar-view-switch" aria-label="Calendar view">{views.map((item) => <button className={view === item ? "active" : ""} onClick={() => setView(item)} key={item}>{item}</button>)}</div>
      <button className="button button-secondary calendar-filter-toggle" onClick={() => setFiltersOpen(true)}><Filter />Filters</button>
      <button className="button button-primary" onClick={() => setCreatingDate(iso(cursor))}><CirclePlus />New event</button>
    </header>
    <div className="calendar-layout">
      <aside className={`calendar-filters ${filtersOpen ? "open" : ""}`}><header><strong>Calendar</strong><button onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X /></button></header><MiniMonth cursor={cursor} events={events} onSelect={(date) => { setCursor(atNoon(date)); setCreatingDate(date); }} /><label className="calendar-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search calendar" /></label><section><h2>Show</h2>{calendarCategories.map((category) => <label className="calendar-check" key={category}><input type="checkbox" checked={!categories.size || categories.has(category)} onChange={() => setCategories((current) => { const next = new Set(current.size ? current : calendarCategories); if (next.has(category)) next.delete(category); else next.add(category); return next.size === calendarCategories.length ? new Set() : next; })} /><i data-category={category} />{calendarCategoryLabel(category)}</label>)}<label className="calendar-check"><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} />Completed</label></section>{members.length > 0 && <section><h2>Assigned user</h2><select className="select" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}><option value="">Everyone</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></section>}<footer><PanelLeftClose /><span>Shortcuts: N new · T today · M/W/D/A views</span></footer></aside>
      <main className="calendar-canvas">
        {view === "month" && <MonthView cursor={cursor} events={filtered} selected={selected} onSelect={setSelected} onEdit={setEditing} onCreate={setCreatingDate} onDrop={onDrop} />}
        {view === "week" && <WeekView cursor={cursor} events={filtered} selected={selected} onSelect={setSelected} onEdit={setEditing} onCreate={setCreatingDate} onDrop={onDrop} onResize={resizeEvent} />}
        {view === "day" && <DayView date={iso(cursor)} events={filtered} selected={selected} onSelect={setSelected} onEdit={setEditing} onCreate={setCreatingDate} onResize={resizeEvent} />}
        {view === "agenda" && <AgendaView events={filtered} onEdit={setEditing} />}
        {view === "timeline" && <TimelineView events={filtered} onEdit={setEditing} />}
      </main>
      <UpcomingPanel events={filtered} onEdit={setEditing} />
    </div>
    {(creatingDate || editing) && <EventSheet event={editing} defaultDate={creatingDate || editing?.date || iso(cursor)} suppliers={suppliers} guests={guests} members={members} pending={isPending} onClose={() => { setEditing(null); setCreatingDate(null); }} onSave={submit} onDuplicate={duplicateEvent} onDelete={removeEvent} onDone={toggleDone} />}
  </div>;
}

function EventChip({ event, selected, onSelect, onEdit, onResize }: { event: CalendarEvent; selected?: boolean; onSelect: (id: string) => void; onEdit: (event: CalendarEvent) => void; onResize?: (event: CalendarEvent, minutes: number) => void }) {
  return <article className={`calendar-event category-${event.category} ${selected ? "selected" : ""} ${isDone(event) ? "done" : ""}`} draggable={event.source !== "wedding"} onDragStart={(drag) => drag.dataTransfer.setData("text/calendar-event", `${event.source}::${event.id}`)} onClick={(click) => { click.stopPropagation(); onSelect(event.id); }} onDoubleClick={() => onEdit(event)} tabIndex={0} aria-label={`${event.title}, ${event.date}`}>
    <i /><div><strong>{event.title}</strong><span>{event.startTime || calendarCategoryLabel(event.category)}{event.location ? ` · ${event.location}` : ""}</span></div><GripVertical />
    {onResize && event.startTime && <div className="calendar-resize" aria-label="Change duration"><button onClick={(click) => { click.stopPropagation(); onResize(event, -15); }}>−</button><button onClick={(click) => { click.stopPropagation(); onResize(event, 15); }}>+</button></div>}
  </article>;
}

function MonthView({ cursor, events, selected, onSelect, onEdit, onCreate, onDrop }: { cursor: Date; events: CalendarEvent[]; selected: string | null; onSelect: (id: string) => void; onEdit: (event: CalendarEvent) => void; onCreate: (date: string) => void; onDrop: (date: string, data?: string) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const start = startOfWeek(first); const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  return <section className="calendar-month"><header>{Array.from({ length: 7 }, (_, index) => <span key={index}>{weekday.format(addDays(start, index))}</span>)}</header><div>{days.map((day) => { const date = iso(day); const items = events.filter((event) => event.date === date); return <article className={`${day.getMonth() !== cursor.getMonth() ? "outside" : ""} ${date === iso(new Date()) ? "today" : ""}`} key={date} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(date, event.dataTransfer.getData("text/calendar-event"))} onDoubleClick={() => onCreate(date)}><button onClick={() => onCreate(date)} aria-label={`Add event on ${date}`}>{day.getDate()}</button><div>{items.slice(0, 4).map((item) => <EventChip event={item} selected={selected === item.id} onSelect={onSelect} onEdit={onEdit} key={`${item.source}-${item.id}`} />)}{items.length > 4 && <button className="calendar-more" onClick={() => onCreate(date)}>+{items.length - 4} more</button>}</div></article>; })}</div></section>;
}

function WeekView({ cursor, events, selected, onSelect, onEdit, onCreate, onDrop, onResize }: { cursor: Date; events: CalendarEvent[]; selected: string | null; onSelect: (id: string) => void; onEdit: (event: CalendarEvent) => void; onCreate: (date: string) => void; onDrop: (date: string, data?: string) => void; onResize: (event: CalendarEvent, minutes: number) => void }) {
  const start = startOfWeek(cursor); return <section className="calendar-week">{Array.from({ length: 7 }, (_, index) => addDays(start, index)).map((day) => { const date = iso(day); return <article onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(date, event.dataTransfer.getData("text/calendar-event"))} key={date}><header><span>{weekday.format(day)}</span><button onClick={() => onCreate(date)}>{day.getDate()}</button></header><div>{events.filter((event) => event.date === date).map((event) => <EventChip event={event} selected={selected === event.id} onSelect={onSelect} onEdit={onEdit} onResize={onResize} key={`${event.source}-${event.id}`} />)}<button className="calendar-slot-add" onClick={() => onCreate(date)}>Add event</button></div></article>; })}</section>;
}

function DayView({ date, events, selected, onSelect, onEdit, onCreate, onResize }: { date: string; events: CalendarEvent[]; selected: string | null; onSelect: (id: string) => void; onEdit: (event: CalendarEvent) => void; onCreate: (date: string) => void; onResize: (event: CalendarEvent, minutes: number) => void }) {
  const items = events.filter((event) => event.date === date); return <section className="calendar-day"><header><div><span>{weekday.format(atNoon(date))}</span><strong>{atNoon(date).getDate()}</strong></div><p>{items.length} planned items</p></header><div className="calendar-hours">{Array.from({ length: 15 }, (_, index) => index + 7).map((hour) => <div onDoubleClick={() => onCreate(date)} key={hour}><time>{String(hour).padStart(2, "0")}:00</time><section>{items.filter((event) => Number(event.startTime?.slice(0, 2) || 9) === hour).map((event) => <EventChip event={event} selected={selected === event.id} onSelect={onSelect} onEdit={onEdit} onResize={onResize} key={`${event.source}-${event.id}`} />)}</section></div>)}</div></section>;
}

function AgendaView({ events, onEdit }: { events: CalendarEvent[]; onEdit: (event: CalendarEvent) => void }) { const future = events.filter((event) => event.date >= iso(new Date())).slice(0, 250); const groups = future.reduce<Map<string, CalendarEvent[]>>((map, event) => { const items = map.get(event.date) || []; items.push(event); map.set(event.date, items); return map; }, new Map()); return <section className="calendar-agenda">{Array.from(groups).map(([date, items]) => <article key={date}><header><strong>{atNoon(date).getDate()}</strong><div><span>{weekday.format(atNoon(date))}</span><small>{monthTitle.format(atNoon(date))}</small></div></header><div>{items.map((event) => <button onClick={() => onEdit(event)} key={`${event.source}-${event.id}`}><i className={`category-${event.category}`} /><time>{event.startTime || "All day"}</time><strong>{event.title}</strong><span>{event.location || event.supplierName || calendarCategoryLabel(event.category)}</span><em>{event.status.replaceAll("_", " ")}</em></button>)}</div></article>)}{future.length === 0 && <EmptyCalendar />}</section>; }

function TimelineView({ events, onEdit }: { events: CalendarEvent[]; onEdit: (event: CalendarEvent) => void }) { return <section className="calendar-timeline-view">{events.filter((event) => event.date >= iso(new Date())).slice(0, 100).map((event, index) => <button onClick={() => onEdit(event)} key={`${event.source}-${event.id}`}><div><time>{event.date}</time><span>{event.startTime || "All day"}</span></div><i className={`category-${event.category}`} /><article><small>{calendarCategoryLabel(event.category)}</small><strong>{event.title}</strong><p>{event.description || event.location || event.supplierName || "Wedding planning event"}</p></article>{index < events.length - 1 && <b />}</button>)}</section>; }

function UpcomingPanel({ events, onEdit }: { events: CalendarEvent[]; onEdit: (event: CalendarEvent) => void }) { const today = atNoon(iso(new Date())); const buckets = [["Today", 0, 0], ["Tomorrow", 1, 1], ["This week", 2, 7], ["Next week", 8, 14]] as const; return <aside className="calendar-upcoming"><header><Clock3 /><div><strong>Upcoming</strong><span>What’s ahead</span></div></header>{buckets.map(([label, from, to]) => { const items = events.filter((event) => { const date = atNoon(event.date); return date >= addDays(today, from) && date <= addDays(today, to); }).slice(0, 4); return <section key={label}><h2>{label}</h2>{items.length ? items.map((event) => <button onClick={() => onEdit(event)} key={`${event.source}-${event.id}`}><i className={`category-${event.category}`} /><div><strong>{event.title}</strong><span>{event.startTime || event.date}</span></div></button>) : <p>Nothing scheduled</p>}</section>; })}</aside>; }

function MiniMonth({ cursor, events, onSelect }: { cursor: Date; events: CalendarEvent[]; onSelect: (date: string) => void }) { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const start = startOfWeek(first); return <div className="calendar-mini"><div>{Array.from({ length: 7 }, (_, index) => <span key={index}>{weekday.format(addDays(start, index)).slice(0, 1)}</span>)}</div><section>{Array.from({ length: 42 }, (_, index) => addDays(start, index)).map((day) => { const date = iso(day); return <button className={`${day.getMonth() !== cursor.getMonth() ? "outside" : ""} ${date === iso(new Date()) ? "today" : ""}`} onClick={() => onSelect(date)} key={date}>{day.getDate()}{events.some((event) => event.date === date) && <i />}</button>; })}</section></div>; }

function EventSheet({ event, defaultDate, suppliers, guests, members, pending, onClose, onSave, onDuplicate, onDelete, onDone }: { event: CalendarEvent | null; defaultDate: string; suppliers: Option[]; guests: Option[]; members: Option[]; pending: boolean; onClose: () => void; onSave: (input: CalendarEventInput) => void; onDuplicate: (event: CalendarEvent) => void; onDelete: (event: CalendarEvent) => void; onDone: (event: CalendarEvent) => void }) {
  const editable = !event || event.source === "custom";
  function submit(formData: FormData) { const supplierId = String(formData.get("supplierId") || ""); const assignedUserId = String(formData.get("assignedUserId") || ""); const guestIds = formData.getAll("guestIds").map(String); onSave({ id: event?.source === "custom" ? event.id : undefined, title: String(formData.get("title") || ""), description: String(formData.get("description") || ""), date: String(formData.get("date") || defaultDate), startTime: String(formData.get("startTime") || ""), endTime: String(formData.get("endTime") || ""), location: String(formData.get("location") || ""), category: String(formData.get("category") || "personal"), priority: String(formData.get("priority") || "medium"), assignedUserId, assignedLabel: members.find((member) => member.id === assignedUserId)?.name, supplierId, supplierName: suppliers.find((supplier) => supplier.id === supplierId)?.name, guestIds, guestNames: guests.filter((guest) => guestIds.includes(guest.id)).map((guest) => guest.name), status: String(formData.get("status") || "pending"), attachment: String(formData.get("attachment") || ""), notes: String(formData.get("notes") || ""), recurring: String(formData.get("recurring") || "none"), reminder: String(formData.get("reminder") || "1_day") }); }
  return <div className="calendar-sheet-layer" role="dialog" aria-modal="true" aria-label={event ? "Event details" : "New event"}><button className="calendar-sheet-backdrop" onClick={onClose} aria-label="Close event" /><section className="calendar-event-sheet"><header><div><p className="eyebrow">{event ? calendarCategoryLabel(event.category) : "New calendar event"}</p><h2>{event?.title || "Plan something"}</h2></div><button onClick={onClose} aria-label="Close"><X /></button></header>{event && !editable ? <div className="calendar-linked-event"><span className={`calendar-source category-${event.category}`}>{calendarCategoryLabel(event.category)}</span><h3>{event.title}</h3>{event.description && <p>{event.description}</p>}<dl><div><dt>Date</dt><dd>{fullDate.format(atNoon(event.date))}</dd></div>{event.startTime && <div><dt>Time</dt><dd>{event.startTime}{event.endTime ? `–${event.endTime}` : ""}</dd></div>}{event.location && <div><dt>Location</dt><dd>{event.location}</dd></div>}{event.assignedLabel && <div><dt>Assigned</dt><dd>{event.assignedLabel}</dd></div>}{event.supplierName && <div><dt>Supplier</dt><dd>{event.supplierName}</dd></div>}<div><dt>Status</dt><dd>{event.status.replaceAll("_", " ")}</dd></div></dl><p className="calendar-linked-note">This event is linked to {event.source}. Edit its full details there, or drag it to reschedule.</p></div> : <form action={submit} className="calendar-event-form"><div className="field span-2"><label>Title</label><input className="input" name="title" defaultValue={event?.title || ""} required autoFocus /></div><div className="field span-2"><label>Description</label><textarea className="textarea" name="description" defaultValue={event?.description || ""} /></div><div className="field"><label>Date</label><input className="input" type="date" name="date" defaultValue={event?.date || defaultDate} required /></div><div className="field"><label>Category</label><select className="select" name="category" defaultValue={event?.category || "personal"}>{calendarCategories.map((category) => <option value={category} key={category}>{calendarCategoryLabel(category)}</option>)}</select></div><div className="field"><label>Start</label><input className="input" type="time" name="startTime" defaultValue={event?.startTime || ""} /></div><div className="field"><label>End</label><input className="input" type="time" name="endTime" defaultValue={event?.endTime || ""} /></div><div className="field span-2"><label>Location</label><input className="input" name="location" defaultValue={event?.location || ""} /></div><div className="field"><label>Priority</label><select className="select" name="priority" defaultValue={event?.priority || "medium"}><option>low</option><option>medium</option><option>high</option><option>urgent</option></select></div><div className="field"><label>Status</label><select className="select" name="status" defaultValue={event?.status || "pending"}><option>pending</option><option>confirmed</option><option>completed</option><option>cancelled</option></select></div><div className="field"><label>Assigned user</label><select className="select" name="assignedUserId" defaultValue={event?.assignedUserId || ""}><option value="">Unassigned</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></div><div className="field"><label>Supplier</label><select className="select" name="supplierId" defaultValue={event?.supplierId || ""}><option value="">No supplier</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></div><div className="field span-2"><label>Guests</label><select className="select calendar-guest-select" name="guestIds" defaultValue={event?.guestIds || []} multiple>{guests.map((guest) => <option value={guest.id} key={guest.id}>{guest.name}</option>)}</select></div><div className="field"><label>Reminder</label><select className="select" name="reminder" defaultValue={event?.reminder || "1_day"}><option value="none">None</option><option value="1_hour">1 hour</option><option value="6_hours">6 hours</option><option value="1_day">1 day</option><option value="3_days">3 days</option><option value="1_week">1 week</option><option value="custom">Custom</option></select></div><div className="field"><label>Repeats</label><select className="select" name="recurring" defaultValue={event?.recurring || "none"}><option value="none">Never</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div><div className="field span-2"><label>Attachment link</label><input className="input" type="url" name="attachment" defaultValue={event?.attachment || ""} placeholder="https://…" /></div><div className="field span-2"><label>Private notes</label><textarea className="textarea" name="notes" defaultValue={event?.notes || ""} /></div><button className="button button-primary span-2" disabled={pending}>{pending ? "Saving…" : event ? "Save changes" : "Create event"}</button></form>} {event && event.source !== "wedding" && <footer><button className="button button-secondary" onClick={() => onDone(event)}><Check />{isDone(event) ? "Mark pending" : "Complete"}</button><button className="button button-secondary" onClick={() => onDuplicate(event)}><Copy />Duplicate</button><button className="button button-danger" onClick={() => onDelete(event)}><Trash2 />{event.source === "custom" ? "Delete" : "Remove date"}</button></footer>}</section></div>;
}

function EmptyCalendar() { return <div className="calendar-empty"><CalendarDays /><h2>No events here</h2><p>Change your filters or add a calendar event.</p></div>; }
