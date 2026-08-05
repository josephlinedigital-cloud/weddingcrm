"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createWedding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const coupleNames = String(formData.get("couple_names") || "").trim();
  const names = coupleNames.split(/\s+(?:&|and)\s+/i);
  const { error } = await supabase.from("weddings").insert({
    name: /wedding$/i.test(coupleNames) ? coupleNames : `${coupleNames} Wedding`,
    partner_one_name: names[0] || coupleNames,
    partner_two_name: names.slice(1).join(" & ") || null,
    wedding_date: String(formData.get("wedding_date") || ""),
    ceremony_venue: String(formData.get("venue") || "") || null,
    created_by: user.id,
  });
  if (error) redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}
