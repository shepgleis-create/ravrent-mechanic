# Ravrent Mechanic — Integrated Automotive Assistant

Responsive, dark-themed car troubleshooting web application developed under Ravrent Interactive.

## Current features
- Integrated chat: visitors are **not** asked for a model-provider API key or a separate access code.
- Dark interface across chat, garage, trouble codes, saved reports and dialogs, with responsive mobile composer.
- Deep diagnosis and optional source-backed web research.
- Transparent research fallback: if the request is rejected because research requires a paid tier or is quota-limited, the backend tries AI reasoning without web research, followed by one lower-cost backup model if the first model is unavailable.
- Conversations, vehicle profiles, reported repair history, image input and saved/exportable diagnostic reports.
- Neutral user-facing errors if no actual AI response can be obtained. No fabricated research or canned diagnosis.

## Server configuration (app owner only)

Google Gemini remains the third-party inference service behind the app. The interface is independently branded, but this does **not** mean Ravrent created its own foundation model.

In Vercel, project ravrent-mechanic → Settings → Environment Variables:

- `GEMINI_API_KEY` — required. Store as a server-side Secret for Production; **never** commit the value to GitHub or put it into client code.
- `GEMINI_MODEL` — optional, default `gemini-3.8-flash`.
- `MECHANIC_ACCESS_CODE` — no longer used by the chat; can be removed from Vercel if desired.

Redeploy the latest production commit after changing environment variables. The public `/api/status` endpoint only reports whether the secret is present, not if a request can succeed.

### Why the earlier AI response failed
The application was requesting Google Search grounding on Gemini 3.8 Flash for every chat by default, but grounding is not available to free-tier API customers for this model. A 429 may also mean the API project's model quota or request allowance is exhausted. The new backend retries without grounded research and can try a lightweight model instead.

Google documents grounding availability, API rates and tiers at:
https://ai.google.dev/gemini-api/docs/pricing

Enabling eligible paid billing may be required for deep *live* web research. Never claim web research succeeded if the API does not return search metadata.

## Architecture
- `index.html`: branded chat application shell
- `style.css`: full graphite dark design and mobile layout
- `app.js`: client conversations, navigation, attachment compression, garage, code reference and reports
- `api/chat.js`: server-side inference gateway, optional source grounding, fallback, input limits and request throttling
- `api/status.js`: no-secrets readiness check
- `vercel.json`: serverless functions

## Security and launch restrictions

**This is a limited private beta, not a secure public paid product yet.** The website now uses a server-side key automatically. Its chat endpoint may be reachable by anyone with the URL.

The server has same-origin browser checking, best-effort per-instance IP quotas and request-size limits, but **these are not sufficient to prevent abuse or billing exposure** across distributed functions. Before promoting the site, add a real identity solution or Vercel deployment protection, distributed throttling, persistent per-account usage limits, budget monitoring and abuse alerts. Do not rely on browser-provided request headers as authentication.

Chats and vehicle records currently use local browser storage without encryption, multi-device synchronization, or backed-up storage. Only images submitted in conversations are forwarded to the third-party model; no live scanner data or sound analysis has been implemented.

AI diagnostic advice is not an in-person inspection. Always verify measurements, wiring, service procedures, parts and torque values against qualified repair sources, especially with brakes, steering, fuel systems, overheating or electrical risks.
