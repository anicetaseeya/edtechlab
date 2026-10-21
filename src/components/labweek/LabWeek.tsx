"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addEntryAction } from "@/app/app/actions";
import { ENTRY_TYPES, type Entry, type EntryType } from "@/lib/types";
import {
  defaultEntryDate,
  formatDate,
  formatTime,
  madridToday,
  thisWeekDays,
} from "@/lib/dates";
import EntryCard from "./EntryCard";
import LabPlaceCard from "./LabPlaceCard";
import KeyDates from "./KeyDates";

const QUICK_ADD: { label: string; title: string; type: EntryType }[] = [
  { label: "Partner meeting", title: "Partner meeting", type: "Partner meeting" },
  { label: "Team meeting", title: "Team meeting", type: "Team meeting" },
  { label: "Deliverable due", title: "Deliverable due", type: "Deliverable" },
  { label: "Minutes due", title: "Minutes due", type: "Deliverable" },
  { label: "Joint session", title: "Joint session", type: "Session" },
];

const EMPTY_FORM = () => ({
  title: "",
  type: "Task" as EntryType,
  entry_date: defaultEntryDate(),
  entry_time: "",
  place: "",
  meeting_link: "",
  notes: "",
  mandatory: false,
  tbc: false,
});

function sortEntries(list: Entry[]): Entry[] {
  return [...list].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1;
    const at = a.entry_time ?? "";
    const bt = b.entry_time ?? "";
    if (at !== bt) return at < bt ? -1 : 1;
    return a.created_at < b.created_at ? -1 : 1;
  });
}

