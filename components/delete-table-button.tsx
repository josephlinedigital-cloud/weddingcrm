"use client";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteTable } from "@/app/(dashboard)/tables/actions";

export function DeleteTableButton({ tableId, tableName, assigned }: { tableId: string; tableName: string; assigned: number }) {
  const router = useRouter(); const [pending, start] = useTransition();
  function remove() {
    const detail = assigned ? ` ${assigned} assigned guest${assigned === 1 ? "" : "s"} will become unassigned.` : "";
    if (!window.confirm(`Delete ${tableName}?${detail} Guest records will not be deleted.`)) return;
    start(async () => { try { await deleteTable(tableId); toast.success("Table deleted"); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Table could not be deleted"); } });
  }
  return <button className="row-delete" type="button" onClick={remove} disabled={pending} title={`Delete ${tableName}`}><Trash2 /></button>;
}
