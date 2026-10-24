# Public role demo

The owner explicitly chose public access to all four seeded roles, including Admin. This is access to the real project with the existing account permissions, not a simulated dashboard. Do not use this setup for private production data.

The landing header calls `demo-login` with only FARMER, BUYER, CARRIER or ADMIN. The Edge Function maps that role to one fixed seeded UUID/email, verifies profile role and suspension status, then creates and verifies a magic link server-side. No email is sent. The browser receives a normal Supabase session and follows the normal role guard and RLS. Passwords and service credentials are never bundled or returned.

Deploy `supabase/functions/demo-login/index.ts` as `demo-login` with JWT verification disabled (also recorded in config.toml). It uses Supabase's built-in server-only environment variables. To stop public demo sign-ins, set the Edge Function secret `PUBLIC_DEMO_ENABLED=false`; existing sessions remain subject to normal Supabase expiry and revocation.

The four seeded identities are fixed in the handler. Unknown input fields, roles, suspended/mismatched profiles and foreign browser origins fail closed. Responses containing tokens use Cache-Control: no-store. The UI serializes clicks and reports failures without falling back to a privileged local session.

The public hero uses the user-supplied orchard-harvest.png. Plus Jakarta Sans is self-hosted with its Vietnamese subset; hero emphasis inherits the same font, size, weight and line height.
