import { RsvpForm } from "@/components/rsvp-form";
export const metadata={title:"RSVP"};
export default function PublicRsvpPage(){return <main className="public-rsvp"><header><span className="brand-mark">WH</span><span>Wedding RSVP</span></header><div className="public-rsvp-main"><RsvpForm/></div><footer>Private invitation · Powered by Wedding HQ</footer></main>}
