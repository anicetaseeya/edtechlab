import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LabWeek from "@/components/labweek/LabWeek";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My lab week — IEU Labs",
  description: "Every lab session, meeting, deliverable and deadline in one list.",
};

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <LabWeek />;
}
