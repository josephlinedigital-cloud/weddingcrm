import { redirect } from "next/navigation";
import { TablesWorkspace, type TablesWorkspaceGuest, type TablesWorkspaceTable } from "@/components/tables-workspace";
import { getWeddingContext } from "@/lib/wedding";

type Params = { error?: string; message?: string; view?: string; table?: string; new?: string };

export default async function TablesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, wedding, user } = await getWeddingContext();
  if (!wedding) redirect("/dashboard");

  const [tableRes, guestRes, assignmentRes, seatRes, relationshipRes, layoutRes, versionRes] = await Promise.all([
    supabase.from("tables").select("id,name,shape,capacity,notes,sort_order,x_position,y_position,width,height,rotation,created_at,updated_at").eq("wedding_id", wedding.id).order("sort_order").order("name"),
    supabase.from("guests").select("id,first_name,last_name,preferred_name,age_group,guest_type,rsvp_status,dietary_requirements,allergies,accessibility_requirements,requires_highchair,is_vip,relationship_group,household_id,households(id,household_name,guests(id,first_name,last_name,age_group,rsvp_status)),meal_options(name)").eq("wedding_id", wedding.id).order("last_name").order("first_name"),
    supabase.from("guest_table_assignments").select("id,guest_id,table_id,seat_id,is_locked,assigned_at,seats(id,seat_number,is_locked)").eq("wedding_id", wedding.id),
    supabase.from("seats").select("id,table_id,seat_number,x_position,y_position,rotation,is_locked").eq("wedding_id", wedding.id).order("seat_number"),
    supabase.from("guest_relationships").select("id,guest_id,related_guest_id,relationship_type,relationship_score,should_sit_together,should_not_sit_together,notes").eq("wedding_id", wedding.id),
    supabase.from("venue_layouts").select("id,name,venue_name,room_name,is_final,updated_at").eq("wedding_id", wedding.id).eq("is_archived", false).order("updated_at", { ascending: false }),
    supabase.from("app_settings").select("value").eq("wedding_id", wedding.id).eq("key", "seating_versions_v1").maybeSingle(),
  ]);
  const rawGuests = (guestRes.data || []) as unknown as Array<TablesWorkspaceGuest & { households: TablesWorkspaceGuest["households"] | TablesWorkspaceGuest["households"][]; meal_options: { name: string } | { name: string }[] | null }>;
  const guests: TablesWorkspaceGuest[] = rawGuests.map((guest) => ({ ...guest, households: Array.isArray(guest.households) ? guest.households[0] || null : guest.households, meal_options: Array.isArray(guest.meal_options) ? guest.meal_options[0] || null : guest.meal_options }));
  const guestMap = new Map(guests.map((guest) => [guest.id, guest]));
  const assignments = (assignmentRes.data || []).map((assignment) => {
    const rawSeat = Array.isArray(assignment.seats) ? assignment.seats[0] : assignment.seats;
    return { ...assignment, seats: rawSeat || null, guest: guestMap.get(assignment.guest_id)! };
  }).filter((assignment) => Boolean(assignment.guest));
  const tables: TablesWorkspaceTable[] = (tableRes.data || []).map((table) => ({
    ...table,
    assignments: assignments.filter((assignment) => assignment.table_id === table.id),
    seats: (seatRes.data || []).filter((seat) => seat.table_id === table.id),
  }));
  // Venue layouts are optional because older Wedding HQ workspaces predate that module.
  // The table-position based visual planner remains fully functional without it.
  const errors = [tableRes.error, guestRes.error, assignmentRes.error, seatRes.error, relationshipRes.error, versionRes.error].filter(Boolean);
  const versions = Array.isArray(versionRes.data?.value) ? versionRes.data.value as Array<{ id: string; name: string; createdAt: string; createdBy: string }> : [];

  return <div className="page tables-workspace-page">
    <TablesWorkspace
      initialTables={tables}
      guests={guests}
      relationships={relationshipRes.data || []}
      venueLayouts={layoutRes.data || []}
      versions={versions}
      weddingId={wedding.id}
      weddingName={wedding.couple_names}
      weddingDate={wedding.wedding_date}
      venueName={wedding.venue || "Venue not recorded"}
      userId={user.id}
      userEmail={user.email || "Wedding user"}
      initialView={params.view}
      initialTableId={params.table}
      initialAddTable={params.new === "1"}
      error={params.error || errors[0]?.message}
      message={params.message}
    />
  </div>;
}
