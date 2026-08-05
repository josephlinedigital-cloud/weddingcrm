import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding";

type Result = { id: string; title: string; subtitle: string; href: string; type: string };

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  if (query.length < 2) return NextResponse.json({ results: [] });
  const term = query.replace(/[,%()_'"\\]/g, " ").replace(/\s+/g, " ").trim();
  if (term.length < 2) return NextResponse.json({ results: [] });
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) return NextResponse.json({ results: [] });
  const like = `%${term}%`;

  const [guests, households, suppliers, tasks, timeline, budget, music, documents] = await Promise.all([
    supabase.from("guests").select("id,first_name,last_name,email").eq("wedding_id", wedding.id).or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`).limit(5),
    supabase.from("households").select("id,household_name,email").eq("wedding_id", wedding.id).or(`household_name.ilike.${like},email.ilike.${like}`).limit(4),
    supabase.from("suppliers").select("id,business_name,category").eq("wedding_id", wedding.id).or(`business_name.ilike.${like},category.ilike.${like}`).limit(5),
    supabase.from("tasks").select("id,title,status").eq("wedding_id", wedding.id).ilike("title", like).limit(5),
    supabase.from("timeline_items").select("id,title,category").eq("wedding_id", wedding.id).or(`title.ilike.${like},category.ilike.${like}`).limit(5),
    supabase.from("budget_items").select("id,name,payment_status").eq("wedding_id", wedding.id).ilike("name", like).limit(5),
    supabase.from("music_items").select("id,song_title,artist").eq("wedding_id", wedding.id).or(`song_title.ilike.${like},artist.ilike.${like}`).limit(5),
    supabase.from("documents").select("id,name,category").eq("wedding_id", wedding.id).or(`name.ilike.${like},category.ilike.${like}`).limit(5),
  ]);

  const results: Result[] = [
    ...(guests.data || []).map((item) => ({ id: item.id, title: `${item.first_name} ${item.last_name}`.trim(), subtitle: item.email || "Guest", href: `/guests/${item.id}`, type: "Guest" })),
    ...(households.data || []).map((item) => ({ id: item.id, title: item.household_name, subtitle: item.email || "Invitation household", href: "/guests/households", type: "Household" })),
    ...(suppliers.data || []).map((item) => ({ id: item.id, title: item.business_name, subtitle: item.category || "Supplier", href: "/suppliers", type: "Supplier" })),
    ...(tasks.data || []).map((item) => ({ id: item.id, title: item.title, subtitle: String(item.status || "Task").replaceAll("_", " "), href: "/tasks", type: "Task" })),
    ...(timeline.data || []).map((item) => ({ id: item.id, title: item.title, subtitle: item.category || "Timeline item", href: "/timeline", type: "Timeline" })),
    ...(budget.data || []).map((item) => ({ id: item.id, title: item.name, subtitle: String(item.payment_status || "Budget item").replaceAll("_", " "), href: "/budget", type: "Budget" })),
    ...(music.data || []).map((item) => ({ id: item.id, title: item.song_title, subtitle: item.artist || "Music item", href: "/music", type: "Music" })),
    ...(documents.data || []).map((item) => ({ id: item.id, title: item.name, subtitle: item.category || "Document", href: "/documents", type: "Document" })),
  ];
  return NextResponse.json({ results: results.slice(0, 28) });
}
