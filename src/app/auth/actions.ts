"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string } | null;

/**
 * Sign-up, log-in and log-out all run on the server.
 *
 * That means the forms work even before the page's JavaScript has loaded:
 * the browser posts them normally, the session cookie is set server-side and
 * the user lands on /app. Nothing is ever put in the URL.
 */

function read(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = read(formData);
  if (!email || !password) return { error: "Please fill in your email and your password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // Email confirmation is off, so a session comes back straight away. If it
  // ever does not, log in with the same details.
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) return { error: signInError.message };
  }

  redirect("/app");
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = read(formData);
  if (!email || !password) return { error: "Please fill in your email and your password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "That email and password do not match. Please try again."
          : error.message,
    };
  }

  redirect("/app");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
