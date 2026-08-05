import { redirect } from "next/navigation";
import { GuestManagement, type GuestWorkspaceRow } from "@/components/guest-management";
import { getWeddingContext } from "@/lib/wedding";

type Params = { error?: string; message?: string; new?: string; guest?: string; household?: string; view?: string };

export default async function GuestsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, wedding, user } = await getWeddingContext();
  if (!wedding) redirect("/dashboard");
  const archivedKey = `guest_archived_ids:${user.id}`;
  const [guestRes, householdRes, tableRes, mealRes, archiveRes] = await Promise.all([
    supabase.from("guests").select("id,household_id,first_name,last_name,preferred_name,title,relationship_group,guest_type,age_group,email,phone,rsvp_status,invitation_status,is_vip,plus_one_allowed,plus_one_name,meal_option_id,dietary_requirements,allergies,accessibility_requirements,requires_highchair,requires_accommodation,accommodation_notes,requires_transport,transport_notes,gift_received,thank_you_sent,private_notes,invited_at,responded_at,created_at,updated_at,households(id,household_name,email,guests(id,rsvp_status)),meal_options(name),guest_table_assignments(table_id,tables(name))").eq("wedding_id", wedding.id).order("last_name").order("first_name"),
    supabase.from("households").select("id,household_name,email,rsvp_code,guests(id,rsvp_status)").eq("wedding_id", wedding.id).order("household_name"),
    supabase.from("tables").select("id,name,capacity,guest_table_assignments(guest_id)").eq("wedding_id", wedding.id).order("sort_order").order("name"),
    supabase.from("meal_options").select("id,name,is_active").eq("wedding_id", wedding.id).eq("is_active", true).order("sort_order").order("name"),
    supabase.from("app_settings").select("value").eq("wedding_id", wedding.id).eq("key", archivedKey).maybeSingle(),
  ]);
  const archivedValue = archiveRes.data?.value as { ids?: string[] } | null;
  const error = [guestRes.error, householdRes.error, tableRes.error, mealRes.error, archiveRes.error].find(Boolean);
  return <div className="page guest-workspace-page">
    <GuestManagement
      initialGuests={(guestRes.data || []) as unknown as GuestWorkspaceRow[]}
      households={(householdRes.data || []).map((household) => ({ id: household.id, name: household.household_name, email: household.email, rsvpCode: household.rsvp_code, guestCount: household.guests?.length || 0, attending: household.guests?.filter((guest) => guest.rsvp_status === "attending").length || 0, awaiting: household.guests?.filter((guest) => !["attending", "declined"].includes(guest.rsvp_status)).length || 0 }))}
      tables={(tableRes.data || []).map((table) => ({ id: table.id, name: table.name, capacity: table.capacity, assigned: table.guest_table_assignments?.length || 0 }))}
      meals={(mealRes.data || []).map((meal) => ({ id: meal.id, name: meal.name }))}
      archivedIds={Array.isArray(archivedValue?.ids) ? archivedValue.ids : []}
      weddingId={wedding.id}
      userId={user.id}
      userEmail={user.email || "Wedding user"}
      initialAddGuest={params.new === "1"}
      initialGuestId={params.guest}
      initialHouseholdId={params.household}
      initialView={params.view}
      error={params.error || error?.message}
      message={params.message}
    />
  </div>;
}

