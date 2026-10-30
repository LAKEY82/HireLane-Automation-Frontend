# Hirelane

*Your inbox, sorted into a shortlist.* Hirelane is the Next.js app for the n8n workflow **QA Intern Applications**. It can:

- turn the automation on/off and run it on demand,
- show applicants from both Google Sheets and set their Status (Pending / Shortlisted / Rejected),
- run several **campaigns** at once, one per role. Each has its own:
  - subject keywords
  - position
  - relevant-experience rule
  - Google Sheets and CV folders
- create, edit, pause and delete campaigns. Deleting a campaign leaves its sheets and CVs in Google.
- switch the mailbox between Gmail and Hostinger mail. Applications are read from it and rejection emails are sent from it.
- change the Sheets/Drive logins and the schedule.

Campaigns are stored in the n8n Data Table **Hirelane Campaigns**, which the app reads and writes through the n8n API.

## How it talks to n8n

| Feature | Uses |
|---|---|
| Settings, on/off, recent runs | n8n public REST API (`N8N_API_KEY`) |
| Run now, applicant list, status changes | Webhooks `qa-admin/*` in the workflow, protected by the `X-Admin-Secret` header (`N8N_WEBHOOK_SECRET`) |

"Automation on/off" enables or disables the workflow's two automatic triggers. The workflow itself must stay **active** so the webhooks work.

## One-time n8n setup

1. In n8n, go to **Credentials → Create → Header Auth**. Name it `Frontend Webhook Secret`. Set **Name** to `X-Admin-Secret` and **Value** to the same value as `N8N_WEBHOOK_SECRET`.
2. Select that credential in the 4 nodes `Admin: Run Intake`, `Admin: Run Rejections`, `Admin: List Applicants` and `Admin: Set Status`.
3. Activate the workflow (or use the **Activate workflow** button on the dashboard).
4. For Hostinger mail: install the community node in n8n (**Settings → Community nodes → Install → `n8n-nodes-imap@3.0.1`**). On Render also set `N8N_REINSTALL_MISSING_PACKAGES=true`, because its disk is wiped on restart. Then connect the mailbox under **Settings → Email account**; the app creates and tests the IMAP/SMTP logins in n8n.

## Sign-in

- **Hostinger email + password:** the password is checked with Hostinger's IMAP server; that mailbox then becomes the application inbox and rejection sender.
Sign-in uses Auth.js (`auth.ts`). The Google and Microsoft buttons appear only when their keys are set.

- **Continue with Google:** one Google consent screen. The app gives n8n access to that Gmail and switches the workflow to it.
  - Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, using the same Google Cloud OAuth client as n8n.
  - In Google Cloud → Credentials → that client, add the redirect URI `<app URL>/api/auth/callback/google`.
  - While the Google app is in "Testing", every account must be listed as a test user.
- **Continue with Microsoft:** login only; the inbox doesn't change.
  - Azure portal → App registrations → New registration.
  - Supported accounts: "any organizational directory and personal Microsoft accounts".
  - Redirect URI (Web): `<app URL>/api/auth/callback/microsoft-entra-id`.
  - Create a client secret, then set `AUTH_MICROSOFT_ENTRA_ID_ID` and `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
- **Allowlist:** only addresses at `ALLOWED_EMAIL_DOMAINS`, or listed in `ALLOWED_EMAILS`, can sign in.
- **Backup:** the admin password still works and doesn't change the inbox.
- **Lockout:** after 5 failed attempts, sign-in is blocked for 15 minutes. The count is kept per server instance.

## Run locally

```bash
cp .env.example .env.local   # then fill it in
npm install
npm run dev                  # http://localhost:3000
```

## Deploy to Vercel

1. Import the GitHub repo in Vercel and set **Root Directory** to `frontend`.
2. Add every variable from `.env.example` under **Settings → Environment Variables**. `N8N_BASE_URL` must be your public n8n URL, such as `https://your-n8n.example.com`, not localhost.
3. Deploy.

## Dev check

`npx tsx scripts/roundtrip-check.ts` reads the live workflow's settings and confirms that saving them unchanged would modify nothing.
