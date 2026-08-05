import { NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: table, error } = await supabase.from("tables").select("id,name").eq("id", id).eq("wedding_id", wedding.id).maybeSingle();
  if (error || !table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
  const { data: activity } = await supabase.from("activity_log").select("id,action,description,created_at").eq("wedding_id", wedding.id).eq("entity_id", id).order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ table, activity: activity || [] }, { headers: { "Cache-Control": "no-store" } });
}
