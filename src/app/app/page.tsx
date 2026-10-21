import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LabWeek from "@/components/labweek/LabWeek";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import type { Entry } from "@/lib/types";

export const metadata: Metadata = {
  title: "My lab week — IEU Labs",
  description: "Every lab session, meeting, deliverable and deadline in one list.",
};

export const dynamic = "force-dynamic";

export default async function AppPage() {
  if (!(await getCurrentUser())) redirect("/login");

  const supabase = await createClient();

  // Rendered on the server so the list is in the page from the first byte,
  // with no loading flash. The browser refreshes it straight afterwards.
  const { data } = await supabase
    .from("entries")
    .select("*")
    .order("entry_date", { ascending: true })
    .order("entry_time", { ascending: true, nullsFirst: true });

  return <LabWeek initialEntries={(data ?? []) as Entry[]} />;
}
