"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { setTaskStatus } from "@/app/(dashboard)/tasks/actions";

export type DashboardPriority = {
  id: string;
  title: string;
  dueLabel: string;
  priority: string;
  attention: "overdue" | "today" | "week";
};

const addItems = [
  ["Add guest", "/guests?new=1"],
  ["Add task", "/tasks?new=1"],
  ["Add calendar event", "/calendar?new=1"],
  ["Add supplier", "/suppliers?new=1"],
  ["Record payment", "/budget"],
] as const;

export function DashboardAddMenu() {
  return <details className="dashboard-add-menu">
    <summary className="button button-primary"><Plus />Add item<ChevronDown /></summary>
    <nav aria-label="Add planning item">{addItems.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</nav>
  </details>;
}

export function DashboardPriorities({ initialItems }: { initialItems: DashboardPriority[] }) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();

  function complete(item: DashboardPriority) {
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    startTransition(async () => {
      try {
        await setTaskStatus(item.id, "completed");
        toast.success("Task completed");
      } catch (error) {
        setItems(initialItems);
        toast.error(error instanceof Error ? error.message : "Could not complete task.");
      }
    });
  }

  return <div className={`editorial-priority-list ${isPending ? "is-saving" : ""}`}>
    {items.length ? items.slice(0, 5).map((item) => <div className="editorial-priority-row" key={item.id}>
      <button type="button" onClick={() => complete(item)} aria-label={`Complete ${item.title}`}><Check /></button>
      <div><strong>{item.title}</strong><span>{item.dueLabel}</span></div>
      {(item.priority === "urgent" || item.priority === "high" || item.attention === "overdue") && <em className={item.attention === "overdue" ? "overdue" : ""}>{item.attention === "overdue" ? "Overdue" : item.priority}</em>}
    </div>) : <div className="editorial-empty"><p>No urgent tasks right now.</p><Link href="/tasks?new=1">Add a task</Link></div>}
    <Link className="editorial-section-link" href="/tasks">View all tasks</Link>
  </div>;
}

