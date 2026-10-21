"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // Signing out locally is enough to end the session in this browser.
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      className="btn btn-quiet"
      data-testid="logout"
      onClick={logout}
      disabled={busy}
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
