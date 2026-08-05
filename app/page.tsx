import { redirect } from "next/navigation";
import { supabaseEnv } from "@/lib/supabase/env";

export default function Home() {
  redirect(supabaseEnv.isConfigured ? "/dashboard" : "/login");
}
