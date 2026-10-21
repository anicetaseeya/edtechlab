"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ENTRY_TYPES, type Entry } from "@/lib/types";
import { defaultEntryDate } from "@/lib/dates";

export type AddState = {
  ok: boolean;
  error?: string;
  entry?: Entry;
  /** Changes on every attempt, so the client can tell two results apart. */
  at: number;
} | null;

/**
 * Saves one lab-week entry.
 *
 * This runs on the server, so the form works even if the page has not
 * finished loading its JavaScript yet: the browser posts the form, the entry
 * is saved, and /app re-renders with it. Once the page is interactive React
 * calls the same function without a page reload.
 *
 * Only `title` is required. Every other field falls back to a valid default.
 */
export async function addEntryAction(_prev: AddState, formData: FormData): Promise<AddState> {
  const at = Date.now();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has ended. Please log in again.", at };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Please write a short title first.", at };

  const rawType = String(formData.get("type") ?? "Task");
  const type = (ENTRY_TYPES as readonly string[]).includes(rawType) ? rawType : "Task";

  const rawDate = String(formData.get("entry_date") ?? "");
  const entry_date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : defaultEntryDate();

  const rawTime = String(formData.get("entry_time") ?? "");
  const entry_time = /^\d{2}:\d{2}/.test(rawTime) ? rawTime : null;

  const text = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v.length > 0 ? v : null;
  };

  const { data, error } = await supabase
    .from("entries")
    .insert({
      user_id: user.id,
      title: title.slice(0, 200),
      type,
      entry_date,
      entry_time,
      place: text("place"),
      meeting_link: text("meeting_link"),
      notes: text("notes"),
      mandatory: formData.get("mandatory") === "on",
      tbc: formData.get("tbc") === "on",
    })
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: "We could not save that entry. Please try again.", at };
  }

  revalidatePath("/app");
  return { ok: true, entry: data as Entry, at };
}
