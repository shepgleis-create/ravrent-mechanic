# Ravrent Mechanic

Mobile-first automotive troubleshooting assistant for Ravrent Interactive.

## Live AI provider: Google Gemini

The app has two modes:
- **Guided diagnostics**: offline rule-based explanations, without an API key.
- **Google Gemini AI**: live, vehicle-aware conversational troubleshooting through `api/chat.js`.

The AI endpoint supports multi-turn chat, vehicle context, and an optional inline photo in the last user message (the current browser interface has not yet added the photo-picker control).

### Configure Google Gemini on Vercel

1. Create your Google Gemini API key from https://aistudio.google.com/api-keys (Google AI Studio).
2. Open Vercel → `ravrent-mechanic` → Settings → Environment Variables.
3. Add the following **private** environment variables for Production:
   - `GEMINI_API_KEY`: paste the secret from Google AI Studio.
   - `MECHANIC_ACCESS_CODE`: create a long random access password for private testing.
   - `GEMINI_MODEL` (optional): defaults to `gemini-3.8-flash`. For lower-cost use where available, choose `gemini-3.5-flash-lite`.
4. Redeploy the Production deployment to load the changed configuration.
5. Open the app, click **Connect Google Gemini**, enter **only your access code**, then send a diagnostic question.

**Never commit, share, or enter the Gemini API key in the browser.** `.env.example` contains *variable names only*. Keep actual secrets in Vercel. OpenAI configuration is not needed.

### Current capabilities

- Responsive mobile-first interface
- Multi-car My Garage with local browser storage
- Guided diagnostics with safety triage and checks before replacing parts
- Starter OBD-II trouble-code reference (generic definitions, not a scanner)
- Saved diagnostic reports with text downloads
- Optional protected Gemini conversational API

### Current limitations

- Garage entries and report history remain in local browser storage, not synchronized to user accounts.
- No direct Bluetooth OBD scanner, live vehicle telemetry, recall lookup, licensed service manual data, automatic engine sound analysis, or mechanic directory yet.
- Photo support is prepared server-side only; frontend photo uploads are not yet implemented.
- Private-testing access code is **not public authentication**. Add proper user login, shared database, persistent distributed rate limits, per-account usage quota, cost monitoring, and abuse controls before publicly opening AI chat.
- Current rate limiting is only per running serverless instance; it is not a production abuse control.
- Diagnoses are suggestions, never proof. Use verified service info and professional inspection for important repairs or safety-critical systems.

## Architecture

- `index.html`: mobile UI, client-side state, rule-based guided mode.
- `api/chat.js`: Vercel Node serverless handler using the Google Gemini `generateContent` API.
- `vercel.json`: Vercel function configuration.
- `.env.example`: example keys, with no actual secrets.

Git pushes to `main` should deploy automatically *if* the Vercel project is properly Git-linked and has deployment permissions.
