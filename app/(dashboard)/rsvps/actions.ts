"use server";
import { revalidatePath } from "next/cache";
import { getWeddingContext } from "@/lib/wedding";
export async function setSubmissionStatus(id:string,status:"reviewed"|"flagged"|"new"){const {supabase,user,wedding}=await getWeddingContext();if(!wedding)return;const reviewed=status==="reviewed";const {error}=await supabase.from("rsvp_submissions").update({reviewed,reviewed_by:reviewed?user.id:null,reviewed_at:reviewed?new Date().toISOString():null}).eq("id",id).eq("wedding_id",wedding.id);if(error)throw new Error(error.message);revalidatePath("/rsvps")}
