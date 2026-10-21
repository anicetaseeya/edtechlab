"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthState } from "@/app/auth/actions";

export default function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const isSignup = mode === "signup";

  // The form posts to a server action, so it works even if the page has not
  // finished loading its JavaScript yet.
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    isSignup ? signUpAction : signInAction,
    null,
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="wrap-narrow" style={{ paddingTop: 24 }}>
      <h1>{isSignup ? "Create your account" : "Log in"}</h1>
      <p className="muted">
        {isSignup
          ? "Email and password only. No confirmation email, you go straight to your lab week."
          : "Welcome back. Log in to see your lab week."}
      </p>

      {state?.error && (
        <p className="msg msg-error" role="alert">
          {state.error}
        </p>
      )}

      <form action={formAction}>
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
          disabled={pending}
        >
          {pending ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
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