export default function LabWeek({ initialEntries = [] }: { initialEntries?: Entry[] }) {
  const supabase = useMemo(() => createClient(), []);
  const titleRef = useRef<HTMLInputElement>(null);

  const [entries, setEntries] = useState<Entry[]>(() => sortEntries(initialEntries));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [filter, setFilter] = useState<"All" | EntryType>("All");
  const [form, setForm] = useState(EMPTY_FORM);

  const today = madridToday();

  // Only the newest load may write to the list: a slow earlier request must
  // never overwrite entries added since it was sent.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoadError(null);
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .order("entry_date", { ascending: true })
      .order("entry_time", { ascending: true, nullsFirst: true });

    if (seq !== loadSeq.current) return;

    if (error) {
      setLoadError("We could not load your lab week. Check your connection and try again.");
    } else {
      setEntries(sortEntries((data ?? []) as Entry[]));
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  // The add form posts to a server action, so it still saves if the page has
  // not finished loading its JavaScript. React takes over once it has.
  const [addState, addAction, saving] = useActionState(addEntryAction, null);
  const appliedAt = useRef(0);

  useEffect(() => {
    if (!addState || addState.at === appliedAt.current) return;
    appliedAt.current = addState.at;

    if (!addState.ok || !addState.entry) {
      setSaveError(addState.error ?? "We could not save that entry. Please try again.");
      return;
    }

    // Drop any copy a load in flight may already have added, so an entry can
    // never appear twice.
    const saved = addState.entry;
    setSaveError(null);
    setEntries((prev) => sortEntries([...prev.filter((x) => x.id !== saved.id), saved]));
    setForm(EMPTY_FORM());
    setShowMore(false);
    titleRef.current?.focus();
  }, [addState]);

  const saveEntry = useCallback(
    async (id: string, patch: Partial<Entry>) => {
      setSaveError(null);
      const { data, error } = await supabase
        .from("entries")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        setSaveError("We could not save that change. Please try again.");
        return;
      }
      setEntries((prev) => sortEntries(prev.map((x) => (x.id === id ? (data as Entry) : x))));
    },
    [supabase],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      setSaveError(null);
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) {
        setSaveError("We could not delete that entry. Please try again.");
        return;
      }
      setEntries((prev) => prev.filter((x) => x.id !== id));
    },
    [supabase],
  );

  const visible = filter === "All" ? entries : entries.filter((x) => x.type === filter);

  const nextUp = entries.find(
    (x) => !x.done && !x.cancelled && x.entry_date >= today,
  );

  const missedCount = entries.filter(
    (x) => x.mandatory && x.attendance === "missed",
  ).length;

  const week = thisWeekDays();
  const weekCounts = week.map((d) => ({
    day: d,
    count: entries.filter((x) => x.entry_date === d && !x.cancelled).length,
  }));

  return (
    <div className="wrap">
      <h1>My lab week</h1>

      <p className={missedCount > 0 ? "msg msg-error" : "muted"} role="status">
        {missedCount === 0
          ? "Mandatory sessions marked Missed: 0."
          : `Mandatory sessions marked Missed: ${missedCount}. Missing two in a row can put your place at risk.`}
      </p>

      {/* Next up */}
      <section className="card card-highlight" aria-labelledby="nextup">
        <p className="eyebrow" id="nextup">
          Next up
        </p>
        {nextUp ? (
          <>
            <p className="entry-title" style={{ marginBottom: 2 }}>
              {nextUp.title}
            </p>
            <p className="entry-meta" style={{ marginTop: 0 }}>
              {[
                nextUp.type,
                formatDate(nextUp.entry_date),
                formatTime(nextUp.entry_time) ?? (nextUp.tbc ? "time to confirm" : null),
                nextUp.place,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </>
        ) : (
          <p style={{ margin: 0 }}>Nothing coming up yet. Add your first entry below.</p>
        )}
      </section>

      {/* Add form */}
      <section className="card" aria-labelledby="add-heading">
        <h2 id="add-heading">Add to my lab week</h2>

        <p className="eyebrow" id="quick-add-label">
          Quick add — fills the form, nothing is saved yet
        </p>
        <ul className="chips" aria-labelledby="quick-add-label">
          {QUICK_ADD.map((q) => (
            <li key={q.label}>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setForm((f) => ({ ...f, title: q.title, type: q.type }));
                  titleRef.current?.focus();
                }}
              >
                {q.label}
              </button>
            </li>
          ))}
        </ul>

        {saveError && (
          <p className="msg msg-error" role="alert">
            {saveError}
          </p>
        )}

        <form action={addAction}>
          <div className="field">
            <label htmlFor="core-input">What is it? (title)</label>
            <input
              id="core-input"
              data-testid="core-input"
              ref={titleRef}
              name="title"
              type="text"
              required
              maxLength={200}
              placeholder="Prepare questions for partner meeting"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <p className="hint">
              Everything else already has a sensible default — a title alone is enough.
            </p>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="entry-type">Type</label>
              <select
                id="entry-type"
                name="type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as EntryType })}
              >
                {ENTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="entry-date">Date</label>
              <input
                id="entry-date"
                name="entry_date"
                type="date"
                required
                value={form.entry_date}
                onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
              />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-quiet"
            aria-expanded={showMore}
            aria-controls="more-fields"
            onClick={() => setShowMore((v) => !v)}
            style={{ marginBottom: 16 }}
          >
            {showMore ? "Hide extra details" : "Add time, place, link or notes"}
          </button>

          <div id="more-fields" hidden={!showMore}>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="entry-time">Time (optional)</label>
                <input
                  id="entry-time"
                  name="entry_time"
                  type="time"
                  value={form.entry_time}
                  onChange={(e) => setForm({ ...form, entry_time: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="entry-place">Place (optional)</label>
                <input
                  id="entry-place"
                  name="place"
                  type="text"
                  placeholder="Online, Madrid, Segovia or a room"
                  value={form.place}
                  onChange={(e) => setForm({ ...form, place: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="entry-link">Meeting link (optional)</label>
              <input
                id="entry-link"
                name="meeting_link"
                type="url"
                placeholder="https://…"
                value={form.meeting_link}
                onChange={(e) => setForm({ ...form, meeting_link: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="entry-notes">Notes (optional)</label>
              <textarea
                id="entry-notes"
                name="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="check" htmlFor="entry-mandatory">
                <input
                  id="entry-mandatory"
                  name="mandatory"
                  type="checkbox"
                  checked={form.mandatory}
                  onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
                />
                Mandatory
              </label>
              <label className="check" htmlFor="entry-tbc">
                <input
                  id="entry-tbc"
                  name="tbc"
                  type="checkbox"
                  checked={form.tbc}
                  onChange={(e) => setForm({ ...form, tbc: e.target.checked })}
                />
                Time or room TBC
              </label>
            </div>
          </div>

          <button type="submit" className="btn btn-lg" data-testid="core-submit" disabled={saving}>
            {saving ? "Saving…" : "Add to my week"}
          </button>
        </form>
      </section>

      {/* This week */}
      <section className="card" aria-labelledby="thisweek">
        <h2 id="thisweek">This week</h2>
        <div className="scroll-x">
          <ul className="week-strip">
            {weekCounts.map((w) => (
              <li key={w.day} className={`week-day${w.day === today ? " is-today" : ""}`}>
                <span className="d">{formatDate(w.day)}</span>
                <br />
                {w.count === 0 ? "nothing" : `${w.count} ${w.count === 1 ? "entry" : "entries"}`}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <LabPlaceCard />
      <KeyDates />

      {/* The list */}
      <section aria-labelledby="mylist">
        <h2 id="mylist">Everything in my lab week</h2>

        <p className="eyebrow" id="filter-label">
          Filter by type
        </p>
        <ul className="chips" aria-labelledby="filter-label">
          {(["All", ...ENTRY_TYPES] as const).map((t) => (
            <li key={t}>
              <button
                type="button"
                className="chip"
                aria-pressed={filter === t}
                onClick={() => setFilter(t)}
              >
                {t}
              </button>
            </li>
          ))}
        </ul>

        {loadError && (
          <p className="msg msg-error" role="alert">
            {loadError}{" "}
            <button type="button" className="btn btn-quiet" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}

        {entries.length === 0 ? (
          <p className="msg msg-info">
            Nothing here yet — add your first session, meeting or deadline above.
          </p>
        ) : visible.length === 0 ? (
          <p className="msg msg-info">
            No entries of that type. Choose “All” to see everything.
          </p>
        ) : (
          <ul className="entry-list">
            {visible.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                today={today}
                onSave={saveEntry}
                onDelete={deleteEntry}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
