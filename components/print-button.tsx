"use client";
import { Printer } from "lucide-react";
export function PrintButton(){return <button className="button button-secondary" type="button" onClick={()=>window.print()}><Printer/>Print plan</button>}
