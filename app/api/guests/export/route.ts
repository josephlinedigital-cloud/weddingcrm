import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

type ExportGuest = Record<string, unknown> & {
  households: { household_name: string } | null;
  meal_options: { name: string } | null;
  guest_table_assignments: { tables: { name: string } | null }[];
};

export async function GET(request: NextRequest) {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) return new NextResponse("Not found", { status: 404 });

  const report = request.nextUrl.searchParams.get("report");
  const { data, error } = await supabase
    .from("guests")
    .select("first_name,last_name,preferred_name,guest_type,age_group,email,phone,rsvp_status,invitation_status,plus_one_allowed,plus_one_name,meal_option_id,dietary_requirements,allergies,accessibility_requirements,requires_accommodation,requires_transport,seat_number,gift_received,thank_you_sent,households(household_name),meal_options(name),guest_table_assignments(tables(name))")
    .eq("wedding_id", wedding.id)
    .order("last_name");
  if (error) return new NextResponse(error.message, { status: 500 });

  const guests = (data || []) as unknown as ExportGuest[];
  let headers = ["first_name", "last_name", "preferred_name", "household", "guest_type", "age_group", "email", "telephone", "rsvp_status", "invitation_status", "plus_one_allowed", "plus_one_name", "meal", "dietary_requirements", "allergies", "accessibility_requirements", "accommodation_required", "transport_required", "table", "seat_number", "gift_received", "thank_you_sent"];
  let exportGuests = guests;
  let filename = "wedding-guests";

  if (report === "dietary") {
    headers = ["first_name", "last_name", "household", "rsvp_status", "meal", "dietary_requirements", "allergies", "table"];
    exportGuests = guests.filter((guest) => Boolean(String(guest.dietary_requirements || "").trim() || String(guest.allergies || "").trim()));
    filename = "wedding-dietary-report";
  } else if (report === "meals") {
    headers = ["first_name", "last_name", "household", "rsvp_status", "meal", "dietary_requirements", "allergies", "table"];
    filename = "wedding-meal-report";
  }

  const valueFor = (guest: ExportGuest, header: string) => {
    if (header === "household") return guest.households?.household_name;
    if (header === "table") return guest.guest_table_assignments?.[0]?.tables?.name;
    if (header === "meal") return guest.meal_options?.name;
    if (header === "telephone") return guest.phone;
    if (header === "accommodation_required") return guest.requires_accommodation;
    if (header === "transport_required") return guest.requires_transport;
    return guest[header];
  };
  const lines = [headers.map(csv).join(","), ...exportGuests.map((guest) => headers.map((header) => csv(valueFor(guest, header))).join(","))];
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
