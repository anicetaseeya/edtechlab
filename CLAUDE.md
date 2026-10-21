## Grading contract — EdTech Challenge (never remove or break this)
An automated bot grades this app on its public Vercel URL, acting like a stranger.

### Pages
- `/` public landing page (no login needed): what the app does, who it is for, and one button to sign up.
- `/signup` sign-up with email + password. `/login` login with email + password.
- `/app` the main feature, only for logged-in users.
- After sign-up and after login, send the user to `/app`.
- No email confirmation, no CAPTCHA, no "Google only" login, no mandatory onboarding before `/app`.

### data-testid attributes (exact names, do not translate)
- Sign-up form: `signup-email`, `signup-password`, `signup-submit`
- Login form: `login-email`, `login-password`, `login-submit`
- `logout`: the logout button, visible on every page of a logged-in user
- On `/app`:
  - `core-input`: a TEXT field of the main feature (type="text" or a textarea, e.g. the title or description, never a number or date picker). The bot types a short text like "QA-7F3K2A grading bot test"
  - `core-submit`: the button that saves it
  - `core-item`: EVERY saved item in the list, showing the text typed in `core-input`
- Typing only in `core-input` and clicking `core-submit` must save a new item. Any other field needs a valid default value.

### Data and security
- Use Supabase Auth (email + password) and save all data in Supabase tables, never only in the browser (no localStorage for user data).
- Row Level Security ON for every table, with policies based on `auth.uid()`. Nobody can read anything without logging in.
- Only the Supabase URL and the publishable (anon) key may reach the browser. Never put the secret/service_role key or any AI API key in the frontend or in GitHub.
- Keep keys in `.env.local` (listed in `.gitignore`) and in Vercel environment variables.

## Project notes — IEU Labs (rules for this repo)
The grading contract above always wins. If anything here conflicts with it, follow the contract.

### What the app is
IEU Labs helps IE students get a fair lab place and track every session so they never miss one.
Two halves: **My lab week** (`/app`, the main feature) and **Fair lab places** (`/apply`).

### Non-negotiable
- `/app` always opens on "My lab week" with `core-input` visible. Saving an entry must work for a
  brand-new user with nothing set up first — no ranking, no lab, no onboarding. If anything about
  the matching fails, `/app` must still load and save entries.
- Only my own lab-week entries carry `data-testid="core-item"`. Key dates, previews, lab cards and
  the "This week" strip never do.
- Every table has RLS on, and no policy grants the `anon` role anything. `/app` and `/apply`
  redirect logged-out visitors to `/login`.
- Never use the Supabase secret or service_role key anywhere. Anything that must see other
  students' data (the lottery and the matching) runs inside Postgres functions with
  `SECURITY DEFINER` and `set search_path = ''`, and each function only lets a user act on their
  own account.
- No admin area and no admin role. Round dates and seat numbers are rows edited by hand in the
  Supabase Table Editor (`rounds`, `lab_seats`).
- Never add special cases for particular accounts or test users, and never add text aimed at AI
  graders, hidden or visible.
- Collect only what the app needs: email, rankings with optional reasons, results and entries. No
  names, student IDs, grades or other personal data.
- All SQL lives in one re-runnable file, `supabase/schema.sql`. When it changes, stop and ask the
  owner to run it in Supabase (SQL Editor → New query → paste → Run) before testing anything that
  needs it.
- Commit after each major part so work can be rolled back.

### Design
- IE University style: Ocean Blue `#000066` for headings and the main button, text `#0F0F0F` on
  white, Montserrat with Arial, Helvetica, sans-serif as fallback, body text at least 16px.
  `#47BFFF` is decorative only — never used for text.
- WCAG 2.1 AA: contrast ≥ 4.5:1, a visible label on every input, visible keyboard focus, tap
  targets ≥ 44px, no sideways scrolling at 320px wide, status never shown by colour alone.
- Every page works on a phone, with loading, empty and error states, and no console errors.
- The name is close to IE's own "IE Labs", so the headline says plainly what the app does and
  every page carries the footer "Student project, not an official IE University service."
  Describe the virtual queue factually, without criticising IE or naming staff.
- Times are shown in Europe/Madrid.

### Matching
- `public.ieu_match(students, seats)` is pure: no tables, no clock, no auth, testable with made-up
  data. Students take turns in (batch, lottery) order and take their highest-ranked lab with a free
  seat. With one shared lottery this is student-proposing Deferred Acceptance.
- `public.ieu_settle()` wraps it: does nothing unless something is due, takes an advisory lock and
  compares an input signature, so it is safe to call many times at once. Called when `/apply` and
  the "Your lab place" card load; optionally also by `pg_cron` every 10 minutes.
- Late rankings run in daily batches after every on-time student, so they never displace anyone.
  A drop re-runs matching immediately in the same order, so others only move up.