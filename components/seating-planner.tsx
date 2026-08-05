"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVertical, Leaf, Lock, LockOpen, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { moveGuest, toggleGuestLock } from "@/app/(dashboard)/tables/actions";

export type SeatingGuest = { id: string; first_name: string; last_name: string; age_group: string; rsvp_status: string; dietary_requirements: string | null; household_name: string | null };
export type SeatingAssignment = { id: string; guest_id: string; seat_number: number | null; is_locked: boolean; guest: SeatingGuest };
export type SeatingTable = { id: string; name: string; shape: string; capacity: number; notes: string | null; x_position:number|null; y_position:number|null; width:number|null; height:number|null; rotation:number; assignments: SeatingAssignment[] };

function GuestChip({ guest, assignment, tables, currentTableId = null }: { guest: SeatingGuest; assignment?: SeatingAssignment; tables: SeatingTable[]; currentTableId?: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const locked = Boolean(assignment?.is_locked);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `guest:${guest.id}`,
    disabled: locked || pending,
    data: { guest, tableId: currentTableId },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  function lock() {
    if (!assignment) return;
    startTransition(async () => {
      try { await toggleGuestLock(assignment.id, !assignment.is_locked); router.refresh(); toast.success(assignment.is_locked ? "Guest unlocked" : "Guest locked in place"); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Could not update lock"); }
    });
  }

  function selectMove(value: string) {
    if ((value || null) === currentTableId) return;
    startTransition(async () => {
      try { await moveGuest(guest.id, value || null); router.refresh(); toast.success(value ? "Guest seated" : "Guest returned to unassigned"); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Could not move guest"); }
    });
  }

  return <div ref={setNodeRef} style={style} className={`seat-guest ${locked ? "locked" : ""} ${pending ? "pending" : ""} ${isDragging ? "dragging" : ""}`}>
    <button className="drag-handle" type="button" aria-label={`${locked ? "Unlock before moving" : "Drag"} ${guest.first_name} ${guest.last_name}`} disabled={locked || pending} {...listeners} {...attributes}><GripVertical /></button>
    <div className="seat-guest-name"><strong>{guest.first_name} {guest.last_name}</strong><small>{assignment?.seat_number ? `Seat ${assignment.seat_number} · ${guest.household_name || "No household"}` : guest.household_name || "No household"}</small></div>
    <div className="guest-markers">{guest.rsvp_status !== "attending" && <span className="rsvp-marker" title={`RSVP: ${guest.rsvp_status.replaceAll("_", " ")}`}>?</span>}{guest.dietary_requirements && <span title={guest.dietary_requirements}><Leaf /></span>}{guest.age_group !== "adult" && <span className="child-marker" title={guest.age_group}>C</span>}</div>
    <select className="mobile-seat-select" aria-label={`Assign ${guest.first_name} to a table`} value={currentTableId || ""} onChange={(event) => selectMove(event.target.value)} disabled={pending || locked}>
      <option value="">Unassigned</option>
      {tables.map((table) => <option key={table.id} value={table.id} disabled={table.id !== currentTableId && table.assignments.length >= table.capacity}>{table.name} ({table.assignments.length}/{table.capacity})</option>)}
    </select>
    {assignment && <button type="button" className="lock-button" title={assignment.is_locked ? "Unlock guest" : "Lock guest in this seat"} aria-label={assignment.is_locked ? `Unlock ${guest.first_name}` : `Lock ${guest.first_name}`} onClick={lock}>{assignment.is_locked ? <Lock /> : <LockOpen />}</button>}
  </div>;
}

function GuestOverlay({ guest }: { guest: SeatingGuest }) {
  return <div className="seat-guest drag-overlay"><GripVertical /><div className="seat-guest-name"><strong>{guest.first_name} {guest.last_name}</strong><small>{guest.household_name || "No household"}</small></div></div>;
}

function TableDrop({ table, allTables }: { table: SeatingTable; allTables: SeatingTable[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `table:${table.id}`, data: { tableId: table.id } });
  const full = table.assignments.length >= table.capacity;
  return <article ref={setNodeRef} className={`seating-table ${table.shape} ${isOver ? "drop-active" : ""} ${full ? "table-full" : ""}`}>
    <div className="seating-table-head"><div><h3>{table.name}</h3><p>{table.shape} table</p></div><span className={full ? "badge badge-danger" : "badge badge-success"}>{table.assignments.length} / {table.capacity}</span></div>
    <div className="table-guests">{table.assignments.length ? table.assignments.map((assignment) => <GuestChip key={assignment.id} guest={assignment.guest} assignment={assignment} tables={allTables} currentTableId={table.id} />) : <div className="table-drop-hint">Drop attending guests here</div>}</div>
    {table.notes && <p className="table-note">{table.notes}</p>}
  </article>;
}

export function SeatingPlanner({ tables, unassigned }: { tables: SeatingTable[]; unassigned: SeatingGuest[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [activeGuest, setActiveGuest] = useState<SeatingGuest | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 10 } }),
    useSensor(KeyboardSensor),
  );
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned" });
  const shown = useMemo(() => unassigned.filter((guest) => `${guest.first_name} ${guest.last_name} ${guest.household_name || ""}`.toLowerCase().includes(query.toLowerCase())), [query, unassigned]);

  function onDragStart(event: DragStartEvent) {
    setActiveGuest(event.active.data.current?.guest as SeatingGuest || null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveGuest(null);
    const guestId = String(event.active.id).replace("guest:", "");
    const over = event.over?.id ? String(event.over.id) : "";
    if (!over) return;
    const destination = over === "unassigned" ? null : over.replace("table:", "");
    const currentTableId = (event.active.data.current?.tableId as string | null) || null;
    if (destination === currentTableId) return;
    const target = destination ? tables.find((table) => table.id === destination) : null;
    if (target && target.assignments.length >= target.capacity) { toast.error(`${target.name} is already full`); return; }
    startTransition(async () => {
      try { await moveGuest(guestId, destination); router.refresh(); toast.success(destination ? `Guest moved to ${target?.name || "table"}` : "Guest returned to unassigned"); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Could not move guest"); }
    });
  }

  return <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragCancel={() => setActiveGuest(null)} onDragEnd={onDragEnd}>
    <div className={`planner-shell ${pending ? "planner-pending" : ""}`}>
      <aside ref={setNodeRef} className={`unassigned-panel card ${isOver ? "drop-active" : ""}`}>
        <div className="unassigned-head"><div><h2>Unassigned</h2><p>{unassigned.length} guest{unassigned.length === 1 ? "" : "s"} to place</p></div><UsersRound /></div>
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a guest" aria-label="Find unassigned guest" />
        <div className="unassigned-list">{shown.map((guest) => <GuestChip key={guest.id} guest={guest} tables={tables} />)}{!shown.length && <div className="empty compact"><p>{unassigned.length ? "No matching guests" : "Everyone has a seat."}</p></div>}</div>
      </aside>
      <section className="table-floor" aria-label="Seating tables">{tables.length ? tables.map((table) => <TableDrop key={table.id} table={table} allTables={tables} />) : <div className="card empty planner-empty"><div className="empty-icon"><UsersRound /></div><h2>Create your first table</h2><p>Then drag attending guests into place.</p></div>}</section>
    </div>
    <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.22,1,.36,1)" }}>{activeGuest ? <GuestOverlay guest={activeGuest} /> : null}</DragOverlay>
  </DndContext>;
}
