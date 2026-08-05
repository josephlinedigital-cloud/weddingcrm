import { redirect } from "next/navigation";
import { CalendarPlanner } from "@/components/calendar-planner";
import type { CalendarEvent } from "@/lib/calendar";
import { getWeddingContext } from "@/lib/wedding";

type TaskRow = { id: string; title: string; description: string | null; due_date: string | null; priority: string; status: string; assigned_user_id: string | null; supplier_id: string | null; suppliers: { business_name: string } | null };
type BudgetRow = { id: string; name: string; payment_due_date: string | null; payment_status: string; notes: string | null; supplier_id: string | null; suppliers: { business_name: string } | null };
type TimelineRow = { id: string; title: string; description: string | null; event_date: string | null; start_time: string | null; end_time: string | null; location: string | null; category: string | null; status: string; assigned_user_id: string | null; supplier_id: string | null; private_notes: string | null; suppliers: { business_name: string } | null };
type SupplierRow = { id: string; business_name: string; next_payment_date: string | null; address: string | null; notes: string | null };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; new?: string }> }) {
  const params = await searchParams;
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) redirect("/dashboard");

  const [taskRes, budgetRes, timelineRes, supplierRes, guestRes, memberRes, settingsRes] = await Promise.all([
    supabase.from("tasks").select("id,title,description,due_date,priority,status,assigned_user_id,supplier_id,suppliers(business_name)").eq("wedding_id", wedding.id).not("due_date", "is", null),
    supabase.from("budget_items").select("id,name,payment_due_date,payment_status,notes,supplier_id,suppliers(business_name)").eq("wedding_id", wedding.id).not("payment_due_date", "is", null),
    supabase.from("timeline_items").select("id,title,description,event_date,start_time,end_time,location,category,status,assigned_user_id,supplier_id,private_notes,suppliers(business_name)").eq("wedding_id", wedding.id).not("event_date", "is", null),
    supabase.from("suppliers").select("id,business_name,next_payment_date,address,notes").eq("wedding_id", wedding.id).order("business_name"),
    supabase.from("guests").select("id,first_name,last_name").eq("wedding_id", wedding.id).order("last_name"),
    supabase.from("wedding_users").select("user_id,role").eq("wedding_id", wedding.id),
    supabase.from("app_settings").select("value").eq("wedding_id", wedding.id).eq("key", "calendar_events_v1").maybeSingle(),
  ]);

  const members = (memberRes.data || []).map((member, index) => ({ id: member.user_id, name: `${member.role.charAt(0).toUpperCase()}${member.role.slice(1)} ${index + 1}` }));
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const tasks = (taskRes.data || []) as unknown as TaskRow[];
  const budgets = (budgetRes.data || []) as unknown as BudgetRow[];
  const timeline = (timelineRes.data || []) as unknown as TimelineRow[];
  const suppliers = (supplierRes.data || []) as SupplierRow[];
  const events: CalendarEvent[] = [
    ...tasks.map((task) => ({ id: task.id, source: "task" as const, sourceId: task.id, title: task.title, description: task.description || undefined, date: task.due_date!, category: "task", priority: task.priority, assignedUserId: task.assigned_user_id || undefined, assignedLabel: task.assigned_user_id ? memberNames.get(task.assigned_user_id) : undefined, supplierId: task.supplier_id || undefined, supplierName: task.suppliers?.business_name, status: task.status })),
    ...budgets.map((item) => ({ id: item.id, source: "payment" as const, sourceId: item.id, title: `Payment · ${item.name}`, description: item.notes || undefined, date: item.payment_due_date!, category: "payment", priority: "high", supplierId: item.supplier_id || undefined, supplierName: item.suppliers?.business_name, status: item.payment_status === "paid" ? "completed" : item.payment_status })),
    ...timeline.map((item) => ({ id: item.id, source: "timeline" as const, sourceId: item.id, title: item.title, description: item.description || undefined, date: item.event_date!, startTime: item.start_time?.slice(0, 5), endTime: item.end_time?.slice(0, 5), location: item.location || undefined, category: item.category || "timeline", priority: "medium", assignedUserId: item.assigned_user_id || undefined, assignedLabel: item.assigned_user_id ? memberNames.get(item.assigned_user_id) : undefined, supplierId: item.supplier_id || undefined, supplierName: item.suppliers?.business_name, status: item.status, notes: item.private_notes || undefined })),
    ...suppliers.filter((supplier) => supplier.next_payment_date).map((supplier) => ({ id: supplier.id, source: "supplier" as const, sourceId: supplier.id, title: `Supplier payment · ${supplier.business_name}`, description: supplier.notes || undefined, date: supplier.next_payment_date!, location: supplier.address || undefined, category: "payment", priority: "high", supplierId: supplier.id, supplierName: supplier.business_name, status: "pending" })),
  ];
  const customValue = settingsRes.data?.value as { events?: CalendarEvent[] } | null;
  if (Array.isArray(customValue?.events)) events.push(...customValue.events.filter((event) => event?.id && event?.date));
  events.push({ id: "wedding-date", source: "wedding", title: wedding.couple_names, date: wedding.wedding_date, startTime: wedding.ceremony_time?.slice(0, 5), location: wedding.venue || undefined, category: "wedding", priority: "urgent", status: "confirmed" });
  if (wedding.rsvp_deadline) events.push({ id: "rsvp-deadline", source: "wedding", title: "RSVP deadline", date: wedding.rsvp_deadline, category: "deadline", priority: "high", status: "pending" });

  const errors = [taskRes.error, budgetRes.error, timelineRes.error, supplierRes.error, guestRes.error, memberRes.error, settingsRes.error].filter(Boolean);
  return <div className="page calendar-page">
    {errors.length > 0 && <div className="alert alert-error">Some calendar data could not be loaded: {errors[0]?.message}</div>}
    <CalendarPlanner
      initialEvents={events}
      initialDate={params.date || new Date().toISOString().slice(0, 10)}
      initialView={params.view || "month"}
      startCreating={params.new === "1"}
      suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.business_name }))}
      guests={(guestRes.data || []).map((guest) => ({ id: guest.id, name: `${guest.first_name} ${guest.last_name}` }))}
      members={members}
    />
  </div>;
}
