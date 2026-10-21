"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lab, MyStatus } from "@/lib/types";

/** Small summary of my lab place. If anything here fails it stays quiet —
 *  /app and saving entries must keep working regardless. */
export default function LabPlaceCard() {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<MyStatus | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Matching runs by itself: this is one of the places that nudges it.
        await supabase.rpc("ieu_settle");
        const [{ data: st, error: stErr }, { data: labRows }] = await Promise.all([
          supabase.rpc("ieu_my_status"),
          supabase.from("lab_seats").select("*").order("sort_order"),
        ]);
        if (!alive) return;
        if (stErr) {
          setState("error");
          return;
        }
        setStatus(st as MyStatus);
        setLabs((labRows ?? []) as Lab[]);
        setState("ok");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  const labName = (id: string | null | undefined) =>
    labs.find((l) => l.id === id)?.name ?? "your lab";

  let body: React.ReactNode;

  if (state === "loading") {
    body = <p style={{ margin: 0 }}>Loading…</p>;
  } else if (state === "error" || !status?.round) {
    body = (
      <p style={{ margin: 0 }}>
        We could not load your lab place just now. Your lab week below is unaffected.
      </p>
    );
  } else if (status.dropped_at) {
    body = (
      <p style={{ margin: 0 }}>
        You dropped your place in this round. Your seat went back to the next student.
      </p>
    );
  } else if (!status.submitted_at) {
    body = <p style={{ margin: 0 }}>You have not ranked any labs yet.</p>;
  } else if (!status.result) {
    body = (
      <p style={{ margin: 0 }}>
        Your ranking is saved. Places are decided after the application deadline — nothing to do
        until then.
      </p>
    );
  } else if (status.result.lab_id) {
    body = (
      <>
        <p className="entry-title" style={{ marginBottom: 2 }}>
          Your lab: {labName(status.result.lab_id)}
        </p>
        <p className="entry-meta" style={{ marginTop: 0 }}>
          {status.result.choice_rank ? `Your choice number ${status.result.choice_rank}.` : ""}{" "}
          {status.lottery_number !== null && status.lottery_number !== undefined
            ? `Your lottery number: ${status.lottery_number.toFixed(6)}.`
            : ""}
        </p>
      </>
    );
  } else {
    body = (
      <p style={{ margin: 0 }}>
        No seat yet — you are on the waiting list for the labs you ranked. See the details and your
        position below.
      </p>
    );
  }

  return (
    <section className="card card-highlight" aria-labelledby="labplace">
      <p className="eyebrow" id="labplace">
        Your lab place
      </p>
      {body}
      <p style={{ margin: "12px 0 0" }}>
        <Link href="/apply" className="btn btn-secondary">
          Rank labs and see your place
        </Link>
      </p>
    </section>
  );
}
