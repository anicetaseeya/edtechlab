import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/user";
import LogoutButton from "./LogoutButton";

export default async function SiteHeader() {
  const signedIn = Boolean(await getCurrentUser());

  return (
    <header className="site-header">
      <div className="wrap">
        <Link href={signedIn ? "/app" : "/"} className="brand">
          IEU Labs<span>Student project</span>
        </Link>
        {/* Logged out, the header stays empty on purpose: each public page
            keeps a single clear call to action. */}
        {signedIn ? (
          <nav className="nav" aria-label="Main">
            <Link href="/app" className="btn btn-quiet">
              My lab week
            </Link>
            <Link href="/apply" className="btn btn-quiet">
              Lab places
            </Link>
            <LogoutButton />
          </nav>
        ) : null}
      </div>
    </header>
  );
}
