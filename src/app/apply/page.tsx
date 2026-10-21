import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Apply from "@/components/apply/Apply";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Fair lab places — IEU Labs",
  description:
    "Rank up to five labs and get a place in lottery order instead of by who clicks fastest.",
};

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <Apply />;
}
