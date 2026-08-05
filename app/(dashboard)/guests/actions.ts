"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWeddingContext } from "@/lib/wedding";
import { moveGuest } from "../tables/actions";

const nullable = (v: FormDataEntryValue | null) => String(v || "").trim() || null;
const checked = (f: FormData, key:string) => f.get(key)==="on" || f.get(key)==="true";

export async function addGuest(formData: FormData) {
  const { supabase, wedding } = await getWeddingContext();
  if (!wedding) redirect("/dashboard");
  let householdId = nullable(formData.get("household_id"));
  const newHousehold = nullable(formData.get("new_household"));
  if (!householdId && newHousehold) {
    const { data, error } = await supabase.from("households").insert({ wedding_id:wedding.id, household_name:newHousehold }).select("id").single();
    if (error) redirect(`/guests?error=${encodeURIComponent(error.message)}`);
    householdId = data.id;
  }
  const { data, error } = await supabase.from("guests").insert({
    wedding_id:wedding.id, household_id:householdId, first_name:String(formData.get("first_name")||"").trim(), last_name:String(formData.get("last_name")||"").trim(),
    preferred_name:nullable(formData.get("preferred_name")), guest_type:String(formData.get("guest_type")||"day"), age_group:String(formData.get("age_group")||"adult"),
    email:nullable(formData.get("email")), phone:nullable(formData.get("telephone")), plus_one_allowed:checked(formData,"plus_one_allowed"), plus_one_name:nullable(formData.get("plus_one_name")), private_notes:nullable(formData.get("private_notes")),
    rsvp_status:String(formData.get("rsvp_status")||"awaiting"), invitation_status:String(formData.get("invitation_status")||"not_sent"), meal_option_id:nullable(formData.get("meal_option_id")),
    dietary_requirements:nullable(formData.get("dietary_requirements")), allergies:nullable(formData.get("allergies")), accessibility_requirements:nullable(formData.get("accessibility_requirements")),
    requires_highchair:checked(formData,"requires_highchair"), requires_accommodation:checked(formData,"requires_accommodation"), accommodation_notes:nullable(formData.get("accommodation_notes")),
    requires_transport:checked(formData,"requires_transport"), transport_notes:nullable(formData.get("transport_notes")), is_vip:checked(formData,"is_vip"),
  }).select("id").single();
  if (error) redirect(`/guests?error=${encodeURIComponent(error.message)}`);
  await supabase.from("activity_log").insert({wedding_id:wedding.id,action:"guest_added",entity_type:"guest",entity_id:data.id,description:`Guest added: ${formData.get("first_name")} ${formData.get("last_name")}`});
  const tableId=nullable(formData.get("table_id"));if(tableId)await moveGuest(data.id,tableId);
  revalidatePath("/guests");
  const intent=String(formData.get("intent")||"save");
  if(intent==="add_another")redirect(`/guests?new=1&household=${householdId||""}&message=Guest added`);
  if(intent==="open")redirect(`/guests?guest=${data.id}&message=Guest added`);
  redirect("/guests?message=Guest added");
}

export async function updateGuest(id:string, formData:FormData) {
  const { supabase, wedding } = await getWeddingContext(); if(!wedding) redirect("/dashboard");
  const keys=["first_name","last_name","preferred_name","email","plus_one_name","dietary_requirements","allergies","accessibility_requirements","private_notes"];
  const values:Record<string,unknown>={}; keys.forEach(k=>values[k]=nullable(formData.get(k)));
  Object.assign(values,{phone:nullable(formData.get("telephone")),accommodation_notes:nullable(formData.get("accommodation_details")),household_id:nullable(formData.get("household_id")),guest_type:String(formData.get("guest_type")||"day"),age_group:String(formData.get("age_group")||"adult"),rsvp_status:String(formData.get("rsvp_status")||"awaiting"),invitation_status:String(formData.get("invitation_status")||"not_sent"),meal_option_id:nullable(formData.get("meal_option_id")),seat_number:nullable(formData.get("seat_number"))?Number(formData.get("seat_number")):null,plus_one_allowed:checked(formData,"plus_one_allowed"),requires_accommodation:checked(formData,"accommodation_required"),requires_transport:checked(formData,"transport_required"),gift_received:checked(formData,"gift_received"),thank_you_sent:checked(formData,"thank_you_sent")});
  const {error}=await supabase.from("guests").update(values).eq("id",id).eq("wedding_id",wedding.id);
  if(error) redirect(`/guests/${id}?error=${encodeURIComponent(error.message)}`);
  await supabase.from("activity_log").insert({wedding_id:wedding.id,action:"guest_updated",entity_type:"guest",entity_id:id,description:`Guest updated: ${values.first_name} ${values.last_name}`});
  revalidatePath("/guests"); redirect("/guests?message=Guest updated");
}

