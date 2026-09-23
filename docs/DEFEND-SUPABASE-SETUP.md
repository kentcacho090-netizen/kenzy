# Defend + Supabase setup

Defend is now integrated into Kenzy as the **Defense Lab** tab. The existing Kenzy pages remain unchanged.

## Vercel environment variables

In the **StudyKen / studyken** Vercel project, open:

**Settings → Environment Variables → Add**

Add these two variables:

```
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Apply them to **Production, Preview, and Development** as needed.

Do **not** use a Supabase secret key or service-role key in a `REACT_APP_*` variable. React client variables are bundled into the browser; only a Supabase publishable key belongs there.

After saving the variables, redeploy the Vercel project. Environment-variable changes do not affect an already-built deployment until a new deployment is created.

## Supabase

1. Create/open the Supabase project.
2. Open the project's **Connect** dialog or **Settings → API Keys**.
3. Copy the Project URL.
4. Copy the **Publishable key** beginning with `sb_publishable_`.
5. Paste those values into the Vercel variables above.
6. Re-deploy StudyKen.
7. Open **Defense Lab** on two devices.
8. One device creates a room; the other joins using the room code.
9. Both devices should show the same joined-member list and defense feed.

The current prototype uses Supabase Realtime Presence + Broadcast. Production hardening should later add authenticated/private channels and persisted room state.
