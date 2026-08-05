"use client";
import { Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setTaskStatus, toggleChecklistItem } from "@/app/(dashboard)/tasks/actions";

export function TaskStatus({id,status}:{id:string;status:string}){const router=useRouter();const[pending,startTransition]=useTransition();return <select className="task-status-select" value={status} disabled={pending} onChange={e=>{const next=e.target.value;startTransition(async()=>{try{await setTaskStatus(id,next);router.refresh();toast.success(next==="completed"?"Task completed":"Task status updated");}catch(error){toast.error(error instanceof Error?error.message:"Could not update task");}})}} aria-label="Task status"><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>}
export function ChecklistToggle({id,complete,title}:{id:string;complete:boolean;title:string}){const router=useRouter();const[pending,startTransition]=useTransition();return <button type="button" className={`checklist-toggle ${complete?"complete":""}`} disabled={pending} onClick={()=>startTransition(async()=>{try{await toggleChecklistItem(id,!complete);router.refresh();}catch(error){toast.error(error instanceof Error?error.message:"Could not update checklist");}})} aria-label={`${complete?"Reopen":"Complete"} ${title}`}><span>{complete?<Check/>:null}</span><strong>{title}</strong></button>}
export function DeleteIcon(){return <Trash2/>}