export async function deleteGuest(id:string) {
  const {supabase,wedding}=await getWeddingContext(); if(!wedding)return;
  const {error}=await supabase.from("guests").delete().eq("id",id).eq("wedding_id",wedding.id); if(error) throw new Error(error.message);
  revalidatePath("/guests");
}

export async function bulkUpdateGuests(ids:string[], action:string, value?:string) {
  const {supabase,wedding}=await getWeddingContext(); if(!wedding)return;
  if(!ids.length)return;
  if(action==="reminder"){
    const {error}=await supabase.from("activity_log").insert(ids.map(id=>({wedding_id:wedding.id,action:"rsvp_reminder_recorded",entity_type:"guest",entity_id:id,description:"RSVP reminder recorded (not sent)"})));if(error)throw new Error(error.message);return;
  }
  if(action==="remove_table"){
    const{error}=await supabase.from("guest_table_assignments").delete().eq("wedding_id",wedding.id).in("guest_id",ids);if(error)throw new Error(error.message);
    const{error:guestError}=await supabase.from("guests").update({table_id:null,seat_number:null}).eq("wedding_id",wedding.id).in("id",ids);if(guestError)throw new Error(guestError.message);return;
  }
  const payload:Record<string,unknown>=action==="rsvp"&&["attending","declined","awaiting","maybe"].includes(value||"")?{rsvp_status:value,responded_at:value==="awaiting"?null:new Date().toISOString()}
    :action==="guest_type"&&["day","evening","ceremony_only","supplier"].includes(value||"")?{guest_type:value}
    :action==="household"?{household_id:value||null}
    :action==="invited"?{invitation_status:"sent",invited_at:new Date().toISOString()}
    :action==="attending"?{rsvp_status:"attending",responded_at:new Date().toISOString()}
    :action==="declined"?{rsvp_status:"declined",responded_at:new Date().toISOString()}
    :action==="awaiting"?{rsvp_status:"awaiting",responded_at:null}:{};
  if(!Object.keys(payload).length)throw new Error("Choose a valid bulk action.");
  const {error}=await supabase.from("guests").update(payload).eq("wedding_id",wedding.id).in("id",ids); if(error)throw new Error(error.message);
}

export async function quickUpdateGuest(id:string,field:string,value:string|null){
  const{supabase,wedding}=await getWeddingContext();if(!wedding)throw new Error("Wedding workspace not found.");
  const allowed:Record<string,string[]>={guest_type:["day","evening","ceremony_only","supplier"],rsvp_status:["attending","declined","awaiting","maybe","invited","not_sent"],invitation_status:["not_sent","sent","delivered","returned"],meal_option_id:[] ,household_id:[]};
  if(!(field in allowed))throw new Error("This field cannot be edited here.");
  if(allowed[field].length&&value&&!allowed[field].includes(value))throw new Error("Choose a valid value.");
  const payload:Record<string,unknown>={[field]:value||null};
  if(field==="rsvp_status")payload.responded_at=value&&!["awaiting","invited","not_sent"].includes(value)?new Date().toISOString():null;
  if(field==="invitation_status"&&value==="sent")payload.invited_at=new Date().toISOString();
  const{error}=await supabase.from("guests").update(payload).eq("id",id).eq("wedding_id",wedding.id);if(error)throw new Error(error.message);
  await supabase.from("activity_log").insert({wedding_id:wedding.id,action:`guest_${field}_changed`,entity_type:"guest",entity_id:id,description:`Guest ${field.replaceAll("_"," ")} updated`});
  revalidatePath("/dashboard");
}

