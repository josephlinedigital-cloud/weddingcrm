import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const download = (name: string, headers: string[], rows: unknown[][]) => new NextResponse([headers.map(csv).join(","), ...rows.map((row) => row.map(csv).join(","))].join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="wedding-${name}-${new Date().toISOString().slice(0, 10)}.csv"` } });

export async function GET(request: NextRequest) {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) return new NextResponse("Not found", { status: 404 });
  const report = request.nextUrl.searchParams.get("report") || "full";
  const { data, error } = await supabase.from("guest_table_assignments").select("is_locked,tables(name,shape,capacity,notes),seats(seat_number),guests(first_name,last_name,preferred_name,age_group,guest_type,rsvp_status,dietary_requirements,allergies,accessibility_requirements,requires_highchair,relationship_group,households(household_name),meal_options(name))").eq("wedding_id", wedding.id);
  if (error) return new NextResponse(error.message, { status: 500 });
  const rows = (data || []).map((item) => {
    const table = item.tables as unknown as { name: string; shape: string; capacity: number; notes: string | null } | null;
    const seat = item.seats as unknown as { seat_number: number } | null;
    const guest = item.guests as unknown as { first_name: string; last_name: string | null; preferred_name: string | null; age_group: string; guest_type: string; rsvp_status: string; dietary_requirements: string | null; allergies: string | null; accessibility_requirements: string | null; requires_highchair: boolean; relationship_group: string | null; households: { household_name: string } | null; meal_options: { name: string } | null } | null;
    return { table, seat, guest, locked: item.is_locked };
  }).filter((row) => row.table && row.guest).sort((a, b) => `${a.table!.name}|${a.seat?.seat_number || 999}`.localeCompare(`${b.table!.name}|${b.seat?.seat_number || 999}`, undefined, { numeric: true }));
  const name = (row: typeof rows[number]) => `${row.guest!.preferred_name || row.guest!.first_name} ${row.guest!.last_name || ""}`.trim();
  if (report === "place-cards") return download("place-cards", ["guest", "table", "seat", "meal", "dietary_or_allergy"], rows.map((row) => [name(row), row.table!.name, row.seat?.seat_number, row.guest!.meal_options?.name, row.guest!.allergies || row.guest!.dietary_requirements]));
  if (report === "alphabetical") return download("seating-alphabetical", ["guest", "table", "seat", "household", "guest_type"], [...rows].sort((a, b) => name(a).localeCompare(name(b))).map((row) => [name(row), row.table!.name, row.seat?.seat_number, row.guest!.households?.household_name, row.guest!.guest_type]));
  if (report === "dietary") return download("sensitive-dietary-by-table", ["SENSITIVE_REPORT", "table", "guest", "meal", "allergies", "dietary_requirements"], rows.filter((row) => row.guest!.allergies || row.guest!.dietary_requirements).map((row) => ["Dietary information", row.table!.name, name(row), row.guest!.meal_options?.name, row.guest!.allergies, row.guest!.dietary_requirements]));
  if (report === "accessibility") return download("sensitive-accessibility-by-table", ["SENSITIVE_REPORT", "table", "guest", "accessibility_requirements"], rows.filter((row) => row.guest!.accessibility_requirements).map((row) => ["Accessibility information", row.table!.name, name(row), row.guest!.accessibility_requirements]));
  if (report === "catering") return download("catering-by-table", ["table", "guest", "age_group", "meal", "dietary_requirements", "allergies", "highchair"], rows.map((row) => [row.table!.name, name(row), row.guest!.age_group, row.guest!.meal_options?.name, row.guest!.dietary_requirements, row.guest!.allergies, row.guest!.requires_highchair]));
  if (report === "photographer") return download("photographer-groups", ["table", "guest", "household", "relationship_group"], rows.map((row) => [row.table!.name, name(row), row.guest!.households?.household_name, row.guest!.relationship_group]));
  if (report === "venue") return download("venue-seating-summary", ["table", "shape", "capacity", "assigned_guest", "seat", "locked"], rows.map((row) => [row.table!.name, row.table!.shape, row.table!.capacity, name(row), row.seat?.seat_number, row.locked]));
  return download(report === "guests" ? "guests-by-table" : "full-seating-plan", ["table", "shape", "capacity", "seat", "guest", "household", "rsvp", "guest_type", "meal", "dietary_requirements", "accessibility_requirements", "locked"], rows.map((row) => [row.table!.name, row.table!.shape, row.table!.capacity, row.seat?.seat_number, name(row), row.guest!.households?.household_name, row.guest!.rsvp_status, row.guest!.guest_type, row.guest!.meal_options?.name, row.guest!.dietary_requirements || row.guest!.allergies, row.guest!.accessibility_requirements, row.locked]));
}
