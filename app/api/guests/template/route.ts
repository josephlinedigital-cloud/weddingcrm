import { NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding";

const headers=["First Name","Last Name","Preferred Name","Household","Guest Type","Age Group","Email","Telephone","RSVP Status","Invitation Status","Plus One Allowed","Plus One Name","Dietary Requirements","Allergies","Accessibility Requirements","Accommodation Required","Accommodation Details","Transport Required","Transport Details","Highchair","VIP","Private Notes"];
const examples=[
  ["Sarah","Williams","","The Williams Family","Day","Adult","sarah@example.com","07123 456789","Attending","Sent","No","","Vegetarian","","","No","","Yes","Hotel pickup","No","No",""],
  ["Oliver","Williams","Ollie","The Williams Family","Day","Child","","","Awaiting","Sent","No","","","Nut allergy","","No","","Yes","Hotel pickup","No","No",""],
];
const csv=(value:string)=>`"${value.replaceAll('"','""')}"`;
export async function GET(){await getWeddingContext();const body=[headers,...examples].map(row=>row.map(csv).join(",")).join("\r\n");return new NextResponse(body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=guest-import-template.csv"}})}
