export default function DashboardLoading() {
  return <div className="page route-loading" aria-label="Loading page" aria-busy="true">
    <div className="skeleton skeleton-eyebrow" />
    <div className="skeleton skeleton-title" />
    <div className="skeleton skeleton-copy" />
    <div className="loading-grid">
      {Array.from({ length: 8 }, (_, index) => <div className="card skeleton-card" key={index}><div className="skeleton skeleton-line" /><div className="skeleton skeleton-value" /><div className="skeleton skeleton-line short" /></div>)}
    </div>
  </div>;
}
