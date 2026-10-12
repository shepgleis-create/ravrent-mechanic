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
