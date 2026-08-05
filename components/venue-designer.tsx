"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Leaf,
  Lock,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  Search,
  Undo2,
  UsersRound,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import type { SeatingGuest, SeatingTable } from "@/components/seating-planner";
import { moveGuest, saveTablePositions, saveVenueTableDetails } from "@/app/(dashboard)/tables/actions";

type CanvasTable = SeatingTable & { x: number; y: number; w: number; h: number; rotation: number };
type PositionSnapshot = Array<{ id: string; x: number; y: number; w: number; h: number; rotation: number }>;

const snapshot = (rows: CanvasTable[]): PositionSnapshot => rows.map(({ id, x, y, w, h, rotation }) => ({ id, x, y, w, h, rotation }));
const defaultPosition = (table: SeatingTable, index: number) => ({
  x: Number(table.x_position ?? 105 + (index % 4) * 220),
  y: Number(table.y_position ?? 120 + Math.floor(index / 4) * 205),
  w: Number(table.width ?? (table.shape === "round" || table.shape === "square" ? 140 : 190)),
  h: Number(table.height ?? (table.shape === "round" || table.shape === "square" ? 140 : 110)),
  rotation: Number(table.rotation || 0),
});

export function VenueDesigner({ tables, unassigned, weddingName, onAddTable }: { tables: SeatingTable[]; unassigned: SeatingGuest[]; weddingName: string; onAddTable: () => void }) {
  const router = useRouter();
  const drag = useRef<{ id: string; sx: number; sy: number; x: number; y: number } | null>(null);
  const latestRows = useRef<CanvasTable[]>([]);
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<CanvasTable[]>(() => tables.map((table, index) => ({ ...table, ...defaultPosition(table, index) })));
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [query, setQuery] = useState("");
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(false);
  const [status, setStatus] = useState<"saved" | "saving" | "failed">("saved");
  const [past, setPast] = useState<PositionSnapshot[]>([]);
  const [future, setFuture] = useState<PositionSnapshot[]>([]);

  useEffect(() => {
    latestRows.current = rows;
  }, [rows]);

  useEffect(() => {
    setRows((current) => tables.map((table, index) => {
      const existing = current.find((item) => item.id === table.id);
      return existing ? { ...existing, ...table } : { ...table, ...defaultPosition(table, index) };
    }));
  }, [tables]);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    setLeft(false);
    setRight(false);
    setZoom(0.65);
  }, []);

  const active = rows.find((table) => table.id === selected) || null;
  const shown = useMemo(() => unassigned.filter((guest) => `${guest.first_name} ${guest.last_name} ${guest.household_name || ""}`.toLowerCase().includes(query.toLowerCase())), [unassigned, query]);

  function persist(values = snapshot(latestRows.current)) {
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveTablePositions(values.map((position) => ({ id: position.id, x: position.x, y: position.y, width: position.w, height: position.h, rotation: position.rotation })));
        setStatus("saved");
      } catch (error) {
        setStatus("failed");
        toast.error(error instanceof Error ? error.message : "Table positions could not be saved");
      }
    });
  }

  function restore(values: PositionSnapshot) {
    setRows((current) => current.map((row) => {
      const value = values.find((item) => item.id === row.id);
      return value ? { ...row, ...value } : row;
    }));
    persist(values);
  }

  function pushHistory() {
    setPast((current) => [...current.slice(-24), snapshot(latestRows.current)]);
    setFuture([]);
  }

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((current) => [snapshot(latestRows.current), ...current]);
    setPast((current) => current.slice(0, -1));
    restore(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((current) => [...current, snapshot(latestRows.current)]);
    setFuture((current) => current.slice(1));
    restore(next);
  }

  function startDragging(event: React.PointerEvent, id: string) {
    if ((event.target as HTMLElement).closest("button,input,select,textarea")) return;
    const row = latestRows.current.find((item) => item.id === id);
    if (!row) return;
    pushHistory();
    setSelected(id);
    setRight(true);
    drag.current = { id, sx: event.clientX, sy: event.clientY, x: row.x, y: row.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDragging(event: React.PointerEvent) {
    const currentDrag = drag.current;
    if (!currentDrag) return;
    const activeRow = latestRows.current.find((item) => item.id === currentDrag.id);
    if (!activeRow) return;
    let x = currentDrag.x + (event.clientX - currentDrag.sx) / zoom;
    let y = currentDrag.y + (event.clientY - currentDrag.sy) / zoom;
    if (snap) {
      x = Math.round(x / 10) * 10;
      y = Math.round(y / 10) * 10;
    }
    setRows((current) => current.map((table) => table.id === currentDrag.id ? {
      ...table,
      x: Math.max(0, Math.min(1000 - activeRow.w, x)),
      y: Math.max(0, Math.min(700 - activeRow.h, y)),
    } : table));
  }

  function stopDragging() {
    if (!drag.current) return;
    drag.current = null;
    window.setTimeout(() => persist(snapshot(latestRows.current)), 0);
  }

  function keyDown(event: React.KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if (!active) return;
    const step = event.shiftKey ? 20 : 5;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      pushHistory();
      setRows((current) => current.map((table) => table.id === active.id ? {
        ...table,
        x: Math.max(0, Math.min(1000 - table.w, table.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0))),
        y: Math.max(0, Math.min(700 - table.h, table.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0))),
      } : table));
      window.setTimeout(() => persist(snapshot(latestRows.current)), 0);
    }
    if (event.key === "Escape") {
      setSelected(null);
      setRight(false);
    }
  }

  async function assign(guestId: string, tableId: string) {
    try {
      await moveGuest(guestId, tableId || null);
      toast.success(tableId ? "Guest added to table" : "Guest returned to unassigned");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the guest");
    }
  }

  async function saveDetails(form: FormData) {
    if (!active) return;
    const nextShape = String(form.get("shape") || active.shape);
    const values = {
      name: String(form.get("name") || active.name),
      shape: nextShape,
      capacity: Number(form.get("capacity") || active.capacity),
      notes: String(form.get("notes") || ""),
      width: Number(form.get("width") || active.w),
      height: Number(form.get("height") || active.h),
      rotation: Number(form.get("rotation") || active.rotation),
    };
    setStatus("saving");
    try {
      await saveVenueTableDetails(active.id, values);
      setRows((current) => current.map((table) => table.id === active.id ? { ...table, ...values, w: values.width, h: values.height } : table));
      setStatus("saved");
      toast.success("Table changes saved");
      router.refresh();
    } catch (error) {
      setStatus("failed");
      toast.error(error instanceof Error ? error.message : "Could not update the table");
    }
  }

  return <div className="venue-designer" onKeyDown={keyDown} tabIndex={0} aria-label="Interactive wedding table floor plan">
    <div className="venue-toolbar" role="toolbar" aria-label="Floor plan tools">
      <button className="venue-add-table" onClick={onAddTable}><Plus /><span>Add round table</span></button>
      <i />
      <button className="active" title="Select and move tables"><MousePointer2 /></button>
      <button onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)"><Undo2 /></button>
      <button onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)"><Redo2 /></button>
      <i />
      <button onClick={() => setZoom((value) => Math.max(0.4, value - 0.1))} title="Zoom out"><ZoomOut /></button>
      <strong>{Math.round(zoom * 100)}%</strong>
      <button onClick={() => setZoom((value) => Math.min(1.3, value + 0.1))} title="Zoom in"><ZoomIn /></button>
      <button onClick={() => setZoom(0.8)} title="Fit floor plan"><Maximize2 /></button>
      <i />
      <button className={grid ? "active" : ""} onClick={() => setGrid(!grid)} title="Show or hide grid"><Grid3X3 /></button>
      <button className={snap ? "active" : ""} onClick={() => setSnap(!snap)} title="Snap tables to grid"><span className="snap-icon">S</span></button>
      <span className={`venue-save ${status}`}><Save />{status === "saving" || pending ? "Saving…" : status === "failed" ? "Save failed" : "Saved"}</span>
    </div>

    <div className={`venue-workspace ${left ? "" : "left-closed"} ${right ? "" : "right-closed"}`}>
      <aside className="venue-left">
        <button className="panel-collapse" onClick={() => setLeft(false)} title="Close tables and guests"><ChevronLeft /></button>
        <header><p className="eyebrow">Your plan</p><h2>Tables & guests</h2></header>
        <div className="venue-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a guest" /></div>
        <details open>
          <summary>Tables <span>{rows.length}</span></summary>
          <div className="venue-table-list">{rows.map((table) => <button className={selected === table.id ? "active" : ""} key={table.id} onClick={() => { setSelected(table.id); setRight(true); }}><span className={`table-mini ${table.shape}`} /><span><strong>{table.name}</strong><small>{table.assignments.length}/{table.capacity} seated · {table.shape}</small></span></button>)}</div>
        </details>
        <details open>
          <summary>Unassigned guests <span>{shown.length}</span></summary>
          <div className="venue-guest-list">{shown.map((guest) => <div key={guest.id}><span className="avatar">{guest.first_name[0]}{guest.last_name?.[0]}</span><div><strong>{guest.first_name} {guest.last_name}</strong><small>{guest.household_name || "No household"}</small></div>{guest.dietary_requirements && <Leaf />}<select aria-label={`Assign ${guest.first_name}`} defaultValue="" onChange={(event) => assign(guest.id, event.target.value)}><option value="">Assign…</option>{rows.filter((table) => table.assignments.length < table.capacity).map((table) => <option value={table.id} key={table.id}>{table.name}</option>)}</select></div>)}{!shown.length && <p className="venue-empty">Everyone has a seat.</p>}</div>
        </details>
      </aside>

      {!left && <button className="panel-reopen left" onClick={() => setLeft(true)} aria-label="Open tables and guests"><UsersRound /></button>}

      <main className="venue-canvas-shell">
        <div className="venue-canvas-scroll">
          <div className={`venue-canvas ${grid ? "show-grid" : ""}`} style={{ transform: `scale(${zoom})` }} onPointerMove={moveDragging} onPointerUp={stopDragging} onPointerCancel={stopDragging} onClick={(event) => { if (event.target === event.currentTarget) { setSelected(null); setRight(false); } }}>
            <div className="room-label"><strong>{weddingName}</strong><span>Reception floor plan</span></div>
            <div className="room-instruction"><MousePointer2 /><span><strong>Move a table</strong>Drag it anywhere in the room</span></div>
            {rows.map((table) => {
              const seatCount = Math.min(table.capacity, 16);
              const seatRadius = Math.max(52, Math.min(86, Math.min(table.w, table.h) / 2 + 18));
              return <div key={table.id} className={`canvas-table ${table.shape} ${selected === table.id ? "selected" : ""}`} style={{ left: table.x, top: table.y, width: table.w, height: table.h, transform: `rotate(${table.rotation}deg)` }} onPointerDown={(event) => startDragging(event, table.id)} role="button" tabIndex={0} aria-label={`${table.name}, ${table.assignments.length} of ${table.capacity} seats occupied. Drag to move or select to edit.`}>
                <span className="selection-handle nw" /><span className="selection-handle se" />
                <span className="canvas-table-type">{table.shape === "round" ? "Round table" : table.shape}</span>
                <strong>{table.name}</strong><small>{table.assignments.length} of {table.capacity} guests</small>
                <div className="canvas-seats">{Array.from({ length: seatCount }, (_, index) => {
                  const angle = (360 / seatCount) * index;
                  return <i className={index < table.assignments.length ? "occupied" : ""} style={{ "--seat-angle": `${angle}deg`, "--seat-radius": `${seatRadius}px` } as React.CSSProperties} key={index} title={table.assignments[index] ? `${table.assignments[index].guest.first_name} ${table.assignments[index].guest.last_name}` : `Empty seat ${index + 1}`}><span>{table.assignments[index]?.guest.first_name[0] || ""}</span></i>;
                })}</div>
                {table.assignments.some((assignment) => assignment.guest.dietary_requirements) && <em title="Dietary requirements"><Leaf /></em>}
                {table.assignments.some((assignment) => assignment.is_locked) && <b title="Locked seats"><Lock /></b>}
              </div>;
            })}
            {!rows.length && <button className="venue-canvas-empty" onClick={onAddTable}><span><Plus /></span><strong>Add your first round table</strong><small>Then drag it into position and adjust its seats.</small></button>}
          </div>
        </div>
        <div className="venue-notice">Table positions save automatically. Confirm final measurements and access routes with your venue.</div>
      </main>

      {!right && selected && <button className="panel-reopen right" onClick={() => setRight(true)} aria-label="Open selected table settings"><ChevronLeft /></button>}

      <aside className="venue-right">
        <button className="panel-collapse" onClick={() => setRight(false)} title="Close table settings"><ChevronRight /></button>
        {active ? <>
          <header><p className="eyebrow">Selected table</p><h2>{active.name}</h2><span className="venue-edit-hint">Change the table, then save.</span></header>
          <form key={active.id} action={saveDetails} className="venue-properties">
            <label>Table name<input name="name" defaultValue={active.name} /></label>
            <div><label>Shape<select name="shape" defaultValue={active.shape}><option value="round">Round</option><option value="rectangular">Rectangle</option><option value="square">Square</option><option value="oval">Oval</option></select></label><label>Number of seats<input name="capacity" type="number" min={active.assignments.length || 1} max="40" defaultValue={active.capacity} /></label></div>
            <div><label>Width<input name="width" type="number" min="60" max="360" defaultValue={Math.round(active.w)} /></label><label>Height<input name="height" type="number" min="60" max="260" defaultValue={Math.round(active.h)} /></label></div>
            <label>Rotation<input name="rotation" type="number" min="-180" max="180" defaultValue={active.rotation} /></label>
            <label>Notes<textarea name="notes" defaultValue={active.notes || ""} placeholder="Venue, catering or accessibility notes" /></label>
            <button className="button button-primary" disabled={pending}><Save />Save table changes</button>
          </form>
          <section className="venue-assigned"><header><strong>Guests at this table</strong><span>{active.assignments.length} of {active.capacity}</span></header>{active.assignments.map((assignment) => <div key={assignment.id}><span className="avatar">{assignment.guest.first_name[0]}{assignment.guest.last_name?.[0]}</span><div><strong>{assignment.guest.first_name} {assignment.guest.last_name}</strong><small>Seat {assignment.seat_number || "—"}</small></div>{assignment.guest.dietary_requirements && <Leaf />}<button onClick={() => assign(assignment.guest_id, "")} title="Remove from table"><Minus /></button></div>)}</section>
        </> : <div className="venue-no-selection"><UsersRound /><h2>Select a table</h2><p>Tap any table on the floor plan to change its shape, size, seats, rotation, notes and guests.</p></div>}
      </aside>
    </div>
  </div>;
}
