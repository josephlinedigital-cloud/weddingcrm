import { NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
  const [guestRes, assignmentRes, activityRes, rsvpRes] = await Promise.all([
    supabase.from("guests").select("*,households(id,household_name,email,address_line_1,address_line_2,city,county,postcode,rsvp_code,guests(id,first_name,last_name,rsvp_status)),meal_options(id,name)").eq("id", id).eq("wedding_id", wedding.id).maybeSingle(),
    supabase.from("guest_table_assignments").select("id,is_locked,tables(id,name,capacity),seats(seat_number)").eq("guest_id", id).eq("wedding_id", wedding.id).maybeSingle(),
    supabase.from("activity_log").select("id,action,description,created_at").eq("wedding_id", wedding.id).eq("entity_type", "guest").eq("entity_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("rsvp_submissions").select("id,attending,dietary_requirements,message_to_couple,submitted_at,reviewed").eq("wedding_id", wedding.id).eq("guest_id", id).order("submitted_at", { ascending: false }).limit(10),
  ]);
  if (guestRes.error) return NextResponse.json({ error: guestRes.error.message }, { status: 500 });
  if (!guestRes.data) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  return NextResponse.json({ guest: guestRes.data, assignment: assignmentRes.data, activity: activityRes.data || [], rsvpHistory: rsvpRes.data || [] });
}

