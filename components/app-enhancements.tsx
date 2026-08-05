"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

type DraftValue = { value?: string; checked?: boolean };

export function AppEnhancements() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    const url = new URL(window.location.href);
    const message = url.searchParams.get("message");
    if (message) toast.success(message);

    if (url.searchParams.get("new") === "1") {
      window.setTimeout(() => {
        const drawer = document.querySelector<HTMLDetailsElement>("details.add-drawer");
        if (drawer) {
          drawer.open = true;
          drawer.querySelector<HTMLElement>("input:not([type='hidden']), select, textarea")?.focus();
        }
      }, 80);
    }

    const trackedForms = Array.from(document.querySelectorAll<HTMLFormElement>(".add-drawer form, .popover-form, .task-edit form, .timeline-edit-form"));
    const dirty = new Set<HTMLFormElement>();

    trackedForms.forEach((form, index) => {
      const key = `wedding-hq-draft:${window.location.pathname}:${index}`;
      try {
        const saved = JSON.parse(window.localStorage.getItem(key) || "{}") as Record<string, DraftValue>;
        Array.from(form.elements).forEach((element) => {
          if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) || !element.name || element.type === "file" || element.type === "hidden") return;
          const draft = saved[element.name];
          if (!draft) return;
          if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) element.checked = Boolean(draft.checked);
          else if (!element.value) element.value = draft.value || "";
        });
      } catch { window.localStorage.removeItem(key); }

      const save = () => {
        const draft: Record<string, DraftValue> = {};
        Array.from(form.elements).forEach((element) => {
          if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) || !element.name || ["file", "hidden", "password"].includes(element.type)) return;
          draft[element.name] = element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio") ? { checked: element.checked } : { value: element.value };
        });
        window.localStorage.setItem(key, JSON.stringify(draft));
        dirty.add(form);
      };
      const clear = () => { window.localStorage.removeItem(key); dirty.delete(form); };
      form.addEventListener("input", save);
      form.addEventListener("change", save);
      form.addEventListener("submit", clear);
      (form as HTMLFormElement & { __draftCleanup?: () => void }).__draftCleanup = () => {
        form.removeEventListener("input", save); form.removeEventListener("change", save); form.removeEventListener("submit", clear);
      };
    });

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.size) { event.preventDefault(); event.returnValue = ""; }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        const form = (document.activeElement as HTMLElement | null)?.closest("form") as HTMLFormElement | null;
        if (form) { event.preventDefault(); form.requestSubmit(); }
      }
      if (event.key === "Escape") {
        const open = Array.from(document.querySelectorAll<HTMLDetailsElement>("details[open]")).at(-1);
        if (open) open.open = false;
      }
    };
    const onToggle = (event: Event) => {
      const details = event.target as HTMLDetailsElement;
      if (details.open) window.setTimeout(() => details.querySelector<HTMLElement>("input:not([type='hidden']), select, textarea")?.focus(), 80);
    };
    document.querySelectorAll("details").forEach((details) => details.addEventListener("toggle", onToggle));
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline);
      window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("keydown", onKeyDown);
      document.querySelectorAll("details").forEach((details) => details.removeEventListener("toggle", onToggle));
      trackedForms.forEach((form) => (form as HTMLFormElement & { __draftCleanup?: () => void }).__draftCleanup?.());
    };
  }, []);

  if (online) return null;
  return <div className="offline-banner" role="status"><WifiOff /> You’re offline. Draft changes will stay on this device.</div>;
}
