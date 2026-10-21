"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Round } from "@/lib/types";
import { countdown, formatStamp } from "@/lib/dates";
import { downloadIcs } from "@/lib/ics";

/** Countdowns to the current round's deadlines. Never carries core-item. */
export default function KeyDates() {
  const supabase = useMemo(() => createClient(), []);
  const [round, setRound] = useState<Round | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("rounds")
          .select("*")
          .eq("is_current", true)
          .order("application_deadline")
          .limit(1);
        if (!alive) return;
        if (error) {
          setState("error");
          return;
        }
        setRound(((data ?? [])[0] as Round) ?? null);
        setState("ok");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  const items = round
    ? [
        { key: "application", label: "Application deadline", at: round.application_deadline },
        { key: "add", label: "Add deadline (late rankings)", at: round.add_deadline },
        { key: "drop", label: "Drop deadline", at: round.drop_deadline },
      ]
    : [];

  return (
    <section className="card" aria-labelledby="keydates">
      <h2 id="keydates">Key lab dates</h2>

      {state === "loading" && <p style={{ margin: 0 }}>Loading…</p>}

      {state === "error" && (
        <p style={{ margin: 0 }}>
          We could not load the round dates just now. Your lab week below is unaffected.
        </p>
      )}

      {state === "ok" && !round && (
        <p style={{ margin: 0 }}>No round is open at the moment.</p>
      )}

      {state === "ok" && round && (
        <ul className="countdown-list">
          {items.map((it) => (
            <li key={it.key}>
              <span>
                <strong>{it.label}</strong>
                <br />
                <span className="muted">
                  {formatStamp(it.at)} — {countdown(it.at)}
                </span>
              </span>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() =>
                  downloadIcs({
                    uid: `${round.id}-${it.key}`,
                    title: `IEU Labs — ${it.label}`,
                    date: new Intl.DateTimeFormat("en-CA", {
                      timeZone: "Europe/Madrid",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(new Date(it.at)),
                    time: new Intl.DateTimeFormat("en-GB", {
                      timeZone: "Europe/Madrid",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    }).format(new Date(it.at)),
                    description: "Student project, not an official IE University service.",
                  })
                }
              >
                Add to calendar<span className="sr-only"> — {it.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
