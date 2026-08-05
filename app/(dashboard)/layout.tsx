import { Sidebar } from "@/components/sidebar";
import { AppEnhancements } from "@/components/app-enhancements";
import { CommandCenter } from "@/components/command-center";
import { LiveCollaboration } from "@/components/live-collaboration";
import { getWeddingContext } from "@/lib/wedding";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { wedding, user } = await getWeddingContext();
  return <div className="app-shell"><Sidebar hasWedding={Boolean(wedding)} /><main className="main"><header className="topbar"><div className="topbar-wedding"><div className="topbar-title">{wedding?.couple_names || "The Hume Wedding"}</div><div className="topbar-subtitle">{wedding ? new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"long", year:"numeric" }).format(new Date(`${wedding.wedding_date}T12:00:00`)) : "Complete setup to begin"}</div></div><div className="topbar-actions"><CommandCenter /><LiveCollaboration weddingId={wedding?.id} userId={user.id} email={user.email||"Wedding user"}/><form action={signOut}><button className="user-chip" title="Sign out"><span className="user-email">{user.email}</span><span className="avatar">{user.email?.slice(0,2)}</span></button></form></div></header><AppEnhancements />{children}</main></div>;
}
