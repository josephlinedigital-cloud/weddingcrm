"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWeddingContext } from "@/lib/wedding";

const textValue = (value: FormDataEntryValue | null) => String(value || "").trim();

export async function createTable(formData: FormData) {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) redirect("/dashboard");
  const name = textValue(formData.get("name"));
  const capacity = Math.max(1, Number(formData.get("capacity") || 8));
  const { count: duplicateCount } = await supabase.from("tables").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id).ilike("name", name);
  if (duplicateCount) redirect(`/tables?error=${encodeURIComponent(`A table named “${name}” already exists.`)}`);
  const { data: table, error } = await supabase.from("tables").insert({
    wedding_id: wedding.id,
    name,
    shape: textValue(formData.get("shape")) || "round",
    capacity,
    notes: textValue(formData.get("notes")) || null,
    x_position: Number(formData.get("x_position") || 0) || null,
    y_position: Number(formData.get("y_position") || 0) || null,
    width: Number(formData.get("width") || 0) || null,
    height: Number(formData.get("height") || 0) || null,
    rotation: Number(formData.get("rotation") || 0),
  }).select("id").single();
  if (error) redirect(`/tables?error=${encodeURIComponent(error.message)}`);

  const seats = Array.from({ length: capacity }, (_, index) => ({
    wedding_id: wedding.id,
    table_id: table.id,
    seat_number: index + 1,
  }));
  const { error: seatError } = await supabase.from("seats").insert(seats);
  if (seatError) {
    await supabase.from("tables").delete().eq("id", table.id).eq("wedding_id", wedding.id);
    redirect(`/tables?error=${encodeURIComponent("The table could not be prepared. Please try again.")}`);
  }
  await supabase.from("activity_log").insert({ wedding_id: wedding.id, action: "table_created", entity_type: "table", entity_id: table.id, description: `Created ${name}` });
  revalidatePath("/tables");
  const intent = textValue(formData.get("intent"));
  if (intent === "add_another") redirect("/tables?new=1&message=Table added");
  if (intent === "assign") redirect(`/tables?view=assignments&table=${table.id}&message=Table added`);
  if (intent === "venue") redirect(`/tables?view=visual&table=${table.id}&message=Table added`);
  redirect(`/tables?table=${table.id}&message=Table added`);
}

