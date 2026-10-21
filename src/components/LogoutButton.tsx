import { signOutAction } from "@/app/auth/actions";

/** A real form, so logging out works with or without JavaScript. */
export default function LogoutButton() {
  return (
    <form action={signOutAction} style={{ display: "inline-flex" }}>
      <button type="submit" className="btn btn-quiet" data-testid="logout">
        Log out
      </button>
    </form>
  );
}
