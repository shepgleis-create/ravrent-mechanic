# Ravrent Mechanic — revenue activation and verification

Updated October 12, 2026. This document records shipped integration code, **not active paid products or advertising earnings**.

## Advertising: implemented, not switched on

- Existing AdSense ownership meta tag: `ca-pub-4885780170355707`.
- The root `/ads.txt` contains Google's correctly formatted authorized digital seller declaration for that publisher ID.
- Two potential AdSense units on `/guides.html`, loaded by `ads.js` only when every server-side readiness gate passes. No blank ad frames when disabled.
- No ad insertion into diagnostic chat, VIN lookup, shop estimate forms, garage, or safety warnings.
- `/privacy.html` includes an optional local guide-ad opt-out. The browser's Global Privacy Control signal is also honored for this implementation.
- This local setting is **not** a CMP and does not prove consent compliance.
- Current Vercel production environment was inspected October 12: it had `GEMINI_API_KEY` and `MECHANIC_ACCESS_CODE`, but **no AdSense configuration variables**. Advertising is disabled; publisher approval status could not be checked from the connected tools.

### Activation checklist (do not skip any gate)

1. Confirm AdSense has approved this exact site in the publisher's own dashboard and approved the ads.txt entry.
2. In AdSense, create a responsive **Display** ad unit under Ads > By ad unit, and copy its **numeric ad slot**. Never invent the number.
3. Configure a suitable Google-certified CMP / IAB TCF implementation where required for EEA, UK and Switzerland traffic, and address applicable US state laws. A hand-written consent banner does not substitute for Google certification.
4. Check Vercel hosting plan. Vercel's Hobby tier is restricted to noncommercial projects; commercial use requires an eligible commercial plan.
5. Configure the following **production** environment variables in the existing Vercel project:
   - `ADSENSE_PUBLISHER_ID=ca-pub-4885780170355707` (replace only if the approved publisher account has changed).
   - `ADSENSE_GUIDE_SLOT=<actual numeric unit ID from AdSense>`.
   - `ADSENSE_APPROVED=true` only after confirming approval.
   - `ADSENSE_CONSENT_READY=true` only after compliant consent setup has been confirmed.
   - `ADSENSE_ENABLED=true` only after all prior requirements are met.
6. Redeploy the current production branch. Confirm that `/api/ads-config` reports `enabled:true` and the **guide slot only**, and `/ads.txt` is publicly accessible at the site root.
7. Verify with an actual browser, on desktop and iPhone, that ad scripts load on guide pages only and never displace technical instructions. Real fill and earnings depend on Google's approval, inventory and traffic.

The server endpoint emits a public `state` field when disabled (`disabled`, `pending_approval`, `consent_configuration_required`, or `missing_publisher_or_slot`); the endpoint does not expose secrets.

Google official guidance:
- `https://support.google.com/adsense/answer/12171612` ads.txt
- `https://support.google.com/adsense/answer/9183549` display ad units
- `https://support.google.com/adsense/answer/13554116` consent for EEA/UK/CH
- `https://vercel.com/docs/limits/fair-use-guidelines` commercial hosting

## Shipped professional product features

`/workshop.html` — **Workshop Estimate Studio (free local beta):**
- Shop/customer details and manually managed job states.
- Itemized labor, parts and shop fees; tax applicability per row; configurable discounts, rate and deposit request.
- Internal costs and estimated pre-overhead gross margin, **excluded from customer printouts**.
- Branded printable estimate suitable for the browser Print / Save as PDF workflow.
- Local estimate pipeline, CSV summaries, JSON backup and restore.
- VIN handoff from `/vin-report.html`. No customer SMS, invoice email, payment collection or cloud sync.
- A sample quote and invalid-input regression suite runs in GitHub Actions `npm test` when workflows are available.

`/reseller.html` — vehicle inventory and acquisition/resale analysis, inspection findings, backups and printed worksheets.

These real tools can be the basis for a commercial Workshop subscription after secure storage and billing are ready; do **not** lock previously free safety guidance behind a paywall.

## Stripe / subscriptions: pending account decision and security

The Stripe connector presently exposes an account named **Tracks Auto Care LLC**, plus testing variants. That account has **not** been authorized for Ravrent Mechanic billing in this workflow; do not silently create Ravrent products or invoices in the Tracks account.

The public `/pricing.html` shows *proposed*, disabled paid tiers. No customer is charged by Ravrent. Before enabling paid checkout:
1. Confirm the correct Ravrent business / Stripe account, products and pricing with the project owner.
2. Add secure user accounts, shared account storage, usage metering and durable quota enforcement.
3. Integrate server-created Stripe Checkout; verify webhook signatures, order IDs and entitlements; handle cancel/refund/payment failures and self-service billing.
4. Run test-mode and actual live small-payment test with the approved merchant account before displaying a buy button.
5. Publish customer terms, support channels, refund and cancellation policies, required sales-tax handling and privacy disclosures.

## Status semantics

A Vercel **READY** deployment only establishes build/deploy completion, not real ad approval, bank settlement, iPhone camera recognition, or external AI success. State each independently. Never fabricate revenue totals, sponsored offers, publisher approvals or completed vehicle history records.

## October 12 stability + product development update

- Replaced App Diagnostics' oversized status cards and warning box with a compact real-connection screen. App header now opens this diagnostic screen.
- Added reason-based Google Gemini response classification: invalid/blocked Standard keys, denied projects, disabled API, restricted keys, model access, and quotas. Provider errors are reduced to safe codes and action messages; they do not echo key values or raw provider bodies.
- Verified the Vercel project has a `GEMINI_API_KEY` setting, but production Gemini still returns permission failures per user screenshot. Vercel's connection cannot disclose the key type or change Google AI project permission. Do not claim the assistant is fixed until a live generated answer succeeds.
- Important: Google began blocking unrestricted Standard API keys in June 2026 and migrated to Auth keys by September 2026. Generate a new Auth key in Google AI Studio and replace `GEMINI_API_KEY` in Vercel if the key is older or blocked. If Google says the project itself was denied access, the owner must review Google account/project access with Google.
- Reduced quick-mode conversation context and output limits, avoided resending historical media, removed unnecessary retries on authentication errors, and added client timeouts.
- `/shop-insights.html` adds real locally computed estimate pipeline, manually recorded approval-rate tracking, completed-job value (explicitly not payments), pre-overhead margins, CSV summary, and an editable labor-rate break-even planner.
- `/workshop.html` now includes five unpriced service templates and reusable custom shop templates with local storage; no fake OEM labor times or part prices.
- AdSense remains disabled because no ADSENSE environment variables are configured. The `ads.txt` and policy-gated guide placements are ready, but publisher approval and consent setup have not been established.
- Paid plans remain disabled: the connected Stripe accounts observed previously belong to Tracks Auto Care LLC. Confirm the correct Ravrent merchant account before any charge, checkout, subscription, or paid entitlement.

**Current feature value:** Free beta workshop estimates, customer printouts, custom service templates, local shop performance analytics, and reseller inventory. Future paid value should concentrate on secure account sync, team seats, customer approvals, invoice/payment status syncing, customer portals, shared fleet records, professional reporting, and bounded AI credit packs. Do not sell existing free functionality as exclusive to a paid tier without a clearly communicated transition.

**Launch verification remaining:** live Gemini success, iPhone/TikTok webview smoke test, account-safe merchant billing, signed webhooks, durable entitlements and quotas, and AdSense approval.
