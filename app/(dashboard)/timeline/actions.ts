"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWeddingContext } from "@/lib/wedding";

const val=(form:FormData,key:string)=>String(form.get(key)||"").trim();
const nullable=(form:FormData,key:string)=>val(form,key)||null;
function payload(form:FormData){return{title:val(form,"title"),timeline_type:val(form,"timeline_type")||"wedding_day",event_date:nullable(form,"event_date"),start_time:nullable(form,"start_time"),end_time:nullable(form,"end_time"),location:nullable(form,"location"),category:nullable(form,"category"),assigned_user_id:nullable(form,"assigned_user_id"),supplier_id:nullable(form,"supplier_id"),description:nullable(form,"description"),dependencies:nullable(form,"dependencies"),status:val(form,"status")||"planned",private_notes:nullable(form,"private_notes")};}

export async function addTimelineItem(formData:FormData){const{supabase,wedding}=await getWeddingContext();if(!wedding)redirect("/dashboard");const{data,error}=await supabase.from("timeline_items").insert({wedding_id:wedding.id,...payload(formData)}).select("id").single();if(error)redirect(`/timeline?error=${encodeURIComponent(error.message)}`);await supabase.from("activity_log").insert({wedding_id:wedding.id,action:"timeline_changed",entity_type:"timeline_item",entity_id:data.id,description:`Timeline item added: ${val(formData,"title")}`});revalidatePath("/timeline");redirect(`/timeline?view=${encodeURIComponent(val(formData,"timeline_type")||"wedding_day")}&message=Timeline item added`);}

export async function updateTimelineItem(id:string,formData:FormData){const{supabase,wedding}=await getWeddingContext();if(!wedding)redirect("/dashboard");const{error}=await supabase.from("timeline_items").update(payload(formData)).eq("id",id).eq("wedding_id",wedding.id);if(error)redirect(`/timeline?error=${encodeURIComponent(error.message)}`);await supabase.from("activity_log").insert({wedding_id:wedding.id,action:"timeline_changed",entity_type:"timeline_item",entity_id:id,description:`Timeline item updated: ${val(formData,"title")}`});revalidatePath("/timeline");redirect(`/timeline?view=${encodeURIComponent(val(formData,"timeline_type")||"wedding_day")}&message=Timeline updated`);}

export async function quickUpdateTimeline(id:string,values:{start_time?:string;end_time?:string;status?:string}){const{supabase,wedding}=await getWeddingContext();if(!wedding)throw new Error("Wedding workspace not found.");const{error}=await supabase.from("timeline_items").update(values).eq("id",id).eq("wedding_id",wedding.id);if(error)throw new Error(error.message);revalidatePath("/timeline");}

export async function updateTimelineOrder(ids:string[]){const{supabase,wedding}=await getWeddingContext();if(!wedding)throw new Error("Wedding workspace not found.");const results=await Promise.all(ids.map((id,index)=>supabase.from("timeline_items").update({sort_order:index}).eq("id",id).eq("wedding_id",wedding.id)));const error=results.find(result=>result.error)?.error;if(error)throw new Error(error.message);revalidatePath("/timeline");}

export async function deleteTimelineItem(id:string){const{supabase,wedding}=await getWeddingContext();if(!wedding)redirect("/dashboard");const{error}=await supabase.from("timeline_items").delete().eq("id",id).eq("wedding_id",wedding.id);if(error)redirect(`/timeline?error=${encodeURIComponent(error.message)}`);revalidatePath("/timeline");}
