import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "IEU Labs — get a fair lab place, never miss a lab session",
  description:
    "IEU Labs helps IE students get a fair lab place and track every session so they never miss one.",
};

/* A static preview only. Nothing here is loaded from the database and
   nothing here carries data-testid. */
const PREVIEW = [
  {
    title: "Partner meeting — kick-off",
    meta: "Partner meeting · Tue 18:00 · Online",
    badges: [
      { label: "Mandatory", className: "badge-mandatory" },
      { label: "Moved — was Tue 19:00", className: "badge-moved" },
    ],
  },
  {
    title: "Joint session with the Social Impact Lab",
    meta: "Session · Thu · Madrid, room to confirm",
    badges: [{ label: "Time or room TBC", className: "badge-tbc" }],
  },
  {
    title: "Minutes due to the lab coordinator",
    meta: "Deliverable · Fri 23:59",
    badges: [],
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="wrap hero">
        <h1>Get a fair lab place. Never miss a lab session.</h1>
        <p className="sub">
          IEU Labs helps IE students get a fair lab place and track every session so they never
          miss one. IE Labs are the hands-on, term-long projects where small student teams work
          with real organisations such as companies, NGOs, start-ups or public bodies alongside
          their degree.
        </p>
        <div className="hero-actions">
          <Link href="/signup" className="btn btn-lg">
            Sign up
          </Link>
          <Link href="/login">Log in</Link>
        </div>
        <p className="muted">Free, built by a student. Email and password, nothing else.</p>
      </section>

      <section className="wrap" aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <ol className="steps">
          <li className="step">
            <span className="n" aria-hidden="true">
              1
            </span>
            <h3>Rank your labs</h3>
            <p>
              Choose up to five labs in the order you actually want them, with a short reason if
              you like. You have until the application deadline to change your mind.
            </p>
          </li>
          <li className="step">
            <span className="n" aria-hidden="true">
              2
            </span>
            <h3>Get matched by lottery</h3>
            <p>
              Places are handed out in a random lottery order, not by who clicks fastest. Everyone
              takes a turn and gets their highest choice that still has a seat.
            </p>
          </li>
          <li className="step">
            <span className="n" aria-hidden="true">
              3
            </span>
            <h3>Run your lab week</h3>
            <p>
              Keep every session, partner meeting, deliverable and deadline in one list, with the
              changes marked, so a moved meeting never catches you out.
            </p>
          </li>
        </ol>
      </section>

      <section className="wrap" aria-labelledby="why" style={{ marginTop: 32 }}>
        <h2 id="why">Why it exists</h2>
        <p style={{ maxWidth: "68ch" }}>
          Lab places have been handed out through a virtual queue, first come first served, so the
          fastest clicks got the most popular labs, and seats freed at add/drop were announced ad
          hoc and went to whoever replied first. Once you are in a lab, the plan arrives in pieces:
          announcements on one platform, links on another, files on a third, and a WhatsApp group
          on top. Times and rooms change, some sessions are mandatory, and missing them has
          consequences.
        </p>
        <p style={{ maxWidth: "68ch" }}>
          IEU Labs covers the whole cycle: rank once and get a place by lottery order instead of
          speed, let a freed seat pass to the next student automatically, and keep every session,
          change and deadline in one list. There is no admin — the matching runs by itself.
        </p>
      </section>

      <section className="wrap" aria-labelledby="preview" style={{ marginTop: 32 }}>
        <h2 id="preview">What your lab week looks like</h2>
        <p className="muted">An example — these are made-up entries, not real data.</p>
        <ul className="preview">
          {PREVIEW.map((p) => (
            <li key={p.title}>
              <p className="entry-title">{p.title}</p>
              <p className="entry-meta">{p.meta}</p>
              {p.badges.length > 0 && (
                <p className="badges">
                  {p.badges.map((b) => (
                    <span key={b.label} className={`badge ${b.className}`}>
                      {b.label}
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap" aria-labelledby="areas" style={{ marginTop: 32 }}>
        <h2 id="areas">The three lab areas</h2>
        <ul className="area-list">
          <li>Consultancy</li>
          <li>Social Impact</li>
          <li>Entrepreneurship</li>
        </ul>
        <p className="muted" style={{ maxWidth: "68ch" }}>
          Sixteen labs across the three areas, from the AI Lab and the Legal Clinic to the
          Sustainability Lab and the Start-Up Lab. You see every tagline and every seat count
          before you rank.
        </p>
        <p style={{ marginTop: 24 }}>
          <Link href="/signup" className="btn btn-lg">
            Sign up
          </Link>
        </p>
      </section>
    </>
  );
}
