"use client";
import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteMealOption } from "@/app/(dashboard)/settings/actions";
export function DeleteMeal({id}:{id:string}){const [pending,start]=useTransition();return <button className="row-delete" disabled={pending} aria-label="Delete meal option" onClick={()=>{if(!confirm("Delete this meal option? Existing guest selections will be cleared."))return;start(async()=>{try{await deleteMealOption(id);toast.success("Meal option deleted")}catch(e){toast.error(e instanceof Error?e.message:"Delete failed")}})}}><Trash2/></button>}
