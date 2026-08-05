export default function GuestsLoading() {
  return (
    <div aria-label="Loading guests">
      <header className="guest-workspace-header">
        <div><div><h1>Guests</h1><span>Loading…</span></div></div>
      </header>
      <section className="guest-summary-strip">
        {Array.from({ length: 8 }, (_, index) => <button key={index} disabled><span>Loading</span><strong>—</strong></button>)}
      </section>
      <section className="guest-command-bar">
        <div className="guest-view-picker"><button disabled>Guest views</button></div>
        <label className="guest-search"><input disabled placeholder="Loading guest list…" /></label>
      </section>
      <section className="guest-data-surface">
        <div className="guest-detail-skeleton" style={{ padding: 16 }}>
          {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
        </div>
      </section>
    </div>
  );
}
