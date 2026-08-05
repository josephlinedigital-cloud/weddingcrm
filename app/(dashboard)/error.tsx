"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page route-error"><div className="card card-pad">
    <span className="empty-icon"><AlertTriangle /></span>
    <p className="eyebrow">Something went wrong</p>
    <h1>This area couldn’t be loaded</h1>
    <p className="muted">Your wedding data is safe. Check your connection, then try loading this section again.</p>
    <button className="button button-primary" type="button" onClick={reset}><RefreshCw /> Try again</button>
  </div></div>;
}
