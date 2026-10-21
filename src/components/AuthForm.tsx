"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/env";

export default function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!supabaseConfigured) {
      setError("The app is not connected to its database yet. Please try again later.");
      return;
    }

    setBusy(true);
    const supabase = createClient();

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

        if (signUpError) {
          setError(signUpError.message);
          setBusy(false);
          return;
        }

        // Email confirmation is off, so a session comes back straight away.
        // If it ever does not, sign in with the same details.
        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            setError(signInError.message);
            setBusy(false);
            return;
          }
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(
            signInError.message === "Invalid login credentials"
              ? "That email and password do not match. Please try again."
              : signInError.message,
          );
          setBusy(false);
          return;
        }
      }
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      setBusy(false);
      return;
    }

    // A full page load so the server sees the new session cookie right away.
    window.location.assign("/app");
  }

  return (
    <div className="wrap-narrow" style={{ paddingTop: 24 }}>
      <h1>{isSignup ? "Create your account" : "Log in"}</h1>
      <p className="muted">
        {isSignup
          ? "Email and password only. No confirmation email, you go straight to your lab week."
          : "Welcome back. Log in to see your lab week."}
      </p>

      {error && (
        <p className="msg msg-error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor={`${mode}-email`}>Email address</label>
          <input
            id={`${mode}-email`}
            data-testid={`${mode}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor={`${mode}-password`}>Password</label>
          <input
            id={`${mode}-password`}
            data-testid={`${mode}-password`}
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isSignup && <p className="hint">At least 6 characters.</p>}
        </div>

        <button
          type="submit"
          className="btn btn-block btn-lg"
          data-testid={`${mode}-submit`}
          disabled={busy}
        >
          {busy ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
        </button>
      </form>

      <p style={{ marginTop: 20 }}>
        {isSignup ? (
          <>
            Already have an account? <Link href="/login">Log in</Link>
          </>
        ) : (
          <>
            No account yet? <Link href="/signup">Sign up</Link>
          </>
        )}
      </p>
      <p>
        <Link href="/">Back to the home page</Link>
      </p>
    </div>
  );
}
