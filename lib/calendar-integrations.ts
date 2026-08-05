import type { CalendarEvent } from "@/lib/calendar";

export type CalendarIntegrationId = "google" | "apple" | "outlook" | "ics";
export type CalendarIntegrationDirection = "import" | "export" | "two_way";

export type CalendarIntegration = {
  id: CalendarIntegrationId;
  label: string;
  direction: CalendarIntegrationDirection;
  status: "planned" | "available";
  connect?(weddingId: string): Promise<void>;
  importEvents?(payload: string): Promise<CalendarEvent[]>;
  exportEvents?(events: CalendarEvent[]): Promise<string>;
};

// Deliberately disconnected adapters: these define the future integration boundary
// without adding credentials, external calls, or schema changes today.
export const calendarIntegrations: CalendarIntegration[] = [
  { id: "google", label: "Google Calendar", direction: "two_way", status: "planned" },
  { id: "apple", label: "Apple Calendar", direction: "two_way", status: "planned" },
  { id: "outlook", label: "Microsoft Outlook", direction: "two_way", status: "planned" },
  { id: "ics", label: "ICS file", direction: "import", status: "planned" },
];