export async function updateTable(tableId: string, formData: FormData) {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) redirect("/dashboard");
  const capacity = Math.max(1, Number(formData.get("capacity") || 8));
  const { data: assignments, error: assignmentError } = await supabase.from("guest_table_assignments").select("id,guest_id,seat_id").eq("wedding_id", wedding.id).eq("table_id", tableId);
  if (assignmentError) redirect(`/tables?error=${encodeURIComponent(assignmentError.message)}`);
  if ((assignments?.length || 0) > capacity) redirect(`/tables?error=${encodeURIComponent("Capacity cannot be lower than the number of assigned guests.")}`);

  const { error } = await supabase.from("tables").update({
    name: textValue(formData.get("name")),
    shape: textValue(formData.get("shape")) || "round",
    capacity,
    notes: textValue(formData.get("notes")) || null,
  }).eq("id", tableId).eq("wedding_id", wedding.id);
  if (error) redirect(`/tables?error=${encodeURIComponent(error.message)}`);

  const { data: existing, error: seatReadError } = await supabase.from("seats").select("id,seat_number").eq("wedding_id", wedding.id).eq("table_id", tableId);
  if (seatReadError) redirect(`/tables?error=${encodeURIComponent(seatReadError.message)}`);
  const current = new Set((existing || []).map(seat => seat.seat_number));
  const missing = Array.from({ length: capacity }, (_, index) => index + 1).filter(seat => !current.has(seat));
  if (missing.length) {
    const { error: insertError } = await supabase.from("seats").insert(missing.map(seat_number => ({ wedding_id: wedding.id, table_id: tableId, seat_number })));
    if (insertError) redirect(`/tables?error=${encodeURIComponent(insertError.message)}`);
  }

  const { data: preparedSeats, error: preparedSeatError } = await supabase.from("seats").select("id,seat_number").eq("wedding_id", wedding.id).eq("table_id", tableId).order("seat_number");
  if (preparedSeatError) redirect(`/tables?error=${encodeURIComponent(preparedSeatError.message)}`);
  const validSeats = (preparedSeats || []).filter(seat => seat.seat_number <= capacity);
  const validIds = new Set(validSeats.map(seat => seat.id));
  const occupied = new Set((assignments || []).map(item => item.seat_id).filter((seatId): seatId is string => Boolean(seatId) && validIds.has(seatId!)));
  for (const assignment of assignments || []) {
    if (assignment.seat_id && validIds.has(assignment.seat_id)) continue;
    const available = validSeats.find(seat => !occupied.has(seat.id));
    if (!available) redirect(`/tables?error=${encodeURIComponent("Seats could not be reorganised for this capacity.")}`);
    const { error: reassignError } = await supabase.from("guest_table_assignments").update({ seat_id: available.id }).eq("id", assignment.id).eq("wedding_id", wedding.id);
    if (reassignError) redirect(`/tables?error=${encodeURIComponent(reassignError.message)}`);
    await supabase.from("guests").update({ table_id: tableId, seat_number: available.seat_number }).eq("id", assignment.guest_id).eq("wedding_id", wedding.id);
    occupied.add(available.id);
  }
  const { error: trimError } = await supabase.from("seats").delete().eq("wedding_id", wedding.id).eq("table_id", tableId).gt("seat_number", capacity);
  if (trimError) redirect(`/tables?error=${encodeURIComponent(trimError.message)}`);
  revalidatePath("/tables");
  redirect("/tables?message=Table updated");
}

export async function deleteTable(tableId: string) {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) redirect("/dashboard");
  const { error } = await supabase.from("tables").delete().eq("id", tableId).eq("wedding_id", wedding.id);
  if (error) redirect(`/tables?error=${encodeURIComponent(error.message)}`);
  await supabase.from("guests").update({ table_id: null, seat_number: null }).eq("wedding_id", wedding.id).eq("table_id", tableId);
  revalidatePath("/tables");
}

