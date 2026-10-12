# Advertising and AI cost plan — Ravrent Mechanic

Updated October 12, 2026.

## What is implemented

- Original, public automotive articles at \`/guides.html\` with separate dark responsive layout.
- Honest privacy notice at \`/privacy.html\`, linking to the third-party AI disclosure.
- An AdSense script loader used **only** on eligible public guides.
- \`/api/ads-config\` loads configuration from server environment variables. Ads are **OFF by default** and do not display until explicit opt-in.
- The AI diagnostic chat and personal vehicle histories never load the AdSense script.

### Enable advertisements after approval

1. Finish end-to-end chat, photo and video reliability testing before submitting a site.
2. Obtain an eligible commercial Vercel hosting plan: Vercel Hobby restricts advertisements and other commercial use. Vercel Pro currently starts at $20/month (check live pricing).
3. Consider a branded custom domain, publish quality public articles, implement proper support contact and compliant consent management.
4. Create a publisher account at https://adsense.google.com/ and add your live site. Follow Google's instructions to verify ownership and get site approval. Approval is not guaranteed.
5. Google's exact AdSense code may need to be inserted into the HTML head during site verification. Do not invent a publisher ID. Google typically requires site review before showing live ads.
6. In Vercel's ravrent-mechanic project environment variables, set:
   - \`ADSENSE_PUBLISHER_ID\` = your **public** publisher ID, format \`ca-pub-1234567890123456\`.
   - \`ADSENSE_ENABLED\` = \`true\` only AFTER site approval, ads policy review, and required consent management setup.
7. Enable Auto ads for this site in the AdSense interface or add your approved ad units to article pages only.
8. If Google requires an ads.txt entry, create the exact entry Google issues for your publisher ID. Never publish a made-up entry.
9. Redeploy production and verify ads on the public guide pages, not the chat screen.

Publisher ID is public, **not** an API secret, but must be verified before enabling. Never place \`GEMINI_API_KEY\` or billing credentials in the frontend.

## Traffic economics

The publisher's actual page RPM varies widely with geography, topic, devices, seasonality, consent and demand. Use **$2 or $5 RPM** ONLY as test scenarios, not promised rates.

Estimated display revenue = Eligible monetized article pageviews / 1000 × Actual RPM.

Examples:

| Monthly monetized article pageviews | $2 RPM scenario | $5 RPM scenario |
| ---: | ---: | ---: |
| 10,000 | $20 | $50 |
| 50,000 | $100 | $250 |
| 100,000 | $200 | $500 |

Example Gemini 3.8 Flash paid API rates through December 2026: $0.75 per million input tokens, $3.75 per million output and thinking tokens. At **2,000 input + 1,000 output/thinking** tokens, one response costs about $0.00525 (less than a cent), excluding grounding, photos, video, long chat history and any other services. 10,000 similar responses cost about $52.50.

The paid-model pricing for Gemini 3.8 Flash doubles starting January 2027 under current published rates. Standard questions now default to Gemini 3.5 Flash-Lite to avoid the highest-cost model on every prompt. The UI also offers deeper reasoning and optional source research.

For paid Gemini 3.x Search grounding, Google currently publishes a shared 5,000 free search queries per month allowance, then $14 per 1,000 search requests (check quota and pricing at https://ai.google.dev/gemini-api/docs/pricing). Each prompt may generate multiple queries. Free-tier grounding availability differs by model.

Operational costs may include a commercial hosting subscription, domain, database, storage for uploads, email/SMS, authentication, customer support and taxes.

## Launch blockers

- Public AI and video uploads currently require per-account quotas, durable distributed rate limiting, abuse protection and a hard budget/circuit breaker; current per-instance IP rate limits alone **do not** prevent costs.
- Consent management for visitors in the EEA, UK and Switzerland and relevant US states may be required; use Google's approved CMP or a suitable compliant provider.
- Never ask anyone to click ads or place ads next to buttons that encourage accidental clicks. Keep ads separate from private diagnostic chat.
- AdSense does not pay immediately: for USD payments Google normally applies a $100 payout threshold.
- Publisher approval, RPM and reach cannot be promised.

Source references:
- https://ai.google.dev/gemini-api/docs/pricing
- https://vercel.com/docs/limits/fair-use-guidelines
- https://support.google.com/adsense/answer/48182
- https://support.google.com/adsense/answer/7584263
- https://support.google.com/adsense/answer/7670013
- https://support.google.com/adsense/answer/1709871
