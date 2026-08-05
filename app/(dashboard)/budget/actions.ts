"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWeddingContext } from "@/lib/wedding";

const value=(form:FormData,key:string)=>String(form.get(key)||"").trim();
const nullable=(form:FormData,key:string)=>value(form,key)||null;
const money=(form:FormData,key:string)=>Math.max(0,Number(form.get(key)||0));

async function attachInvoice(formData:FormData,budgetItemId:string,supplierId?:string|null){
  const file=formData.get("attachment");
  if(!(file instanceof File)||!file.size)return null;
  const {supabase,wedding,user}=await getWeddingContext(); if(!wedding)return "Wedding workspace not found.";
  if(file.size>10*1024*1024)return "Attachments must be smaller than 10 MB.";
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-"); const path=`${wedding.id}/budget/${budgetItemId}/${crypto.randomUUID()}-${safe}`;
  const {error:uploadError}=await supabase.storage.from("wedding-documents").upload(path,file,{contentType:file.type||undefined});
  if(uploadError)return uploadError.message;
  const {error}=await supabase.from("documents").insert({wedding_id:wedding.id,budget_item_id:budgetItemId,supplier_id:supplierId||null,category:file.type.includes("pdf")?"invoice":"receipt",name:file.name,file_path:path,file_name:file.name,mime_type:file.type||null,file_size:file.size,uploaded_by:user.id});
  return error?.message||null;
}

export async function addBudgetCategory(formData:FormData){
  const {supabase,wedding}=await getWeddingContext();if(!wedding)redirect("/dashboard");
  const {error}=await supabase.from("budget_categories").insert({wedding_id:wedding.id,name:value(formData,"name"),planned_amount:money(formData,"planned_amount")});
  if(error)redirect(`/budget?error=${encodeURIComponent(error.message)}`);revalidatePath("/budget");redirect("/budget?message=Category added");
}

export async function addBudgetItem(formData:FormData){
  const {supabase,wedding}=await getWeddingContext();if(!wedding)redirect("/dashboard");
  const estimated=money(formData,"estimated_amount"),quoted=money(formData,"quoted_amount"),enteredFinal=money(formData,"final_amount"),finalAmount=enteredFinal||quoted||estimated;
  const supplierId=nullable(formData,"supplier_id");
  const {data,error}=await supabase.from("budget_items").insert({wedding_id:wedding.id,name:value(formData,"name"),category_id:nullable(formData,"category_id"),supplier_id:supplierId,estimated_amount:estimated,quoted_amount:quoted,final_amount:finalAmount,deposit_amount:money(formData,"deposit_amount"),payment_due_date:nullable(formData,"payment_due_date"),payment_method:nullable(formData,"payment_method"),invoice_reference:nullable(formData,"invoice_reference"),notes:nullable(formData,"notes"),payment_status:finalAmount>0?"due":"not_due"}).select("id").single();
  if(error)redirect(`/budget?error=${encodeURIComponent(error.message)}`);
  const attachmentError=await attachInvoice(formData,data.id,supplierId);if(attachmentError)redirect(`/budget?error=${encodeURIComponent(attachmentError)}`);
  revalidatePath("/budget");revalidatePath("/dashboard");redirect("/budget?message=Budget item added");
}

export async function updateBudgetItem(itemId:string,formData:FormData){
  const {supabase,wedding}=await getWeddingContext();if(!wedding)redirect("/dashboard");
  const estimated=money(formData,"estimated_amount"),quoted=money(formData,"quoted_amount"),enteredFinal=money(formData,"final_amount"),finalAmount=enteredFinal||quoted||estimated;const supplierId=nullable(formData,"supplier_id");
  const {error}=await supabase.from("budget_items").update({name:value(formData,"name"),category_id:nullable(formData,"category_id"),supplier_id:supplierId,estimated_amount:estimated,quoted_amount:quoted,final_amount:finalAmount,deposit_amount:money(formData,"deposit_amount"),payment_due_date:nullable(formData,"payment_due_date"),payment_method:nullable(formData,"payment_method"),invoice_reference:nullable(formData,"invoice_reference"),notes:nullable(formData,"notes")}).eq("id",itemId).eq("wedding_id",wedding.id);
  if(error)redirect(`/budget?error=${encodeURIComponent(error.message)}`);const attachmentError=await attachInvoice(formData,itemId,supplierId);if(attachmentError)redirect(`/budget?error=${encodeURIComponent(attachmentError)}`);
  revalidatePath("/budget");revalidatePath("/dashboard");redirect("/budget?message=Budget item updated");
}

export async function recordPayment(itemId:string,supplierId:string|null,formData:FormData){
  const {supabase,wedding,user}=await getWeddingContext();if(!wedding)redirect("/dashboard");
  const {error}=await supabase.from("payment_records").insert({wedding_id:wedding.id,budget_item_id:itemId,supplier_id:supplierId,amount:money(formData,"amount"),payment_date:value(formData,"payment_date")||new Date().toISOString().slice(0,10),payment_method:nullable(formData,"payment_method"),reference:nullable(formData,"reference"),notes:nullable(formData,"payment_notes"),created_by:user.id});
  if(error)redirect(`/budget?error=${encodeURIComponent(error.message)}`);await supabase.from("activity_log").insert({wedding_id:wedding.id,action:"payment_recorded",entity_type:"budget_item",entity_id:itemId,description:`Payment recorded for ${value(formData,"item_name")}`});
  revalidatePath("/budget");revalidatePath("/dashboard");redirect("/budget?message=Payment recorded");
}

export async function deleteBudgetItem(itemId:string){
  const {supabase,wedding}=await getWeddingContext();if(!wedding)redirect("/dashboard");const {error}=await supabase.from("budget_items").delete().eq("id",itemId).eq("wedding_id",wedding.id);if(error)redirect(`/budget?error=${encodeURIComponent(error.message)}`);revalidatePath("/budget");revalidatePath("/dashboard");
}
