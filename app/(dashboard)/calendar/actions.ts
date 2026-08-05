"use server";

import { revalidatePath } from "next/cache";
import { getWeddingContext } from "@/lib/wedding";
import type { CalendarEvent, CalendarEventInput, CalendarSource } from "@/lib/calendar";

const SETTINGS_KEY = "calendar_events_v1";

function cleanTime(value?: string) {
  return value?.slice(0, 5) || undefined;
}

function cleanEvent(input: CalendarEventInput, existingId?: string): CalendarEvent {
  return {
    id: existingId || input.id || crypto.randomUUID(),
    source: "custom",
    title: input.title.trim().slice(0, 160),
    description: input.description?.trim().slice(0, 2000),
    date: input.date,
    startTime: cleanTime(input.startTime),
    endTime: cleanTime(input.endTime),
    location: input.location?.trim().slice(0, 240),
    category: input.category || "personal",
    priority: input.priority || "medium",
    assignedUserId: input.assignedUserId || undefined,
    assignedLabel: input.assignedLabel || undefined,
    supplierId: input.supplierId || undefined,
    supplierName: input.supplierName || undefined,
    guestIds: input.guestIds?.slice(0, 100) || [],
    guestNames: input.guestNames?.slice(0, 100) || [],
    status: input.status || "pending",
    attachment: input.attachment?.trim().slice(0, 1000),
    notes: input.notes?.trim().slice(0, 4000),
    recurring: input.recurring || "none",
    reminder: input.reminder || "1_day",
  };
}

async function readCustomEvents() {
  const context = await getWeddingContext();
  if (!context.wedding) throw new Error("Wedding workspace not found.");
  const { data, error } = await context.supabase
    .from("app_settings")
    .select("value")
    .eq("wedding_id", context.wedding.id)
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const value = data?.value as { events?: CalendarEvent[] } | null;
  return { ...context, events: Array.isArray(value?.events) ? value.events : [] };
}

async function writeCustomEvents(events: CalendarEvent[]) {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) throw new Error("Wedding workspace not found.");
  const { error } = await supabase.from("app_settings").upsert(
    { wedding_id: wedding.id, key: SETTINGS_KEY, value: { version: 1, events } },
    { onConflict: "wedding_id,key" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function saveCalendarEvent(input: CalendarEventInput) {
  if (!input.title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Add a title and valid date.");
  const { events } = await readCustomEvents();
  const index = input.id ? events.findIndex((event) => event.id === input.id) : -1;
  const event = cleanEvent(input, index >= 0 ? events[index].id : undefined);
  const next = index >= 0 ? events.map((item, itemIndex) => (itemIndex === index ? event : item)) : [...events, event];
  await writeCustomEvents(next);
  return event;
}

export async function moveCalendarEvent(id: string, source: CalendarSource, date: string, startTime?: string, endTime?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid calendar date.");
  if (source === "custom") {
    const { events } = await readCustomEvents();
    await writeCustomEvents(events.map((event) => event.id === id ? { ...event, date, startTime: cleanTime(startTime) || event.startTime, endTime: cleanTime(endTime) || event.endTime } : event));
    return;
  }
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) throw new Error("Wedding workspace not found.");
  const table = source === "task" ? "tasks" : source === "payment" ? "budget_items" : source === "timeline" ? "timeline_items" : source === "supplier" ? "suppliers" : null;
  if (!table) return;
  const payload = source === "task" ? { due_date: date }
    : source === "payment" ? { payment_due_date: date }
    : source === "supplier" ? { next_payment_date: date }
    : { event_date: date, ...(startTime ? { start_time: cleanTime(startTime) } : {}), ...(endTime ? { end_time: cleanTime(endTime) } : {}) };
  const { error } = await supabase.from(table).update(payload).eq("id", id).eq("wedding_id", wedding.id);
  if (error) throw new Error(error.message);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function duplicateCalendarEvent(event: CalendarEvent) {
  const copy = cleanEvent({ ...event, id: undefined, title: `${event.title} (copy)` });
  const { events } = await readCustomEvents();
  await writeCustomEvents([...events, copy]);
  return copy;
}

export async function removeCalendarEvent(id: string, source: CalendarSource) {
  if (source === "custom") {
    const { events } = await readCustomEvents();
    await writeCustomEvents(events.filter((event) => event.id !== id));
    return;
  }
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) throw new Error("Wedding workspace not found.");
  const table = source === "task" ? "tasks" : source === "payment" ? "budget_items" : source === "timeline" ? "timeline_items" : source === "supplier" ? "suppliers" : null;
  const column = source === "task" ? "due_date" : source === "payment" ? "payment_due_date" : source === "timeline" ? "event_date" : "next_payment_date";
  if (!table) return;
  const { error } = await supabase.from(table).update({ [column]: null }).eq("id", id).eq("wedding_id", wedding.id);
  if (error) throw new Error(error.message);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function setCalendarEventStatus(id: string, source: CalendarSource, status: string) {
  if (source === "custom") {
    const { events } = await readCustomEvents();
    await writeCustomEvents(events.map((event) => event.id === id ? { ...event, status } : event));
    return;
  }
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) throw new Error("Wedding workspace not found.");
  if (source === "task") await supabase.from("tasks").update({ status: status === "completed" ? "completed" : "in_progress", completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", id).eq("wedding_id", wedding.id);
  if (source === "timeline") await supabase.from("timeline_items").update({ status: status === "completed" ? "completed" : "planned" }).eq("id", id).eq("wedding_id", wedding.id);
  if (source === "payment") await supabase.from("budget_items").update({ payment_status: status === "completed" ? "paid" : "due" }).eq("id", id).eq("wedding_id", wedding.id);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

