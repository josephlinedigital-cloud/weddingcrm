export type CalendarSource = "custom" | "task" | "payment" | "timeline" | "supplier" | "wedding";

export type CalendarEvent = {
  id: string;
  source: CalendarSource;
  sourceId?: string;
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  category: string;
  priority: string;
  assignedUserId?: string;
  assignedLabel?: string;
  supplierId?: string;
  supplierName?: string;
  guestIds?: string[];
  guestNames?: string[];
  status: string;
  attachment?: string;
  notes?: string;
  recurring?: string;
  reminder?: string;
};

export type CalendarEventInput = Omit<CalendarEvent, "id" | "source"> & { id?: string };

export const calendarCategories = [
  "task",
  "payment",
  "timeline",
  "meeting",
  "wedding",
  "deadline",
  "guest",
  "personal",
  "accommodation",
  "transport",
] as const;

export function calendarCategoryLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

