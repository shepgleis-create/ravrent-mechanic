# Ravrent Mechanic

Mobile-first automotive diagnostic assistant built by Ravrent Interactive.

## Features
- Guided troubleshooting with urgency and safe next-step checks (works with no API key)
- Garage profiles for vehicles and mileage, stored locally in this browser
- A starter library of common OBD-II trouble codes (reference only; no scanner connection)
- Diagnostic history and downloadable text reports
- Optional live AI through a guarded Vercel API route

## Architecture
- `index.html`: self-contained responsive web app
- `api/chat.js`: optional Node.js serverless endpoint for AI reasoning
- `vercel.json`: Vercel function configuration
- `.env.example`: names of environment variables (no actual secrets)

The app can be opened locally with a static file server such as `python3 -m http.server 8080`. Guided troubleshooting remains functional even when the AI API is unconfigured.

## Deploy to Vercel
1. Import `shepgleis-create/ravrent-mechanic` into Vercel as a standalone project.
2. Leave **Framework Preset** as Other and **Root Directory** as `./`.
3. For optional live AI, set `OPENAI_API_KEY` and `MECHANIC_ACCESS_CODE` as private Vercel environment variables. `OPENAI_MODEL` is optional and defaults to `gpt-4.1-mini`.
4. Redeploy, then enter only the access code (never the API key) using **Connect live AI** in the app.

Do **not** put API keys or access codes into GitHub files, HTML, or a public-facing environment variable.

## Safety and current limitations
- This is a prototype. It cannot confirm mechanical failures or replace professional inspection or verified service information.
- Trouble-code references are incomplete and may not cover manufacturer-specific codes.
- No live OBD-II Bluetooth scanning, recall feed, licensed repair manuals, vehicle audio/video diagnosis, or mechanic network is connected yet.
- Browser `localStorage` is device/browser-specific, not cloud-backed.
- The access-code system is **private-test-only**, not suitable for a public paid AI service. Add real authentication, server-side rate limiting, abuse protection, usage quotas, monitoring, and database before opening AI access publicly.
- Stop driving and seek professional help for serious brake, steering, fuel leak, overheating, smoke, or other safety-critical symptoms.