export async function moveGuest(guestId: string, destinationTableId: string | null) {
  const { supabase, wedding, user } = await getWeddingContext();
  if (!wedding) throw new Error("Wedding workspace not found.");
  const [{ data: guest, error: guestError }, { data: current, error: currentError }] = await Promise.all([
    supabase.from("guests").select("id,rsvp_status").eq("id", guestId).eq("wedding_id", wedding.id).maybeSingle(),
    supabase.from("guest_table_assignments").select("id,table_id,is_locked").eq("wedding_id", wedding.id).eq("guest_id", guestId).maybeSingle(),
  ]);
  if (guestError || !guest) throw new Error("This guest could not be found in your wedding.");
  if (guest.rsvp_status === "declined") throw new Error("Guests who have declined cannot be added to the seating plan.");
  if (currentError) throw new Error(currentError.message);
  if (current?.is_locked && current.table_id !== destinationTableId) throw new Error("Unlock this guest before moving them.");
  if ((current?.table_id || null) === destinationTableId) return;

  if (!destinationTableId) {
    const { error } = await supabase.from("guest_table_assignments").delete().eq("wedding_id", wedding.id).eq("guest_id", guestId);
    if (error) throw new Error(error.message);
    await supabase.from("guests").update({ table_id: null, seat_number: null }).eq("id", guestId).eq("wedding_id", wedding.id);
  } else {
    const [{ data: table, error: tableError }, { data: assignments, error: assignmentsError }] = await Promise.all([
      supabase.from("tables").select("capacity").eq("id", destinationTableId).eq("wedding_id", wedding.id).single(),
      supabase.from("guest_table_assignments").select("guest_id,seat_id").eq("wedding_id", wedding.id).eq("table_id", destinationTableId),
    ]);
    if (tableError || !table) throw new Error("That table could not be found.");
    if (assignmentsError) throw new Error(assignmentsError.message);
    const others = (assignments || []).filter(item => item.guest_id !== guestId);
    if (others.length >= table.capacity) throw new Error("That table is already at capacity.");

    const seatResult = await supabase.from("seats").select("id,seat_number").eq("wedding_id", wedding.id).eq("table_id", destinationTableId).lte("seat_number", table.capacity).order("seat_number");
    let seats = seatResult.data;
    if (seatResult.error) throw new Error(seatResult.error.message);
    if (!seats || seats.length < table.capacity) {
      const existingNumbers = new Set((seats || []).map(seat => seat.seat_number));
      const rows = Array.from({ length: table.capacity }, (_, index) => index + 1).filter(n => !existingNumbers.has(n)).map(seat_number => ({ wedding_id: wedding.id, table_id: destinationTableId, seat_number }));
      if (rows.length) {
        const { error: insertError } = await supabase.from("seats").insert(rows);
        if (insertError) throw new Error(insertError.message);
      }
      const refreshed = await supabase.from("seats").select("id,seat_number").eq("wedding_id", wedding.id).eq("table_id", destinationTableId).lte("seat_number", table.capacity).order("seat_number");
      if (refreshed.error) throw new Error(refreshed.error.message);
      seats = refreshed.data || [];
    }
    const occupied = new Set(others.map(item => item.seat_id).filter(Boolean));
    const available = (seats || []).find(seat => !occupied.has(seat.id));
    if (!available) throw new Error("No seat is available at this table.");
    const { error } = await supabase.from("guest_table_assignments").upsert({
      wedding_id: wedding.id,
      guest_id: guestId,
      table_id: destinationTableId,
      seat_id: available.id,
      assigned_by: user.id,
    }, { onConflict: "guest_id" });
    if (error) throw new Error(error.message);
    const { error: legacyError } = await supabase.from("guests").update({ table_id: destinationTableId, seat_number: available.seat_number }).eq("id", guestId).eq("wedding_id", wedding.id);
    if (legacyError) throw new Error(legacyError.message);
  }
  await supabase.from("activity_log").insert({ wedding_id: wedding.id, action: "table_assignment_changed", entity_type: "guest", entity_id: guestId, description: destinationTableId ? "Guest table assignment updated" : "Guest returned to the unassigned list" });
  revalidatePath("/tables");
  revalidatePath("/dashboard");
}

export async function toggleGuestLock(assignmentId: string, locked: boolean) {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) throw new Error("Wedding workspace not found.");
  const { error } = await supabase.from("guest_table_assignments").update({ is_locked: locked }).eq("id", assignmentId).eq("wedding_id", wedding.id);
  if (error) throw new Error(error.message);
  revalidatePath("/tables");
}

export async function batchMoveGuests(guestIds: string[], destinationTableId: string | null) {
  if (!guestIds.length) return;
  if (guestIds.length > 250) throw new Error("Move a maximum of 250 guests at once.");
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) throw new Error("Wedding workspace not found.");
  if (destinationTableId) {
    const [{ data: table, error: tableError }, { count, error: countError }] = await Promise.all([
      supabase.from("tables").select("capacity").eq("id", destinationTableId).eq("wedding_id", wedding.id).maybeSingle(),
      supabase.from("guest_table_assignments").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("table_id", destinationTableId).not("guest_id", "in", `(${guestIds.join(",")})`),
    ]);
    if (tableError || !table) throw new Error("That table could not be found.");
    if (countError) throw new Error(countError.message);
    if ((count || 0) + guestIds.length > table.capacity) throw new Error(`This move needs ${guestIds.length} seats, but only ${Math.max(0, table.capacity - (count || 0))} are available.`);
  }
  for (const guestId of guestIds) await moveGuest(guestId, destinationTableId);
  await supabase.from("activity_log").insert({ wedding_id: wedding.id, action: "table_assignment_batch", entity_type: "table", entity_id: destinationTableId, description: destinationTableId ? `Moved ${guestIds.length} guests to a table` : `Returned ${guestIds.length} guests to unassigned` });
  revalidatePath("/tables");
}

