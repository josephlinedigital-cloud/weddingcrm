import {
  Armchair,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Music2,
  Store,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { redirect } from "next/navigation";
import { formatMoney, getWeddingContext } from "@/lib/wedding";

export default async function ReportsPage() {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) redirect("/dashboard");

  const [guestRes, budgetRes, taskRes, tableRes, musicRes, supplierRes] = await Promise.all([
    supabase.from("guests").select("id,rsvp_status").eq("wedding_id", wedding.id),
    supabase.from("budget_items").select("final_amount,amount_paid").eq("wedding_id", wedding.id),
    supabase.from("tasks").select("id,status").eq("wedding_id", wedding.id),
    supabase.from("guest_table_assignments").select("id").eq("wedding_id", wedding.id),
    supabase.from("music_items").select("id").eq("wedding_id", wedding.id),
    supabase.from("suppliers").select("id").eq("wedding_id", wedding.id),
  ]);
  const guests = guestRes.data || [];
  const budget = budgetRes.data || [];
  const tasks = taskRes.data || [];
  const committed = budget.reduce((sum, item) => sum + Number(item.final_amount || 0), 0);
  const paid = budget.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
  const reports = [
    ["Guest master list", "Every invitation, RSVP, contact and requirement", "/api/guests/export", UsersRound],
    ["Seating plan", "Tables, seats, households and dietary notes", "/api/reports/seating", Armchair],
    ["Budget ledger", "Estimates, commitments, payments and balances", "/api/reports/budget", WalletCards],
    ["Supplier directory", "Contacts, timings, contracts and costs", "/api/reports/suppliers", Store],
    ["Task register", "Status, deadlines and linked records", "/api/reports/tasks", CheckCircle2],
    ["Music brief", "Every song list and guest request", "/api/reports/music", Music2],
  ] as const;

  return <div className="page reports-page">
    <div className="page-header"><div><p className="eyebrow">Operational reporting</p><h1>Reports & exports</h1><p className="muted dashboard-intro">Download clean working copies for suppliers, the venue and your backups.</p></div></div>
    <section className="report-overview">
      <article className="card"><UsersRound /><span>Guests confirmed</span><strong>{guests.filter((guest) => guest.rsvp_status === "attending").length} / {guests.length}</strong></article>
      <article className="card"><Armchair /><span>Guests seated</span><strong>{tableRes.data?.length || 0}</strong></article>
      <article className="card"><WalletCards /><span>Committed / paid</span><strong>{formatMoney(committed, wedding.currency)} / {formatMoney(paid, wedding.currency)}</strong></article>
      <article className="card"><CheckCircle2 /><span>Tasks complete</span><strong>{tasks.filter((task) => task.status === "completed").length} / {tasks.length}</strong></article>
    </section>
    <section className="report-grid">{reports.map(([title, description, url, Icon]) => <article className="card report-card" key={title}><div className="report-icon"><Icon /></div><div><h2>{title}</h2><p>{description}</p></div><a className="button button-secondary" href={url}><Download />Download CSV</a></article>)}</section>
    <section className="report-foot card"><FileSpreadsheet /><div><h2>Current planning coverage</h2><p>{supplierRes.data?.length || 0} suppliers · {musicRes.data?.length || 0} songs · {tableRes.data?.length || 0} seated guests</p><small>Exports are generated live from your private workspace and contain the most recent saved information.</small></div></section>
  </div>;
}
