# Ravrent Mechanic monetization and product roadmap

Last updated: October 12, 2026. This is an implementation backlog, not a claim that listed features work.

## Implemented this update
- Responsive public `/pricing.html` with transparent Free, Plus and Workshop proposed tiers.
- Main navigation to plans and the automotive learning center.
- No fake checkout, no billing credentials, no subscriptions collected.
- AdSense verification remains in place. Advertising is not activated until review approval, compliant consent setup, and appropriate commercial hosting.

## Next engineering priorities, in order
1. **Reliability and observability:** live production smoke tests, real iOS video upload, AI model availability and quota failures, server error IDs, meaningful empty/error states.
2. **Identity and storage:** secure user accounts, cross-device garage and history, deletion/export, access control; migrate browser data without losing saved histories.
3. **Cost metering:** record provider tokens, search queries and media usage by account; enforce daily limits using a durable shared datastore, not an in-memory Map.
4. **Server spending controls:** shared quota counter, monthly hard stop with alerts, timeouts, abuse protection, no provider key exposed in browser.
5. **Free plan:** offline tests always available, small daily AI allowance, optional rewarded additional access only where policy-compliant; no deceptive ad interactions.
6. **Plus plan:** higher diagnostic quota, deep research and bounded video analysis; show quota usage and reset date.
7. **Workshop:** verified role-based accounts, multiple customers with consent, professional report exports, shared inspection templates, audit history.
8. **Billing:** server-created Stripe Checkout and verified webhooks, customer portal, entitlement syncing, payment failures and cancellations, taxes where applicable. Do not activate pricing until fully tested.
9. **Public content:** additional original, helpful automotive troubleshooting guides with sources, clean SEO, no fabricated repair specifications, suitable ad placement after approval.
10. **Partner monetization:** clearly labeled affiliate parts links or shop referrals, disclose relationships and separate paid placements from diagnostic rankings. No invented product availability or prices.

## Financial model
Use scenario inputs rather than promises:
- Display ads: revenue = eligible pageviews × actual page RPM / 1000.
- Plus: gross subscription revenue = active paying users × $4.99; deduct processing, taxes, refunds, support and AI costs.
- Workshop: gross subscription revenue = active paying customers × $14.99, same deductions.
- Cost per AI reply depends on actual model, input tokens, output/thinking tokens, search grounding and media.
- Commercial Vercel plan may be needed before ads or subscriptions.
- AdSense review is pending, not approved.

## Launch gates
Do not claim 'working video analysis' until a real video uploads, reaches ready state and receives an actual useful model answer on the live site.
Do not claim subscriptions exist until checkout, webhook, entitlement, cancellation and refund handling are tested end-to-end.
Do not activate public advertising until approval and policy review.

## Nine additional revenue paths — October 12, 2026

All are proposals; no checkout, marketplace or partner integrations are active.

| Channel | Model | Important launch requirement |
| --- | --- | --- |
| One-time advanced diagnosis credits | Prepaid packs | Account-based balance, metering, refund and expiration disclosures |
| Professional reports | Pay per formatted report | Verified report generation and clear non-certification language |
| Repair-shop referrals | Disclosed lead or completed-booking commission | Verified shops, customer consent, transparent ranking |
| Parts affiliate sales | Disclosed affiliate commission | Accurate vehicle fitment, non-affiliate alternatives |
| Fleet management | Monthly per fleet or vehicle | Secure multi-vehicle dashboard, role permissions |
| Workshop team seats | Per technician seat | Multi-tenant account security, access logs |
| Automotive training | Course or bundle purchase | Original content and appropriate safety review |
| Pre-purchase inspection kits | One-time checklist/report purchase | Explicitly not a substitute for in-person inspection |
| B2B workflow API | Metered usage | Strong auth, quotas, customer contracts and privacy safeguards |

The live `/pricing.html` page contains an interactive gross-revenue scenario calculator; it performs local arithmetic only and collects no payment or personal data.

### Priority and guardrails
1. Complete live diagnostic/video reliability testing.
2. Build accounts, durable metering, AI usage ceilings and provider spend alerts.
3. Launch optional one-time credits **before** more expensive unlimited subscription promises.
4. Add paid plans with Stripe Checkout and verified webhook entitlements.
5. Expand original free guide content for ad revenue only after AdSense approval.
6. Add disclosed affiliate links and optional referral marketplace after accurate fitment and independent recommendations.
7. Pilot B2B tools only after secure multi-tenant storage.

Never gate emergency vehicle safety guidance behind a paywall, imply an AI diagnosis is a certified inspection, sell personal vehicle histories, or alter diagnosis ranking based on commissions.