export async function toggleAssignmentLocks(assignmentIds: string[], locked: boolean) {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) throw new Error("Wedding workspace not found.");
  if (!assignmentIds.length) return;
  const { error } = await supabase.from("guest_table_assignments").update({ is_locked: locked }).eq("wedding_id", wedding.id).in("id", assignmentIds);
  if (error) throw new Error(error.message);
  await supabase.from("activity_log").insert({ wedding_id: wedding.id, action: locked ? "assignments_locked" : "assignments_unlocked", entity_type: "table", description: `${locked ? "Locked" : "Unlocked"} ${assignmentIds.length} guest assignments` });
  revalidatePath("/tables");
}

export async function changeGuestSeat(assignmentId: string, seatId: string) {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) throw new Error("Wedding workspace not found.");
  const [{ data: assignment }, { data: seat, error: seatError }] = await Promise.all([
    supabase.from("guest_table_assignments").select("guest_id,table_id,is_locked").eq("id", assignmentId).eq("wedding_id", wedding.id).maybeSingle(),
    supabase.from("seats").select("id,table_id,seat_number").eq("id", seatId).eq("wedding_id", wedding.id).maybeSingle(),
  ]);
  if (!assignment || seatError || !seat || seat.table_id !== assignment.table_id) throw new Error("That seat is not available for this table.");
  if (assignment.is_locked) throw new Error("Unlock this assignment before changing its seat.");
  const { count } = await supabase.from("guest_table_assignments").select("id", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("seat_id", seat.id).neq("id", assignmentId);
  if (count) throw new Error("That seat is already occupied.");
  const { error } = await supabase.from("guest_table_assignments").update({ seat_id: seat.id }).eq("id", assignmentId).eq("wedding_id", wedding.id);
  if (error) throw new Error(error.message);
  await supabase.from("guests").update({ table_id: seat.table_id, seat_number: seat.seat_number }).eq("id", assignment.guest_id).eq("wedding_id", wedding.id);
  await supabase.from("activity_log").insert({ wedding_id: wedding.id, action: "seat_changed", entity_type: "guest", entity_id: assignment.guest_id, description: `Seat changed to ${seat.seat_number}` });
  revalidatePath("/tables");
}

export async function duplicateTable(tableId: string) {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) throw new Error("Wedding workspace not found.");
  const { data: source, error } = await supabase.from("tables").select("name,shape,capacity,notes,x_position,y_position,width,height,rotation,sort_order").eq("id", tableId).eq("wedding_id", wedding.id).maybeSingle();
  if (error || !source) throw new Error("The table could not be duplicated.");
  const base = `${source.name} copy`; let name = base; let suffix = 2;
  const { data: names } = await supabase.from("tables").select("name").eq("wedding_id", wedding.id).ilike("name", `${base}%`);
  const used = new Set((names || []).map((item) => item.name.toLowerCase()));
  while (used.has(name.toLowerCase())) name = `${base} ${suffix++}`;
  const { data: created, error: createError } = await supabase.from("tables").insert({ ...source, wedding_id: wedding.id, name, x_position: Number(source.x_position || 0) + 30, y_position: Number(source.y_position || 0) + 30, sort_order: Number(source.sort_order || 0) + 1 }).select("id").single();
  if (createError) throw new Error(createError.message);
  const { error: seatError } = await supabase.from("seats").insert(Array.from({ length: source.capacity }, (_, index) => ({ wedding_id: wedding.id, table_id: created.id, seat_number: index + 1 })));
  if (seatError) throw new Error(seatError.message);
  await supabase.from("activity_log").insert({ wedding_id: wedding.id, action: "table_duplicated", entity_type: "table", entity_id: created.id, description: `Duplicated ${source.name} without guests` });
  revalidatePath("/tables");
  return created.id;
}

