# Ravrent Mechanic V2 — Automotive AI Diagnostics

Chat-first, mobile-responsive mechanic research assistant by Ravrent Interactive.

## New in V2
- Gemini 3.8 Flash with optional high reasoning effort and Google Search grounding
- Verifiable source links when Google actually uses search; no fabricated research
- Proper API and quota errors rather than silent fallback to repeated canned replies
- Separate chat threads, multiple garage vehicles, mileage and maintenance history
- Vehicle photo attachments for visible problems (no engine sound recognition)
- OBD-II generic code library, exportable diagnostic reports
- ChatGPT-style clean conversation interface with original Ravrent branding

## Connect Gemini

1. Create a Gemini key at https://aistudio.google.com/api-keys
2. In Vercel, open ravrent-mechanic → Settings → Environment Variables. Add these server-only Secret values for Production:
   - GEMINI_API_KEY = the actual Google AI Studio key
   - MECHANIC_ACCESS_CODE = a separate long random password for private testing
3. Optional GEMINI_MODEL = gemini-3.8-flash. That model is the default.
4. Redeploy latest main branch after setting the secrets.
5. Open the app and use the gear to enter only the private access code, never the Google API key.
6. Enable both Think deeper and Web research for higher reasoning and Google Search grounding.

The top bar checks /api/status. It confirms that both environment variables are present, not that Google accepts the credentials. Send a test question to verify the live connection.

Google Search grounding can incur extra charges per search and high thinking consumes more tokens. Review the current billing and quota information at https://ai.google.dev/gemini-api/docs/pricing.

## Project files
- index.html: chat interface, navigation, modals
- style.css: responsive styling
- app.js: threads, diagnoses, garage, service notes, images, reports
- api/chat.js: Gemini reasoning and grounded search with source attribution
- api/status.js: no-secret configuration readiness endpoint
- vercel.json: Vercel functions configuration

## Known limitations and safety

This is a private beta, not a public production AI service. Shared access codes and per-instance rate limiting do not replace account authentication and distributed quotas. Add user authentication, data storage, quotas, spend controls and abuse protection before opening this to the public.

Conversations, garage entries and service logs currently live in browser localStorage; they are not cross-device or cloud-synced. Deleting site data loses them. Photo upload works for visual questions; actual OBD-II device scanning, live telemetry, sound analysis, licensed manuals and mechanic booking are not implemented. Google Search is optional and Gemini may return no results.

AI diagnostics are hypotheses, not a physical inspection. Never drive a vehicle with unsafe steering or brakes, overheating, smoke or fuel leakage. Check manufacturer repair specifications and use qualified professional help when appropriate. Never commit secrets to GitHub or frontend files.
