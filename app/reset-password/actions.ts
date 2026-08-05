"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirmation") || "");
  if (password.length < 8) redirect("/reset-password?error=Use+at+least+8+characters.");
  if (password !== confirmation) redirect("/reset-password?error=The+passwords+do+not+match.");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  await supabase.auth.signOut();
  redirect("/login?message=Password+updated.+You+can+sign+in+now.");
}