export async function setGuestsArchived(ids:string[],archived:boolean){
  const{supabase,wedding,user}=await getWeddingContext();if(!wedding)throw new Error("Wedding workspace not found.");if(!ids.length)return;
  const key=`guest_archived_ids:${user.id}`;const{data,error:readError}=await supabase.from("app_settings").select("value").eq("wedding_id",wedding.id).eq("key",key).maybeSingle();if(readError)throw new Error(readError.message);
  const current=new Set(Array.isArray((data?.value as {ids?:string[]}|null)?.ids)?(data!.value as {ids:string[]}).ids:[]);ids.forEach(id=>archived?current.add(id):current.delete(id));
  const{error}=await supabase.from("app_settings").upsert({wedding_id:wedding.id,key,value:{ids:[...current]}},{onConflict:"wedding_id,key"});if(error)throw new Error(error.message);
}

export async function bulkDeleteGuests(ids:string[]){
  const{supabase,wedding}=await getWeddingContext();if(!wedding)throw new Error("Wedding workspace not found.");if(!ids.length)return;
  const{error}=await supabase.from("guests").delete().eq("wedding_id",wedding.id).in("id",ids);if(error)throw new Error(error.message);
}

type ImportRow=Record<string,string>;

const headerAliases:Record<string,string>={
  firstname:"first_name",first:"first_name",forename:"first_name",givenname:"first_name",guestfirstname:"first_name",
  lastname:"last_name",last:"last_name",surname:"last_name",familyname:"last_name",guestlastname:"last_name",
  name:"full_name",fullname:"full_name",guest:"full_name",guestname:"full_name",
  preferredname:"preferred_name",knownas:"preferred_name",nickname:"preferred_name",
  household:"household",householdname:"household",family:"household",invitationgroup:"household",group:"household",
  guesttype:"guest_type",invitationtype:"guest_type",dayorevening:"guest_type",type:"guest_type",
  agegroup:"age_group",adultorchild:"age_group",age:"age_group",
  emailaddress:"email",email:"email",telephone:"phone",telephonenumber:"phone",phone:"phone",phonenumber:"phone",mobile:"phone",
  rsvp:"rsvp_status",rsvpstatus:"rsvp_status",attending:"rsvp_status",response:"rsvp_status",
  invitationstatus:"invitation_status",invitestatus:"invitation_status",
  plusone:"plus_one_allowed",plusoneallowed:"plus_one_allowed",plusonename:"plus_one_name",
  dietary:"dietary_requirements",dietaryrequirements:"dietary_requirements",dietaryneeds:"dietary_requirements",
  allergy:"allergies",allergies:"allergies",accessibility:"accessibility_requirements",accessibilityrequirements:"accessibility_requirements",accessneeds:"accessibility_requirements",
  accommodation:"requires_accommodation",accommodationrequired:"requires_accommodation",needsaccommodation:"requires_accommodation",accommodationdetails:"accommodation_notes",accommodationnotes:"accommodation_notes",
  transport:"requires_transport",transportrequired:"requires_transport",needstransport:"requires_transport",transportdetails:"transport_notes",transportnotes:"transport_notes",
  highchair:"requires_highchair",vip:"is_vip",notes:"private_notes",privatenotes:"private_notes",relationshipgroup:"relationship_group",title:"title",
};

function canonicalHeader(value:string){
  const cleaned=value.replace(/^\uFEFF/,"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const compact=cleaned.replace(/[^a-z0-9]+/g,"");
  return headerAliases[compact]||cleaned.replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
}

function parseDelimited(text:string){
  const source=text.replace(/^\uFEFF/,"");
  const firstLine=source.split(/\r?\n/,1)[0]||"";
  const candidates=[",","\t",";"];
  const delimiter=candidates.sort((a,b)=>firstLine.split(b).length-firstLine.split(a).length)[0];
  const rows:string[][]=[];let row:string[]=[],field="",quoted=false;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(char==='"'&&quoted&&source[i+1]==='"'){field+='"';i++;continue;}
    if(char==='"'){quoted=!quoted;continue;}
    if(char===delimiter&&!quoted){row.push(field.trim());field="";continue;}
    if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&source[i+1]==='\n')i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field="";continue;}
    field+=char;
  }
  row.push(field.trim());if(row.some(Boolean))rows.push(row);
  const headers=(rows.shift()||[]).map(canonicalHeader);
  return {headers,rows:rows.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]?.trim()||""])) as ImportRow)};
}

