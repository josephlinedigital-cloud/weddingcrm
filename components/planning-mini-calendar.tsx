import Link from "next/link";

function iso(date: Date) { return date.toISOString().slice(0, 10); }

export function PlanningMiniCalendar({ dates = [], title = "Planning calendar" }: { dates?: string[]; title?: string }) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first); start.setDate(first.getDate() - offset);
  const marked = new Set(dates);
  return <aside className="planning-mini-calendar card"><header><div><span>{title}</span><strong>{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(today)}</strong></div><Link href="/calendar">Open</Link></header><div className="planning-mini-weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><section>{Array.from({ length: 35 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); const date = iso(day); return <Link className={`${day.getMonth() !== today.getMonth() ? "outside" : ""} ${date === iso(today) ? "today" : ""}`} href={`/calendar?view=day&date=${date}`} key={date}>{day.getDate()}{marked.has(date) && <i />}</Link>; })}</section></aside>;
}

