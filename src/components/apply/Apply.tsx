"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lab, MyStatus, RankingRow, Round } from "@/lib/types";
import { countdown, formatStamp } from "@/lib/dates";

type Choice = { lab_id: string; reason: string };

export default function Apply() {
  const supabase = useMemo(() => createClient(), []);

  const [round, setRound] = useState<Round | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [open, setOpen] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<MyStatus | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);

  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      // The matching runs by itself — loading this page is one of its triggers.
      await supabase.rpc("ieu_settle");

      const [roundsRes, labsRes, rankRes, statusRes, seatsRes] = await Promise.all([
        supabase
          .from("rounds")
          .select("*")
          .eq("is_current", true)
          .order("application_deadline")
          .limit(1),
        supabase.from("lab_seats").select("*").order("sort_order"),
        supabase.from("rankings").select("id,round_id,lab_id,rank,reason").order("rank"),
        supabase.rpc("ieu_my_status"),
        supabase.rpc("ieu_open_seats"),
      ]);

      if (roundsRes.error || labsRes.error) {
        setState("error");
        return;
      }

      setRound(((roundsRes.data ?? [])[0] as Round) ?? null);
      setLabs((labsRes.data ?? []) as Lab[]);
      setStatus((statusRes.data as MyStatus) ?? null);

      const seatMap: Record<string, number> = {};
      for (const row of (seatsRes.data ?? []) as { lab_id: string; open_seats: number }[]) {
        seatMap[row.lab_id] = row.open_seats;
      }
      setOpen(seatMap);

      const rows = ((rankRes.data ?? []) as RankingRow[]).sort((a, b) => a.rank - b.rank);
      setChoices(rows.map((r) => ({ lab_id: r.lab_id, reason: r.reason ?? "" })));

      setState("ok");
    } catch {
      setState("error");
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const labById = useCallback(
    (id: string | null | undefined) => labs.find((l) => l.id === id),
    [labs],
  );
  const labName = useCallback(
    (id: string | null | undefined) => labById(id)?.name ?? "a lab",
    [labById],
  );

  const now = Date.now();
  const beforeApplication = round ? now <= new Date(round.application_deadline).getTime() : false;
  const beforeAdd = round ? now <= new Date(round.add_deadline).getTime() : false;
  const beforeDrop = round ? now <= new Date(round.drop_deadline).getTime() : false;

  const hasApplied = Boolean(status?.submitted_at);
  const dropped = Boolean(status?.dropped_at);
  const isLateApplicant =
    Boolean(status?.submitted_at && round) &&
    new Date(status!.submitted_at!).getTime() > new Date(round!.application_deadline).getTime();

  // Who may still edit a ranking right now?
  const canEdit = Boolean(
    round &&
      !dropped &&
      ((beforeApplication && !isLateApplicant) || (!hasApplied && beforeAdd)),
  );
  const willBeLate = Boolean(!hasApplied && !beforeApplication && beforeAdd);

  function addLab(id: string) {
    setMsg(null);
    setChoices((c) => (c.length >= 5 || c.some((x) => x.lab_id === id) ? c : [...c, { lab_id: id, reason: "" }]));
  }
  function removeLab(id: string) {
    setChoices((c) => c.filter((x) => x.lab_id !== id));
  }
  function move(index: number, delta: number) {
    setChoices((c) => {
      const next = [...c];
      const j = index + delta;
      if (j < 0 || j >= next.length) return c;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  async function saveRanking() {
    if (busy) return;
    if (choices.length === 0) {
      setMsg({ kind: "error", text: "Choose at least one lab first." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("ieu_save_ranking", {
      p_items: choices.map((c) => ({ lab_id: c.lab_id, reason: c.reason.trim() || null })),
    });
    if (error) {
      setMsg({ kind: "error", text: error.message });
    } else {
      setMsg({ kind: "ok", text: "Your ranking is saved." });
      await load();
    }
    setBusy(false);
  }

  async function dropPlace() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("ieu_drop");
    if (error) {
      setMsg({ kind: "error", text: error.message });
    } else {
      setMsg({ kind: "ok", text: "Your place has been released." });
      await load();
    }
    setConfirmDrop(false);
    setBusy(false);
  }

  if (state === "loading") {
    return (
      <div className="wrap">
        <h1>Fair lab places</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (state === "error" || !round) {
    return (
      <div className="wrap">
        <h1>Fair lab places</h1>
        <p className="msg msg-error" role="alert">
          We could not load the lab places just now. Please try again in a moment.
        </p>
        <p>
          <button type="button" className="btn" onClick={() => void load()}>
            Try again
          </button>
        </p>
        <p>
          <Link href="/app">Back to my lab week</Link>
        </p>
      </div>
    );
  }

  const chosenIds = new Set(choices.map((c) => c.lab_id));
  const result = status?.result ?? null;

  return (
    <div className="wrap">
      <h1>Fair lab places</h1>
      <p className="muted">
        Places go in lottery order, not by who clicks first. {round.name}.
      </p>

      {msg && (
        <p className={`msg ${msg.kind === "ok" ? "msg-ok" : "msg-error"}`} role="alert">
          {msg.text}
        </p>
      )}

      {/* ---------------- My result ---------------- */}
      <section className="card card-highlight" aria-labelledby="myplace">
        <h2 id="myplace">Your place</h2>

        {dropped ? (
          <p style={{ margin: 0 }}>
            You dropped your place in this round. Your seat passed to the next student in lottery
            order.
          </p>
        ) : !hasApplied ? (
          <p style={{ margin: 0 }}>
            You have not ranked any labs yet. Your ranking is below — you can change it until the
            application deadline.
          </p>
        ) : !result ? (
          <>
            <p style={{ marginBottom: 4 }}>
              Your ranking is saved. Places are decided after the application deadline.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              {isLateApplicant
                ? "Yours is a late ranking: it goes into the next daily batch, after all on-time students."
                : "Nothing else to do until then."}
            </p>
          </>
        ) : result.lab_id ? (
          <>
            <p className="entry-title" style={{ marginBottom: 2 }}>
              Your lab: {labName(result.lab_id)}
              {result.choice_rank ? ` (your choice number ${result.choice_rank})` : ""}
            </p>
            <p className="entry-meta" style={{ marginTop: 0 }}>
              {labById(result.lab_id)?.area} ·{" "}
              {status?.lottery_number != null
                ? `your lottery number is ${status.lottery_number.toFixed(6)}`
                : "lottery number pending"}
            </p>
            {result.previous_lab_id && result.changed_at && (
              <p className="msg msg-info" style={{ marginTop: 12 }}>
                This changed on {formatStamp(result.changed_at)}: you moved from{" "}
                {labName(result.previous_lab_id)} to {labName(result.lab_id)}.
              </p>
            )}
          </>
        ) : (
          <>
            <p style={{ marginBottom: 4 }}>
              You do not have a seat yet. You are on the waiting list for the labs you ranked.
            </p>
            <p className="entry-meta" style={{ marginTop: 0 }}>
              {status?.lottery_number != null
                ? `Your lottery number is ${status.lottery_number.toFixed(6)}.`
                : ""}
            </p>
          </>
        )}

        {result && result.waitlist && result.waitlist.length > 0 && (
          <>
            <p className="eyebrow" style={{ marginTop: 16 }}>
              Your waiting list places
            </p>
            <ul className="stack-sm" style={{ margin: 0, paddingLeft: 20 }}>
              {result.waitlist.map((w) => (
                <li key={w.lab_id}>
                  {labName(w.lab_id)} — number {w.position} on the list
                </li>
              ))}
            </ul>
          </>
        )}

        {result?.lab_id && beforeDrop && !dropped && (
          <div style={{ marginTop: 16 }}>
            {confirmDrop ? (
              <div className="msg msg-info">
                <p style={{ fontWeight: 600 }}>
                  This releases your seat in IEU Labs. The official drop still goes through IE&apos;s
                  add/drop process.
                </p>
                <div className="entry-actions" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => void dropPlace()}
                  >
                    {busy ? "Working…" : "Yes, drop my place"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => setConfirmDrop(false)}
                    disabled={busy}
                  >
                    Keep my place
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setConfirmDrop(true)}
              >
                Drop my place
              </button>
            )}
          </div>
        )}
      </section>

      {/* ---------------- How it's decided ---------------- */}
      <section className="card" aria-labelledby="howdecided">
        <h2 id="howdecided">How it&apos;s decided</h2>
        <ul className="stack-sm" style={{ paddingLeft: 20, margin: 0 }}>
          <li>Places go in lottery order, not by speed. Logging in early changes nothing.</li>
          <li>
            Ranking honestly is always your best strategy — putting a lab you want less above one
            you want more can only make your result worse.
          </li>
          <li>A drop can only move you up the list, never down.</li>
          <li>
            Late rankings are handled in daily batches at{" "}
            {round.batch_time.slice(0, 5)} Madrid time, after all on-time students, so they only
            take seats nobody on time wanted.
          </li>
        </ul>
      </section>

      {/* ---------------- Deadlines ---------------- */}
      <section className="card" aria-labelledby="deadlines">
        <h2 id="deadlines">Deadlines</h2>
        <ul className="countdown-list">
          <li>
            <span>
              <strong>Application deadline</strong>
              <br />
              <span className="muted">
                {formatStamp(round.application_deadline)} — {countdown(round.application_deadline)}
              </span>
            </span>
          </li>
          <li>
            <span>
              <strong>Add deadline (late rankings)</strong>
              <br />
              <span className="muted">
                {formatStamp(round.add_deadline)} — {countdown(round.add_deadline)}
              </span>
            </span>
          </li>
          <li>
            <span>
              <strong>Drop deadline</strong>
              <br />
              <span className="muted">
                {formatStamp(round.drop_deadline)} — {countdown(round.drop_deadline)}
              </span>
            </span>
          </li>
        </ul>
      </section>

      {/* ---------------- My ranking ---------------- */}
      <section className="card" aria-labelledby="myranking">
        <h2 id="myranking">Your ranking</h2>

        {willBeLate && (
          <p className="msg msg-info">
            The application deadline has passed. You can still submit a <strong>late ranking</strong>{" "}
            until the add deadline. Late rankings are processed in the daily batch at{" "}
            {round.batch_time.slice(0, 5)} Madrid time, after every on-time student, and cannot be
            changed once submitted.
          </p>
        )}

        {!canEdit && hasApplied && (
          <p className="msg msg-info">
            Your ranking is locked:{" "}
            {isLateApplicant
              ? "a late ranking cannot be changed."
              : "the application deadline has passed."}
          </p>
        )}

        {!canEdit && !hasApplied && (
          <p className="msg msg-info">The add deadline has passed, so no new rankings are taken.</p>
        )}

        {choices.length === 0 ? (
          <p className="muted">
            Nothing ranked yet. Pick up to five labs below, in the order you actually want them.
          </p>
        ) : (
          <ol className="rank-list">
            {choices.map((c, i) => {
              const lab = labById(c.lab_id);
              return (
                <li className="rank-item" key={c.lab_id}>
                  <div className="row-between">
                    <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span className="rank-num" aria-hidden="true">
                        {i + 1}
                      </span>
                      <strong>
                        <span className="sr-only">Choice {i + 1}: </span>
                        {lab?.name ?? "Lab"}
                      </strong>
                    </span>
                    {canEdit && (
                      <span style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-quiet"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                        >
                          Up<span className="sr-only"> — move {lab?.name} up</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-quiet"
                          onClick={() => move(i, 1)}
                          disabled={i === choices.length - 1}
                        >
                          Down<span className="sr-only"> — move {lab?.name} down</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-quiet"
                          onClick={() => removeLab(c.lab_id)}
                        >
                          Remove<span className="sr-only"> {lab?.name}</span>
                        </button>
                      </span>
                    )}
                  </div>
                  <p className="entry-meta">
                    {lab?.area} · {lab?.seats} seats · {lab?.tagline}
                  </p>
                  <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                    <label htmlFor={`reason-${c.lab_id}`}>Why this lab? (optional)</label>
                    <input
                      id={`reason-${c.lab_id}`}
                      type="text"
                      maxLength={300}
                      value={c.reason}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setChoices((prev) =>
                          prev.map((x) =>
                            x.lab_id === c.lab_id ? { ...x, reason: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {canEdit && (
          <button
            type="button"
            className="btn btn-lg"
            onClick={() => void saveRanking()}
            disabled={busy || choices.length === 0}
          >
            {busy ? "Saving…" : hasApplied ? "Save my ranking" : "Submit my ranking"}
          </button>
        )}
        {canEdit && !hasApplied && (
          <p className="hint">
            When you first save, the database gives you a random lottery number. You cannot choose
            or change it, and only you can see it.
          </p>
        )}
      </section>

      {/* ---------------- The labs ---------------- */}
      <section className="card" aria-labelledby="thelabs">
        <h2 id="thelabs">The labs</h2>
        <p className="muted">
          Seat numbers are the places in each lab. Open seats are counts only — never names.
        </p>
        <ul className="lab-grid">
          {labs.map((lab) => {
            const chosen = chosenIds.has(lab.id);
            return (
              <li className="lab-card" key={lab.id}>
                <h3>{lab.name}</h3>
                <p className="entry-meta" style={{ margin: 0 }}>
                  {lab.area} · {lab.seats} seats ·{" "}
                  {open[lab.id] !== undefined ? `${open[lab.id]} open` : "open seats pending"}
                </p>
                <p style={{ margin: 0 }}>{lab.tagline}</p>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={chosen || choices.length >= 5}
                    onClick={() => addLab(lab.id)}
                  >
                    {chosen
                      ? "Already ranked"
                      : choices.length >= 5
                        ? "5 labs ranked"
                        : "Add to my ranking"}
                    <span className="sr-only"> — {lab.name}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <p>
        <Link href="/app">Back to my lab week</Link>
      </p>
    </div>
  );
}
