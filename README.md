# Ravrent Mechanic — Integrated Automotive Assistant

Responsive, dark-themed car troubleshooting web application developed under Ravrent Interactive.

## Current features
- Integrated chat: visitors are **not** asked for a model-provider API key or a separate access code.
- Dark interface across chat, garage, trouble codes, saved reports and dialogs, with responsive mobile composer.
- Deep diagnosis and optional source-backed web research.
- Transparent research fallback: if the request is rejected because research requires a paid tier or is quota-limited, the backend tries AI reasoning without web research, followed by one lower-cost backup model if the first model is unavailable.
- Conversations, vehicle profiles, reported repair history, image input and saved/exportable diagnostic reports.
- Neutral user-facing errors if no actual AI response can be obtained. No fabricated research or canned diagnosis.

## Current server-side AI configuration

Ravrent is independently branded, but its model inference currently runs on external services; Ravrent has **not** trained a proprietary foundation model.

The existing Vercel project is `ravrent-mechanic`. Configure provider keys only under **Settings → Environment Variables**, choose **Production**, and redeploy. Never commit or paste secrets into issues or chat.

- `GROQ_API_KEY` — current production provider. Groq hosts `openai/gpt-oss-20b` for fast text and `qwen/qwen3.8-27b` for photo and sampled video frames; exact availability depends on Groq.
- `GROQ_TEXT_MODEL` and `GROQ_VISION_MODEL` — optional model overrides; confirm both are available in your provider account.
- `TOGETHER_API_KEY` — optional alternative provider; not currently configured. `AI_PROVIDER=together` selects it, or `AI_PAID_FALLBACK_ENABLED=true` enables explicit **paid** fallback when Groq rate limits. Keep fallback **off** until billing controls and approval exist.
- `GEMINI_API_KEY` — optional Google Gemini integration. `AI_PROVIDER=gemini` selects it, but Google's key/project must be authorized separately.
- `AI_REQUESTS_ENABLED=false` — emergency inference pause. This is **not** a spend cap.
- Optional distributed anonymous beta allowance: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and strong `USAGE_METER_SECRET`. Without these, limits remain best-effort and can be bypassed by new identities or server instances. This is not subscription entitlement enforcement.

`/api/status` reports which provider is configured; `/api/provider-check` can verify model-list access. **Neither proves generation succeeds**. Only a real chat request demonstrates a working response. Current public production provider checks report Groq model-list access, with generation unverified.

### AI usage and rate-limit behavior

Groq rate limits apply to the whole provider organization. A new Ravrent conversation does not reset those limits. The API and browser relay provider `Retry-After` when present, and quick mode limits history and output tokens to reduce unnecessary cost. Public-scale usage still needs enforceable identity, durable distributed quotas, security controls and a realistic budget.

## Photo, camera, and video handling

- Live VIN camera on `/vin-report.html`: camera-permission dependent; native barcode decoding with a ZXing fallback on supported devices. Printed VINs can use client OCR. Manual VIN entry always remains available.
- AI vehicle photo analysis: sends images to the active vision model with clear uncertainty and no assumption of verified faults.
- Under Groq/Together, short video clips are sampled **locally** into two representative still images. The AI does **not** hear the audio or observe continuous motion between frames. Frame extraction is browser-dependent and must be checked on iPhone.
- Under explicitly selected Gemini, the existing resumable server-side video upload pipeline may provide actual video and audio to the Gemini Files API when credentials, limits and service are available. This path is **not** the current Groq production mode.
- Visual or audio impressions from AI are not verified mechanical measurements. VIN and model-level recalls do not verify title history or a specific VIN's open/completed recall status.

## Connected vehicle operations and data safety

The `/fleet.html` beta reads existing locally saved Garage vehicles, service plans, user-reported diagnostic cases, reseller inventory and workshop quotes. It links by saved vehicle ID or exact 17-character VIN; it does not infer ownership from similar make/model strings. Users can record fleet status, assignment and notes, export a CSV, and open the relevant tools with the vehicle already selected.

The workspace includes a one-file JSON backup from an explicit allowlist of existing local data stores. Restores validate record-group types and **never overwrite nonempty existing data groups**. Import is intentionally conservative and cannot merge individual records into an occupied group; use that tool's own import workflow when needed. Backup files may contain sensitive vehicle, customer and conversation information, so store them securely. Browser storage is **not** cloud sync.

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

Chats and vehicle records currently use browser-local storage without automatic multi-device sync or automatic cloud backups. Fleet Command offers manual JSON export and conservative empty-dataset restore. Photos and sampled video frames sent for AI review are transmitted to the selected external provider; local VIN camera OCR does not require AI. No continuous audio analysis is available on the current Groq deployment.

AI diagnostic advice is not an in-person inspection. Always verify measurements, wiring, service procedures, parts and torque values against qualified repair sources, especially with brakes, steering, fuel systems, overheating or electrical risks.

## V3 reliability and useful features (October 12, 2026)

- Eight real **offline** guided diagnostic test flows: electrical/charging, start problems, rattles, misfires, brakes, cooling, automatic transmissions, and A/C. These run even if AI credits are exhausted. Users can record actual observations, check completed tests, export TXT checklists and save a guided report.
- An **App Diagnostics** screen differentiates "key configured" from a verified successful AI response. A separate button explicitly tests real AI (may incur a small API cost); server/browser and upload-route checks are no-charge.
- Optional **VIN decoding** from the U.S. NHTSA vPIC public service, with driver verification before storing vehicle details.
- Main chat defaults to less-expensive standard mode using Gemini 3.5 Flash-Lite; deeper reasoning and external research are explicitly opt-in. Existing browser state switches to the balanced default once.
- More resilient binary video body reading for hosting runtimes that represent request bodies differently.
- Original public guide content at `/guides.html` and privacy information at `/privacy.html`, separate from the chat.
- AdSense **integration hooks only**, disabled until approval and `ADSENSE_ENABLED=true`. Details in [ADVERTISING.md](ADVERTISING.md).
- New core regression tests, plus a manually launched GitHub Actions **Verify live Ravrent Mechanic** workflow.

**Important:** A GitHub commit is not a live Vercel verification. A successful real AI/video upload must be confirmed on the deployed site. Vercel project access is currently restricted for connected deployments/logs.

## Emergency API spending controls

Set `AI_REQUESTS_ENABLED=false` in Vercel production environment variables, then redeploy, to pause paid diagnostic AI requests without disabling the offline guided troubleshooting screens. Set `VIDEO_UPLOADS_ENABLED=false` and redeploy to pause new video uploads. Remove the settings or set them to `true` to resume. These switches are a manual safety measure, **not automatic dollar caps** or distributed rate limiting.
