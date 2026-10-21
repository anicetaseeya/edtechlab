"use client";

import { useState } from "react";
import { ENTRY_TYPES, type Entry } from "@/lib/types";
import { formatDate, formatTime, shortWhen } from "@/lib/dates";
import { downloadIcs } from "@/lib/ics";

type Patch = Partial<Entry>;

export default function EntryCard({
  entry,
  today,
  onSave,
  onDelete,
}: {
  entry: Entry;
  today: string;
  onSave: (id: string, patch: Patch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [askMoved, setAskMoved] = useState<Patch | null>(null);

  const [draft, setDraft] = useState({
    title: entry.title,
    type: entry.type as string,
    entry_date: entry.entry_date,
    entry_time: formatTime(entry.entry_time) ?? "",
    place: entry.place ?? "",
    meeting_link: entry.meeting_link ?? "",
    notes: entry.notes ?? "",
    mandatory: entry.mandatory,
    tbc: entry.tbc,
  });

  const off = entry.done || entry.cancelled;
  const isPast = entry.entry_date < today;

  async function run(patch: Patch) {
    setBusy(true);
    try {
      await onSave(entry.id, patch);
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    setDraft({
      title: entry.title,
      type: entry.type,
      entry_date: entry.entry_date,
      entry_time: formatTime(entry.entry_time) ?? "",
      place: entry.place ?? "",
      meeting_link: entry.meeting_link ?? "",
      notes: entry.notes ?? "",
      mandatory: entry.mandatory,
      tbc: entry.tbc,
    });
    setAskMoved(null);
    setEditing(true);
  }

  function buildPatch(): Patch {
    return {
      title: draft.title.trim(),
      type: draft.type as Entry["type"],
      entry_date: draft.entry_date,
      entry_time: draft.entry_time ? draft.entry_time : null,
      place: draft.place.trim() || null,
      meeting_link: draft.meeting_link.trim() || null,
      notes: draft.notes.trim() || null,
      mandatory: draft.mandatory,
      tbc: draft.tbc,
    };
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const patch = buildPatch();

    const whenChanged =
      patch.entry_date !== entry.entry_date ||
      (patch.entry_time ?? null) !== (entry.entry_time ? formatTime(entry.entry_time) : null);
    const placeChanged = (patch.place ?? null) !== (entry.place ?? null);

    if (whenChanged || placeChanged) {
      setAskMoved(patch);
      return;
    }
    void finish(patch);
  }

  async function finish(patch: Patch, movedByLab = false) {
    if (movedByLab) {
      const bits = [shortWhen(entry.entry_date, formatTime(entry.entry_time))];
      if ((patch.place ?? null) !== (entry.place ?? null) && entry.place) bits.push(entry.place);
      patch = { ...patch, moved: true, moved_from: bits.join(", ") };
    }
    await run(patch);
    setAskMoved(null);
    setEditing(false);
  }

  const timeLabel = formatTime(entry.entry_time);
  const meta = [
    entry.type,
    formatDate(entry.entry_date),
    timeLabel ?? (entry.tbc ? "time to confirm" : null),
    entry.place,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={`entry${off ? " is-off" : ""}`} data-testid="core-item">
      {editing ? (
        <form onSubmit={submitEdit}>
          <div className="field">
            <label htmlFor={`e-title-${entry.id}`}>Title</label>
            <input
              id={`e-title-${entry.id}`}
              type="text"
              value={draft.title}
              required
              maxLength={200}
              onChange={(ev) => setDraft({ ...draft, title: ev.target.value })}
            />
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor={`e-type-${entry.id}`}>Type</label>
              <select
                id={`e-type-${entry.id}`}
                value={draft.type}
                onChange={(ev) => setDraft({ ...draft, type: ev.target.value })}
              >
                {ENTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`e-date-${entry.id}`}>Date</label>
              <input
                id={`e-date-${entry.id}`}
                type="date"
                value={draft.entry_date}
                required
                onChange={(ev) => setDraft({ ...draft, entry_date: ev.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`e-time-${entry.id}`}>Time (optional)</label>
              <input
                id={`e-time-${entry.id}`}
                type="time"
                value={draft.entry_time}
                onChange={(ev) => setDraft({ ...draft, entry_time: ev.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`e-place-${entry.id}`}>Place (optional)</label>
              <input
                id={`e-place-${entry.id}`}
                type="text"
                value={draft.place}
                onChange={(ev) => setDraft({ ...draft, place: ev.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor={`e-link-${entry.id}`}>Meeting link (optional)</label>
            <input
              id={`e-link-${entry.id}`}
              type="url"
              value={draft.meeting_link}
              onChange={(ev) => setDraft({ ...draft, meeting_link: ev.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor={`e-notes-${entry.id}`}>Notes (optional)</label>
            <textarea
              id={`e-notes-${entry.id}`}
              value={draft.notes}
              onChange={(ev) => setDraft({ ...draft, notes: ev.target.value })}
            />
          </div>

          <div className="field">
            <label className="check" htmlFor={`e-mand-${entry.id}`}>
              <input
                id={`e-mand-${entry.id}`}
                type="checkbox"
                checked={draft.mandatory}
                onChange={(ev) => setDraft({ ...draft, mandatory: ev.target.checked })}
              />
              Mandatory
            </label>
            <label className="check" htmlFor={`e-tbc-${entry.id}`}>
              <input
                id={`e-tbc-${entry.id}`}
                type="checkbox"
                checked={draft.tbc}
                onChange={(ev) => setDraft({ ...draft, tbc: ev.target.checked })}
              />
              Time or room TBC
            </label>
          </div>

          {askMoved ? (
            <div className="msg msg-info" role="group" aria-label="Did the lab move this?">
              <p style={{ marginBottom: 10, fontWeight: 600 }}>
                Did the lab move this, or are you just correcting it?
              </p>
              <div className="entry-actions" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void finish(askMoved, true)}
                >
                  The lab moved it
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  disabled={busy}
                  onClick={() => void finish(askMoved, false)}
                >
                  Just correcting it
                </button>
              </div>
            </div>
          ) : (
            <div className="entry-actions">
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                Cancel editing
              </button>
            </div>
          )}
        </form>
      ) : (
        <>
          <p className="entry-title">{entry.title}</p>
          <p className="entry-meta">{meta}</p>
          {entry.moved && entry.moved_from && (
            <p className="entry-meta">Moved by the lab — was {entry.moved_from}</p>
          )}
          {entry.notes && <p className="entry-meta">{entry.notes}</p>}

          <p className="badges">
            <span className="badge badge-type">{entry.type}</span>
            {entry.mandatory && <span className="badge badge-mandatory">Mandatory</span>}
            {entry.tbc && <span className="badge badge-tbc">Time or room TBC</span>}
            {entry.moved && <span className="badge badge-moved">Moved</span>}
            {entry.cancelled && <span className="badge badge-cancelled">Cancelled</span>}
            {entry.done && <span className="badge badge-done">Done</span>}
            {entry.attendance === "attended" && (
              <span className="badge badge-done">Attended</span>
            )}
            {entry.attendance === "missed" && (
              <span className="badge badge-mandatory">Missed</span>
            )}
          </p>

          {entry.mandatory && isPast && !entry.cancelled && (
            <div className="entry-actions">
              <span className="muted" style={{ alignSelf: "center" }}>
                Mandatory — did you attend?
              </span>
              <button
                type="button"
                className="btn btn-quiet"
                disabled={busy}
                onClick={() => void run({ attendance: "attended" })}
              >
                Attended
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                disabled={busy}
                onClick={() => void run({ attendance: "missed" })}
              >
                Missed
              </button>
            </div>
          )}

          <div className="entry-actions">
            {entry.meeting_link && (
              <a
                className="btn btn-secondary"
                href={entry.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Join<span className="sr-only"> {entry.title} (opens in a new tab)</span>
              </a>
            )}
            <button
              type="button"
              className="btn btn-quiet"
              disabled={busy}
              onClick={() => void run({ done: !entry.done })}
            >
              {entry.done ? "Mark not done" : "Mark done"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={startEdit} disabled={busy}>
              Edit<span className="sr-only"> {entry.title}</span>
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={busy}
              onClick={() => void run({ cancelled: !entry.cancelled })}
            >
              {entry.cancelled ? "Not cancelled" : "Cancelled by the lab"}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() =>
                downloadIcs({
                  uid: entry.id,
                  title: entry.title,
                  date: entry.entry_date,
                  time: formatTime(entry.entry_time),
                  location: entry.place,
                  description: entry.notes,
                  url: entry.meeting_link,
                })
              }
            >
              Add to calendar<span className="sr-only"> — {entry.title}</span>
            </button>
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onDelete(entry.id);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Delete for good
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Delete<span className="sr-only"> {entry.title}</span>
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}
