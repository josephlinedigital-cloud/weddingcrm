import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getWeddingContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership, error } = await supabase
    .from("wedding_users")
    .select("wedding_id, role, weddings(*)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const raw = membership?.weddings as unknown as InstalledWedding | null;
  const coupleNames = [raw?.partner_one_name, raw?.partner_two_name].filter(Boolean).join(" & ");
  const wedding: Wedding | null = raw ? {
    id: raw.id,
    name: raw.name,
    couple_names: coupleNames || raw.name,
    wedding_date: raw.wedding_date || "2027-03-20",
    ceremony_time: raw.ceremony_time,
    venue: raw.ceremony_venue,
    reception_venue: raw.reception_venue,
    currency: raw.currency_code || "GBP",
    budget_target: Number(raw.budget_target || 0),
    rsvp_deadline: raw.rsvp_deadline,
    guest_capacity: raw.guest_capacity,
    website_url: raw.website_url,
    public_rsvp_enabled: true,
  } : null;
  return { supabase, user, membership, wedding, error };
}

type InstalledWedding = {
  id: string; name: string; partner_one_name: string | null; partner_two_name: string | null;
  wedding_date: string | null; ceremony_time: string | null; ceremony_venue: string | null;
  reception_venue: string | null; currency_code: string; budget_target: number; rsvp_deadline: string | null;
  guest_capacity: number | null; website_url: string | null;
};

export type Wedding = {
  id: string; name: string; couple_names: string; wedding_date: string; ceremony_time: string | null;
  venue: string | null; reception_venue: string | null; currency: string; budget_target: number;
  rsvp_deadline: string | null; guest_capacity: number | null; website_url: string | null; public_rsvp_enabled: boolean;
};

export function formatMoney(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
}

export function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}