const truthy=(value:string)=>["yes","y","true","1","required","needed"].includes(value.trim().toLowerCase());
const guestType=(value:string)=>{const v=value.toLowerCase().replace(/[^a-z]/g,"");if(v.includes("evening"))return"evening";if(v.includes("ceremony"))return"ceremony_only";if(v.includes("supplier")||v.includes("vendor"))return"supplier";return"day";};
const ageGroup=(value:string)=>{const v=value.toLowerCase();if(v.includes("baby")||v.includes("infant"))return"baby";if(v.includes("child")||v.includes("kid")||v.includes("young"))return"child";return"adult";};
const rsvpStatus=(value:string)=>{const v=value.toLowerCase().trim();if(["yes","y","attending","accepted","accept"].includes(v))return"attending";if(["no","n","declined","decline","not attending"].includes(v))return"declined";if(["maybe","unsure"].includes(v))return"maybe";if(["invited","sent"].includes(v))return"invited";return"awaiting";};
const invitationStatus=(value:string)=>{const v=value.toLowerCase().trim();if(v.includes("deliver"))return"delivered";if(v.includes("return"))return"returned";if(["yes","y","sent","invited"].includes(v))return"sent";return"not_sent";};
function splitName(row:ImportRow){
  let first=(row.first_name||"").trim(),last=(row.last_name||"").trim();
  const full=(row.full_name||"").trim();
  if(!first&&full){const parts=full.split(/\s+/);first=parts.shift()||"";last=last||parts.join(" ");}
  return{first,last};
}