export async function saveSeatingSnapshot(name: string) {
  const { supabase, wedding, user } = await getWeddingContext();
  if (!wedding) throw new Error("Wedding workspace not found.");
  const [{ data: tables }, { data: assignments }, { data: seats }, { data: setting }] = await Promise.all([
    supabase.from("tables").select("*").eq("wedding_id", wedding.id),
    supabase.from("guest_table_assignments").select("guest_id,table_id,seat_id,is_locked").eq("wedding_id", wedding.id),
    supabase.from("seats").select("id,table_id,seat_number,x_position,y_position,rotation,is_locked").eq("wedding_id", wedding.id),
    supabase.from("app_settings").select("value").eq("wedding_id", wedding.id).eq("key", "seating_versions_v1").maybeSingle(),
  ]);
  const current = Array.isArray(setting?.value) ? setting.value as unknown[] : [];
  const version = { id: crypto.randomUUID(), name: name.trim() || `Seating plan ${current.length + 1}`, createdAt: new Date().toISOString(), createdBy: user.email || "Wedding user", tables, assignments, seats };
  const { error } = await supabase.from("app_settings").upsert({ wedding_id: wedding.id, key: "seating_versions_v1", value: [...current, version].slice(-20) }, { onConflict: "wedding_id,key" });
  if (error) throw new Error(error.message);
  await supabase.from("activity_log").insert({ wedding_id: wedding.id, action: "seating_snapshot_created", entity_type: "table", description: `Created seating snapshot: ${version.name}` });
  revalidatePath("/tables");
  return version;
}

export async function saveTablePositions(positions:{id:string;x:number;y:number;width:number;height:number;rotation:number}[]){
  const{supabase,wedding}=await getWeddingContext();if(!wedding)throw new Error("Wedding workspace not found.");
  if(!Array.isArray(positions)||positions.length>50)throw new Error("Invalid venue update.");
  for(const position of positions){
    const values={x_position:Math.max(0,Math.min(1000,Number(position.x)||0)),y_position:Math.max(0,Math.min(700,Number(position.y)||0)),width:Math.max(60,Math.min(360,Number(position.width)||120)),height:Math.max(60,Math.min(260,Number(position.height)||120)),rotation:Math.max(-180,Math.min(180,Number(position.rotation)||0))};
    const{error}=await supabase.from("tables").update(values).eq("id",position.id).eq("wedding_id",wedding.id);if(error)throw new Error(error.message);
  }
  revalidatePath("/tables");
}

export async function saveVenueTableDetails(tableId:string,values:{name:string;shape:string;capacity:number;notes:string;width:number;height:number;rotation:number}){
  const{supabase,wedding}=await getWeddingContext();if(!wedding)throw new Error("Wedding workspace not found.");
  const{count}=await supabase.from("guest_table_assignments").select("id",{count:"exact",head:true}).eq("wedding_id",wedding.id).eq("table_id",tableId);
  const capacity=Math.max(count||1,Math.min(40,Number(values.capacity)||8));
  const{error}=await supabase.from("tables").update({name:String(values.name).trim().slice(0,80),shape:["round","rectangular","square","oval"].includes(values.shape)?values.shape:"round",capacity,notes:String(values.notes||"").trim()||null,width:Math.max(60,Math.min(360,Number(values.width)||120)),height:Math.max(60,Math.min(260,Number(values.height)||120)),rotation:Math.max(-180,Math.min(180,Number(values.rotation)||0))}).eq("id",tableId).eq("wedding_id",wedding.id);
  if(error)throw new Error(error.message);revalidatePath("/tables");
}