export async function importGuests(formData:FormData){
  const {supabase,wedding}=await getWeddingContext();if(!wedding)redirect("/dashboard");
  const file=formData.get("csv");if(!(file instanceof File)||!file.size)redirect("/guests?error=Choose a CSV or TSV file");
  if(file.size>5*1024*1024)redirect("/guests?error=Guest files must be smaller than 5 MB");
  if(/\.(xlsx?|numbers)$/i.test(file.name))redirect("/guests?error=Please save the spreadsheet as CSV before uploading. Use the template if needed.");
  const parsed=parseDelimited(await file.text());
  if(!parsed.headers.some(header=>["first_name","full_name"].includes(header)))redirect(`/guests?error=${encodeURIComponent(`No guest-name column found. Use First Name + Last Name, or a single Full Name column. Detected: ${parsed.headers.filter(Boolean).join(", ")||"no headings"}.`)}`);
  if(parsed.rows.length>5000)redirect("/guests?error=Import a maximum of 5,000 guests at a time");

  const prepared=parsed.rows.map((row,index)=>({row,index:index+2,...splitName(row)})).filter(item=>item.first);
  const rejected=parsed.rows.length-prepared.length;
  if(!prepared.length)redirect("/guests?error=No guest rows were found below the header row");

  const [{data:existingGuests,error:guestReadError},{data:existingHouseholds,error:householdReadError}]=await Promise.all([
    supabase.from("guests").select("first_name,last_name,email,household_id").eq("wedding_id",wedding.id),
    supabase.from("households").select("id,household_name").eq("wedding_id",wedding.id),
  ]);
  const readError=guestReadError||householdReadError;if(readError)redirect(`/guests?error=${encodeURIComponent(readError.message)}`);
  const householdMap=new Map((existingHouseholds||[]).map(h=>[h.household_name.trim().toLowerCase(),h.id]));
  const wantedHouseholds=[...new Set(prepared.map(item=>item.row.household?.trim()).filter(Boolean) as string[])];
  const missingHouseholds=wantedHouseholds.filter(name=>!householdMap.has(name.toLowerCase()));
  if(missingHouseholds.length){const{data,error}=await supabase.from("households").insert(missingHouseholds.map(household_name=>({wedding_id:wedding.id,household_name}))).select("id,household_name");if(error)redirect(`/guests?error=${encodeURIComponent(`Households could not be created: ${error.message}`)}`);(data||[]).forEach(h=>householdMap.set(h.household_name.trim().toLowerCase(),h.id));}

  const duplicateKeys=new Set((existingGuests||[]).map(g=>g.email?.trim().toLowerCase()?`email:${g.email.trim().toLowerCase()}`:`name:${g.first_name.trim().toLowerCase()}|${(g.last_name||"").trim().toLowerCase()}`));
  const payload:Record<string,unknown>[]=[];let duplicates=0;
  for(const{row,first,last}of prepared){
    const email=(row.email||"").trim();const key=email?`email:${email.toLowerCase()}`:`name:${first.toLowerCase()}|${last.toLowerCase()}`;
    if(duplicateKeys.has(key)){duplicates++;continue;}duplicateKeys.add(key);
    const status=rsvpStatus(row.rsvp_status||"");
    payload.push({wedding_id:wedding.id,household_id:row.household?householdMap.get(row.household.trim().toLowerCase())||null:null,first_name:first,last_name:last||null,preferred_name:row.preferred_name||null,title:row.title||null,relationship_group:row.relationship_group||null,guest_type:guestType(row.guest_type||""),age_group:ageGroup(row.age_group||""),email:email||null,phone:row.phone||null,rsvp_status:status,invitation_status:invitationStatus(row.invitation_status||""),is_vip:truthy(row.is_vip||""),plus_one_allowed:truthy(row.plus_one_allowed||"")||Boolean(row.plus_one_name),plus_one_name:row.plus_one_name||null,dietary_requirements:row.dietary_requirements||null,allergies:row.allergies||null,accessibility_requirements:row.accessibility_requirements||null,requires_highchair:truthy(row.requires_highchair||""),requires_accommodation:truthy(row.requires_accommodation||""),accommodation_notes:row.accommodation_notes||null,requires_transport:truthy(row.requires_transport||""),transport_notes:row.transport_notes||null,private_notes:row.private_notes||null,responded_at:["attending","declined","maybe"].includes(status)?new Date().toISOString():null});
  }
  if(!payload.length)redirect(`/guests?error=${encodeURIComponent(`Nothing new was imported. ${duplicates} row${duplicates===1?" was":"s were"} already in the guest list${rejected?` and ${rejected} had no name`:""}.`)}`);
  for(let index=0;index<payload.length;index+=250){const{error}=await supabase.from("guests").insert(payload.slice(index,index+250));if(error)redirect(`/guests?error=${encodeURIComponent(`Import stopped: ${error.message}`)}`);}
  await supabase.from("activity_log").insert({wedding_id:wedding.id,action:"guest_imported",entity_type:"guest",description:`${payload.length} guests imported from ${file.name}`});
  revalidatePath("/guests");revalidatePath("/dashboard");
  const notes=[`${payload.length} guest${payload.length===1?"":"s"} imported`,missingHouseholds.length?`${missingHouseholds.length} household${missingHouseholds.length===1?"":"s"} created`:"",duplicates?`${duplicates} duplicate${duplicates===1?"":"s"} skipped`:"",rejected?`${rejected} blank row${rejected===1?"":"s"} skipped`:""].filter(Boolean).join(" · ");
  redirect(`/guests?message=${encodeURIComponent(notes)}`);
}

export async function addHousehold(formData:FormData){const {supabase,wedding}=await getWeddingContext();if(!wedding)redirect("/dashboard");const {error}=await supabase.from("households").insert({wedding_id:wedding.id,household_name:String(formData.get("name")||""),email:nullable(formData.get("primary_email")),address_line_1:nullable(formData.get("address_line_1")),city:nullable(formData.get("city")),postcode:nullable(formData.get("postcode")),private_notes:nullable(formData.get("notes"))});if(error)redirect(`/guests/households?error=${encodeURIComponent(error.message)}`);revalidatePath("/guests/households");redirect("/guests/households?message=Household+created");}
