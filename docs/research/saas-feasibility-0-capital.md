<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# SaaS Feasibility Report — 0 Capital Clone Assessment

**Date:** 2026-09-19
**Stack constraint:** Cloudflare Workers/Pages Free (100k req/day), Supabase Free (50k MAU, 500 MB DB, 1 GB storage, 2 GB bandwidth), Clerk Hobby (50k MRU), Stripe (test free, 1.5%+30¢ live only on revenue)
**Input:** 14 paid tools, all >10k DAU (via proxies). Prices = public entry paid tier at time of writing.
**Method:** `implement` (MVP slice, thin vertical tracer) + `codebase-design` vocabulary: each MVP framed as **Modules** behind small **Interfaces** at clean **Seams**, with **Adapters** for Supabase/Clerk/Stripe. **Depth** = leverage per interface learned. Verdicts: **GO** = niche slice feasible solo on $0; **CUT** = hard (feasible only with severe scope cut or paid infra); **NO-GO** = impossible at $0 (compliance / realtime infra / capex blockers).

---

## 1. Summary table (14 tools)

| # | Tool | Category | Entry paid price (ref) | Scale proxy (researcher input) |
|---|------|----------|------------------------|--------------------------------|
| 1 | Salesforce Sales Cloud | CRM / Sales Force Automation | ~$25–$165/u/mo (Starter → Pro) | $37.9B FY rev, ~150k customers |
| 2 | HubSpot Marketing Hub | Marketing automation / CRM | Starter ~$20/mo, Pro ~$800+/mo | 200k+ customers |
| 3 | Slack | Team chat / collaboration | Pro ~$7.25/u/mo | ~47.2M DAU (proxy) |
| 4 | Zoom Workplace | Video conferencing / UCaaS | Pro ~$14.99/u/mo | ~300M meeting participants/day (proxy) |
| 5 | Notion | Docs / wiki / PKM | Plus ~$10/u/mo | ~100M users |
| 6 | Figma | Collaborative design / whiteboard | Dev/Pro ~$12–$15/editor/mo | ~13M MAU |
| 7 | Canva | Template graphic editor | Pro ~$120/yr (~$10/mo) | ~200M MAU |
| 8 | Shopify | E-commerce storefront platform | Basic ~$39/mo | ~5–6M live sites (proxy) |
| 9 | Stripe (Payments + Billing) | Payments infrastructure | 2.9% + 30¢ (US), Billing from $0+rev-share | ~$1.4T annual volume |
| 10 | Jira | Issue tracking / Agile ALM | ~$7.75/u/mo (Standard) | ~350k orgs (Atlassian Cloud customers incl. Jira) |
| 11 | monday.com | Work OS / project tables | Basic ~$9/u/mo (3-seat min) | ~250k customers |
| 12 | Zendesk Suite | Support ticketing / helpdesk | Suite Team ~$55/agent/mo | ~100k accounts |
| 13 | Intercom | Conversational support / live chat + AI | Essential ~$39/seat/mo + AI $0.99/resolution | ~10k+ businesses |
| 14 | GitHub Enterprise | Source hosting + CI/CD | Team ~$4/u/mo, Enterprise ~$21/u/mo | ~180M developers (registered) |

> Prices are directional; packaging changes frequently. Scale proxies are researcher-supplied, not audited.

---

## 2. Per-tool deep dive

Framing note (codebase-design): every MVP below is scoped as **one deep Module per capability** (e.g., `TicketModule`, `BoardModule`) exposing a **small Interface** (3–6 ops) at an explicit **Seam**. Supabase Postgres + Auth, Clerk, and Cloudflare bindings sit behind **Adapters** so the $0 path can be swapped for paid infra later without rewriting callers. **Leverage** = one implementation serves N tenants; **Locality** = billing/storage/quotas live in one module, not scattered.

### 1. Salesforce (CRM) — Verdict: GO (niche-slice clone)

- **Rebuild scope (MVP tracer):**
  - `ContactModule` — Interface: `createContact, searchContacts, mergeDuplicates`. CRUD + dedupe view.
  - `PipelineModule` — Interface: `createDeal, moveStage, dealValue(analytics)`. Kanban with 4–5 stages.
  - `ActivityModule` — Interface: `logCall/logEmail, listTimeline(contactId)`. Append-only log.
  - Out of scope: workflow automation engine, territory management, Einstein AI, AppExchange, offline mobile, CPQ.
- **Solo build time:** 6–10 weeks (auth + multi-tenant + kanban + import CSV). Deep modules keep it tractable; shallow trap = one form per object (avoid — generic `RecordModule` + schema-per-tenant instead).
- **Infra $0 path:** CF Pages (marketing + app) + Workers (API, 100k req/day) + Supabase (RLS per `org_id`, 500 MB holds ~200–500k contacts) + Clerk (orgs + roles) + Stripe test for paid upgrades.
- **When free tier breaks:** >100k API req/day (~1k active salespeople polling); >500 MB DB (activity timeline bloat); Supabase Auth >50k MAU; CSV imports > Workers 10 ms CPU / 6 concurrent builds. First paid jump: Supabase Pro $25/mo + Workers Paid $5/mo.
- **Hard blockers:** Enterprise sales motion (SOC 2, SSO/SAML, data residency, 99.99% SLA) — cannot win Salesforce head-on at $0. AI lead-scoring costs (embeddings + inference) not fundable pre-revenue. No compliance blocker for a niche CRM itself.
- **Lean niche alternative (GO):** Vertical micro-CRM — e.g., CRM for freelance videographers / tattoo studios / immigration consultants: contacts + pipeline + SMS reminders via one provider adapter. Charge $19–$29/mo; sell on simplicity + import-from-spreadsheet, not feature parity.

### 2. HubSpot Marketing Hub (marketing automation) — Verdict: GO (niche-slice clone)

- **Rebuild scope (MVP):**
  - `ContactListModule` — Interface: `addContact, segment(filter), unsubscribe`. Single list + tags, not full CDP.
  - `CampaignModule` — Interface: `createEmail, sendBatch, trackOpen/click`. One drip sequence (3 emails), Resend/SES adapter.
  - `FormModule` — Interface: `embedForm, captureLead`. Embeddable <iframe> snippet.
  - Out of scope: multi-touch attribution, A/B engine, ad-network sync, deliverability IP pools, AI content writer.
- **Solo build time:** 5–8 weeks. Email editor = Markdown + 3 templates (do NOT rebuild drag-drop builder — shallow-module trap).
- **Infra $0 path:** Workers (send queue + webhooks) + Supabase (contacts, events) + Resend free (3k emails/mo) or SES sandbox. 100k req/day covers tracking pixels to ~30k opens/day.
- **When free tier breaks:** Email volume (>3k/mo → Resend $20/mo); tracking events flood Workers subrequests; Supabase 500 MB fills with event rows (~1M events). Must add event rollup/retention job early (locality: one `AnalyticsRollupModule`).
- **Hard blockers:** Deliverability reputation (dedicated IPs cost $), CAN-SPAM/GDPR consent infra, spam-filter wars. Enterprise attribution needs warehouse-scale data — out of scope.
- **Lean niche alternative (GO):** Newsletter + lead-capture kit for one niche (e.g., coaches, realtors): landing form + 3-email welcome drip + open dashboard. $15/mo. Wedge = done-for-you templates, not platform breadth.

### 3. Slack (team chat) — Verdict: CUT (hard — niche async slice only)

- **Rebuild scope (MVP slice):**
  - `ChannelModule` — Interface: `post, listHistory, react`. Text + emoji only; no threads Huddles canvas.
  - `PresenceModule` — Interface: `setStatus, listOnline`. Heartbeat-based, not true presence.
  - `SearchModule` — Interface: `search(keyword, channel)`. Postgres FTS, last 10k messages only.
  - Out of scope: Huddles/Clips, Workflow Builder, Enterprise Grid, 99.99% uptime, compliance exports, 100+ integrations.
- **Solo build time:** 6–9 weeks for async slice; full Slack parity = 12+ months + team.
- **Infra $0 path:** Supabase Realtime (Postgres changes → websocket) + Workers for REST. OK for <50 concurrent users/workspace.
- **When free tier breaks:** Fast. Supabase Realtime concurrent connections (~200 free) and 100k req/day polling kill you at ~10 active teams. Message history bloats 500 MB in weeks with files. Files/voice need R2 (free 10 GB but egress rules) + paid TURN. True $0 Slack at Slack-scale is impossible.
- **Hard blockers:** **Network effects** (nobody switches chat alone) + **realtime infra cost** (websocket fan-out, presence, push). Mobile push (FCM/APNs) + offline sync is a second app. Enterprise eDiscovery/HIPAA out of reach.
- **Lean niche alternative (CUT → narrow GO):** Async standup / shift-handoff chat for frontline teams (e.g., dental clinics, food trucks): one channel per location, daily prompt bot, no DMs. Sell as " pager + logbook," not Slack replacement. Cap history to 30 days to stay on free tier.

### 4. Zoom (video conferencing) — Verdict: NO-GO (impossible at $0)

- **Rebuild scope (MVP — even minimal):**
  - `RoomModule` — Interface: `createRoom, join(token), leave`. Needs SFU for >2 people.
  - `MediaModule` — Interface: `publish(track), subscribe(peer)`. WebRTC P2P works 1:1 only.
  - `RecordingModule` — Interface: `startRec, fetchPlayback`. Requires storage + transcoding.
  - Out of scope: PSTN dial-in, waiting rooms at scale, breakout rooms, virtual backgrounds (GPU), webinar 10k viewers, E2EE at scale.
- **Solo build time:** 8–12 weeks for unreliable 1:1 P2P demo; production group call = 6–12 months + media engineer.
- **Infra $0 path:** None viable. Cloudflare Calls / LiveKit / Daily all meter per minute/GB — free credits evaporate with one active team. Workers cannot relay media. Supabase cannot help. P2P mesh collapses at 4+ participants (client CPU/bandwidth).
- **When free tier breaks:** Immediately — ~1,000 group-call minutes/mo exceeds every free media tier. TURN relay (needed for ~20% of corporate NATs) is pure egress cost. Recording storage + transcoding is unbounded.
- **Hard blockers:** **Realtime media infra capex** + global PoP latency + compliance (HIPAA/BAA, E2EE, telecom regulation for dial-in). Support burden (audio debugging) needs a team.
- **Lean niche alternative (pivot, not clone):** Async video messages (Loom-slice): record via MediaRecorder → upload to R2 → share link + comments. `ClipModule` is a deep, cheap module (one upload interface, all transcoding deferred to browser). That pivot is GO; Zoom-clone is NO-GO.

### 5. Notion (docs/wiki) — Verdict: GO (top-3 feasible)

- **Rebuild scope (MVP):**
  - `PageModule` — Interface: `createPage, getTree, movePage`. Nested pages, no databases v1.
  - `BlockEditorModule` — Interface: `applyOps(pageId, ops), getSnapshot`. TipTap/BlockNote adapter; JSONB in Postgres. Yjs only for 2-player (defer).
  - `ShareModule` — Interface: `shareLink, setPermission`. Public link + workspace roles via Clerk.
  - Out of scope: databases/relations, Notion AI, offline-first, 100-block/second collab, API ecosystem.
- **Solo build time:** 4–6 weeks (fastest on this list). Editor libs do the heavy lifting; depth comes from `BlockEditorModule` hiding OT/serialization.
- **Infra $0 path:** Ideal $0 fit. Pages static (text = tiny), Workers cache reads, Supabase 500 MB holds ~250k pages of Markdown. 100k req/day ≈ 30k page views/day. Clerk covers 50k users.
- **When free tier breaks:** Image/file embeds (1 GB storage cap → R2 $0-to-cheap); realtime collab >10 concurrent editors (need Yjs host / Liveblocks paid); full-text search over millions of blocks (need pg_trgm + pagination, then paid).
- **Hard blockers:** Low. No compliance moat for prosumer wiki. Risk = performance polish + offline sync, not cost. AI features are optional paid add-on (pass-through cost).
- **Lean niche alternative (GO):** Team handbook / SOP wiki for one vertical (e.g., agencies, clinics): templates + checklists + public KB publishing. $12/mo/workspace. Wedge = 20 prebuilt SOP templates + import-from-Notion.

### 6. Figma (collaborative design) — Verdict: CUT (hard — single-player slice only)

- **Rebuild scope (MVP slice):**
  - `CanvasModule` — Interface: `addShape, move, exportSVG/PNG`. tldraw or Excalidraw adapter — do NOT hand-roll canvas engine.
  - `FileModule` — Interface: `save, fork, versionList`. JSON snapshot per save.
  - `CommentModule` — Interface: `pinComment, resolve`. Async only; no live cursors v1.
  - Out of scope: multiplayer cursors/CRDT at 60fps, vector networks, Dev Mode, branching, font rendering pipeline, plugin runtime.
- **Solo build time:** 5–8 weeks for single-player whiteboard/diagrammer on tldraw; true Figma parity = years + graphics team.
- **Infra $0 path:** CF Pages hosts canvas (client-heavy = cheap); Supabase stores JSON docs. Reads are CDN-cacheable.
- **When free tier breaks:** File JSON bloat (500 MB fast with large canvases); live presence needs dedicated websocket infra (Liveblocks/partykit paid); font/asset CDN egress.
- **Hard blockers:** **Realtime collab engine** (CRDT + rendering perf in WASM) + browser rendering expertise. Two-player is doable; Figma-scale multiplayer is not solo-$0.
- **Lean niche alternative (CUT → narrow GO):** Niche diagrammer — e.g., flowchart-to-SOP for ops managers, seating charts for venues, floor plans for gyms. Single-player + async share link + PNG export. $10–$15/mo. Never promise multiplayer.

### 7. Canva (template editor) — Verdict: CUT (hard — generator slice only)

- **Rebuild scope (MVP slice):**
  - `TemplateModule` — Interface: `listTemplates(niche), instantiate(vars)`. 20–50 hardcoded templates, not infinite library.
  - `RenderModule` — Interface: `renderImage(templateId, text)`. Satori/Resvg on Workers or client-side Canvas — no full editor v1.
  - `ExportModule` — Interface: `exportPNG/PDF`. Client-side download.
  - Out of scope: drag-drop editor parity, background remover (GPU/AI $), stock library licensing, Brand Kit, print fulfillment.
- **Solo build time:** 4–7 weeks for generator; full editor = 9+ months.
- **Infra $0 path:** Templates as static JSON + fonts on Pages (cacheable = cheap). Render on client to avoid Worker CPU limits.
- **When free tier breaks:** Asset storage (1 GB Supabase cap — stock photos kill it; must hotlink Unsplash/Pexels or R2); AI features (background remove, Magic Resize = per-image GPU $); PDF export CPU exceeds Workers free 10 ms.
- **Hard blockers:** **Asset licensing costs** + **AI/GPU inference costs** + storage/egress for media-heavy product. Copyright liability for scraped templates.
- **Lean niche alternative (CUT → narrow GO):** One-job image generator — e.g., Etsy mockup maker, LinkedIn carousel maker, restaurant menu QR cards. Form → preview → download. $9/mo. No free-form canvas.

### 8. Shopify (storefront platform) — Verdict: GO (niche storefront slice)

- **Rebuild scope (MVP):**
  - `CatalogModule` — Interface: `addProduct, listProducts, updateInventory`. <100 SKUs, 5 images each.
  - `CheckoutModule` — Interface: `createCart, checkout(stripeSession), webhookFulfilled`. Stripe Checkout/Payment Links adapter — never touch card PANs.
  - `StorefrontModule` — Interface: `renderStore(slug)`. CF Pages + ISR per store (one codebase, N static renders = leverage).
  - Out of scope: App Store, POS, multi-currency payouts, fraud ML, checkout extensibility, 99.99% BFCM scale.
- **Solo build time:** 5–8 weeks (Stripe Checkout removes 80% of payments work; seam discipline pays off here).
- **Infra $0 path:** Excellent $0 fit. Storefronts are static (CDN free), Workers handle cart webhooks (<100k/day ≈ 3k orders/day), Supabase holds catalogs (500 MB ≈ 10k products), Clerk for merchant auth. Payments cost only on revenue (Stripe fee, not infra).
- **When free tier breaks:** Image bandwidth (move to R2/Cloudinary free tier); >100k req/day flash sales; Supabase rows with order history (archive to R2 as Parquet/CSV). Multi-tenant noisy-neighbor needs row-level isolation review.
- **Hard blockers:** Trust/fraud/chargebacks ops + sales motion (app ecosystem is the moat, not storefront CRUD). No hard technical blocker for single-merchant slice.
- **Lean niche alternative (GO):** One-vertical storefront kit — e.g., bookings + deposits for tattoo artists, digital downloads for Notion-template sellers, farm-box subscriptions. $19/mo + 1% fee. Wedge = niche theme + niche fulfillment flow.

### 9. Stripe (payments infra) — Verdict: NO-GO (impossible at $0)

- **Rebuild scope (MVP — even ledger-only):**
  - `LedgerModule` — Interface: `charge, refund, payout`. Double-entry ledger in Postgres.
  - `OnboardingModule` — Interface: `kycVendor, verify`. Requires licensed KYC vendor ($1+/check).
  - `FraudModule` — Interface: `score(txn)`. ML + rules + dispute pipeline.
  - Out of scope (i.e., the actual product): card network acquiring, money transmission, PCI L1, 3DS, global payouts, Radar, Sigma.
- **Solo build time:** Ledger demo 3–4 weeks; real payments company = years + legal + banking partnerships. Not a build-time problem — a license problem.
- **Infra $0 path:** None. Money movement cannot ride free tiers: KYC/AML per-check fees, PCI audit ($50k+), bank reserves, dispute losses. Workers/Supabase are irrelevant to the cost stack.
- **When free tier breaks:** N/A — breaks at first real dollar (regulatory, not infra).
- **Hard blockers:** **Compliance/licensing wall**: PCI-DSS L1, money-transmitter licenses (US state-by-state), EMI license (EU), card-network sponsorship, SAR/AML reporting, sanctions screening. Fraud losses + chargeback liability require capital reserves. Impossible solo with $0 by design.
- **Lean niche alternative (pivot, not clone):** Stripe **wrapper**, not Stripe replacement — invoicing + dunning + payment-links dashboard for freelancers on top of Stripe Connect (you never touch funds; Stripe is the adapter behind your `BillingModule` seam). That wrapper is GO at $15/mo.

### 10. Jira (issue tracking) — Verdict: GO (top-3 feasible)

- **Rebuild scope (MVP):**
  - `IssueModule` — Interface: `create, transition(status), assign, comment`. Status machine + 4 issue types.
  - `BoardModule` — Interface: `renderBoard(filter), reorder`. Drag-drop kanban (dnd-kit adapter).
  - `SprintModule` — Interface: `startSprint, burndown`. Minimal velocity chart (SVG, no BI lib).
  - Out of scope: JQL engine, Advanced Roadmaps, 10k-issue boards virtualization, Forge apps, ITSM, data residency.
- **Solo build time:** 4–6 weeks (fastest alongside Notion-slice). CRUD + state machine = deep module with tiny interface; maximum leverage.
- **Infra $0 path:** Perfect $0 fit. Text-only rows (500 MB ≈ 1M issues), 100k req/day ≈ 10k daily actives polling board, Realtime optional (poll 5s v1 to save connections). Clerk teams + RLS.
- **When free tier breaks:** Attachment storage (cap uploads 5 MB, push to R2 early); search over millions of issues (add pg FTS index, then paid); audit-log retention.
- **Hard blockers:** None technical. Moat = Atlassian ecosystem + enterprise admin (permissions schemes, SAML, audit). Avoid competing on admin depth.
- **Lean niche alternative (GO):** Bug-tracker for one non-software niche — e.g., punch-list tracker for contractors, content pipeline for YouTubers, maintenance tickets for property managers. $10/u/mo. Wedge = niche vocabulary + mobile photo upload, not JQL.

### 11. monday.com (work OS / tables) — Verdict: GO (feasible tables slice)

- **Rebuild scope (MVP):**
  - `TableModule` — Interface: `defineColumns, setCell, filterSort`. 6 column types (text/status/date/person/number/file-link), not 30+.
  - `ViewModule` — Interface: `asKanban/asCalendar(rowSet)`. Two derived views from one table source (leverage: one implementation, N views).
  - `AutomationModule` — Interface: `on(trigger, action)`. 3 recipes only ("when status→notify", "when date→move").
  - Out of scope: 200+ automations, WorkDocs, sales CRM depth, dashboards with 50 widgets, enterprise governance.
- **Solo build time:** 6–9 weeks (column-type system is the only tricky module; keep interface small).
- **Infra $0 path:** Good $0 fit. Tables = narrow Postgres rows; 500 MB ≈ 500k–1M rows. Workers handle automation webhooks within 100k/day if debounced.
- **When free tier breaks:** Automation fan-out (one status change → N webhooks = subrequest storm); file columns (storage cap); large boards (>5k rows render — need virtualization + pagination).
- **Hard blockers:** Breadth moat (every team wants one more column type / integration). No compliance or realtime wall for core tables.
- **Lean niche alternative (GO):** Opinionated tracker for one workflow — e.g., applicant tracker for small recruiters, vendor tracker for wedding planners, inventory-lite for food trucks. Prebuilt columns + 3 automations. $12/u/mo. Sell template, not platform.

### 12. Zendesk (support ticketing) — Verdict: GO (top-3 feasible)

- **Rebuild scope (MVP):**
  - `TicketModule` — Interface: `intake(channel), assign, reply, close`. Email-to-ticket via inbound parse adapter + shared inbox UI.
  - `KBModule` — Interface: `publishArticle, suggest(ticketText)`. Keyword-suggest (pg FTS), no AI v1.
  - `SLAModule` — Interface: `setPolicy, breachList`. One timer + breach view.
  - Out of scope: omnichannel (voice/SMS/social in one timeline), Explore analytics, workforce management, AI triage, enterprise routing (skills-based, 1000 rules).
- **Solo build time:** 5–7 weeks. Email adapter + ticket state machine = two deep modules; everything else is views.
- **Infra $0 path:** Great $0 fit. Tickets are text (500 MB ≈ 500k tickets), inbound email via Resend/Cloudflare Email Routing free, Workers process webhooks well under 100k/day for small teams.
- **When free tier breaks:** Attachment storage; inbound email volume (>3k/mo on free mail tiers); search + reporting over years of tickets; HIPAA/BAA or data-residency asks (enterprise cut-off).
- **Hard blockers:** Channel breadth + voice infra (same TURN/SIP costs as Zoom-slice) if you chase omnichannel. Stay email + widget-only and there is no hard wall.
- **Lean niche alternative (GO):** Shared inbox + micro-KB for one vertical (e.g., Shopify micro-brands, clinics, property managers): email → ticket, canned replies, 10-article help center on your domain. $19/agent/mo. Wedge = 1-hour setup + import-from-Gmail.

### 13. Intercom (live-chat + AI inbox) — Verdict: GO (rule-based slice; AI tier is CUT)

- **Rebuild scope (MVP — no-AI slice):**
  - `WidgetModule` — Interface: `boot(user), sendMessage, typing`. <10 KB snippet, Supabase Realtime for 1:1 threads (not broadcast — cheap).
  - `InboxModule` — Interface: `assignConversation, reply, snooze`. Single shared queue.
  - `BotModule` — Interface: `matchRule → reply/route`. Decision-tree (5 nodes), not LLM.
  - Out of scope (v1): Fin AI ($0.99/resolution passthrough kills $0), proactive campaigns at scale, mobile SDKs, 99.99% chat uptime.
- **Solo build time:** 5–8 weeks for rule-based slice; +2 weeks to add optional BYO-key AI toggle (customer pays OpenAI directly).
- **Infra $0 path:** 1:1 threads scale linearly (unlike Slack broadcast) — Supabase Realtime viable to ~100 concurrent chats. Widget static on CDN. 100k req/day ≈ 20k messages/day.
- **When free tier breaks:** Concurrent Realtime connections (>200); AI resolution costs (even $0.02/msg × 10k msgs = $200/mo — must pass through or gate); chat history retention (trim to 90 days).
- **Hard blockers:** **AI inference cost** if you bundle AI (do not — make it BYO-key or per-resolution add-on). Push-notification reliability + mobile SDKs are team-scale work; defer.
- **Lean niche alternative (GO):** Niche concierge chat — e.g., appointment-booking chat for salons/clinics, order-status chat for micro-brands. Rule bot answers 5 FAQs + hands to human inbox. $25/mo/site. Upsell AI only as metered add-on.

### 14. GitHub (code hosting + CI) — Verdict: NO-GO (impossible at $0)

- **Rebuild scope (MVP — even code-only, no CI):**
  - `RepoModule` — Interface: `push, pull, listCommits`. Requires git server (not Postgres blobs) + ssh/http smart protocol.
  - `PRModule` — Interface: `openPR, review, merge`. Diff engine + merge-conflict resolution.
  - `ActionsModule` — Interface: `onPush → run`. Needs isolated compute runners (the expensive part).
  - Out of scope (i.e., most of GitHub): Codespaces, Advanced Security, code search at scale, Packages, 99.95% torture-tested availability.
- **Solo build time:** Repo+PR demo 8–12 weeks (gitea/soft-serve adapter could shortcut); production-grade hosting + CI = team + years.
- **Infra $0 path:** None viable. Git objects need object storage + bandwidth (Supabase 1 GB/2 GB caps die on first `node_modules`-adjacent push). CI minutes are pure compute cost (GitHub itself meters them). Workers 10 ms CPU cannot run builds.
- **When free tier breaks:** First binary-heavy repo; first CI run; first abuse wave (crypto miners — the reason every CI product has abuse teams).
- **Hard blockers:** **Compute/storage capex** (CI runners, Codespaces) + **trust/abuse** (malware hosting, miner abuse, secret scanning liability) + **availability bar** (devs leave after one outage). SOC 2 + SAML needed for paid seats.
- **Lean niche alternative (pivot, not clone):** Snippet / boilerplate manager for a niche stack (e.g., Cloudflare Workers recipes, Supabase RLS cookbook): `SnippetModule` (`save, search, fork`) on Supabase FTS + Pages. Team pastebin with versioning, no git protocol, no CI. That is GO at $10/mo; GitHub-clone is NO-GO.

---

## 3. Overall ranking

### Top 3 most feasible as $0 micro-SaaS (build these)

| Rank | Pick | Why it wins on $0 | Niche wedge | Price anchor |
|------|------|-------------------|-------------|--------------|
| **1** | **Jira-slice (issue tracker)** | Text-only rows, tiny interface (`create/transition/comment`), no media/AI/compliance wall; 500 MB ≈ 1M issues; realtime optional (poll). Max depth/leverage: one `IssueModule` serves every niche. | Punch-list tracker for contractors / maintenance tickets for property managers / content pipeline for creators | $10/u/mo |
| **2** | **Zendesk-slice (shared inbox + micro-KB)** | Same text economics + free email ingestion; one `TicketModule` + FTS `KBModule` covers 80% of small-team need. Attachments capped, omnichannel deferred. | Shared inbox for micro-brands / clinics with canned replies + 10-article help center | $19/agent/mo |
| **3** | **Notion-slice (docs/wiki)** | Static-text CDN economics; editor libs (TipTap/BlockNote) supply depth for free; no realtime v1. Fastest solo build (4–6 wks). | SOP handbook for agencies/clinics with templates + public KB | $12/mo/workspace |

Honorable mention: Shopify-slice (static storefronts + Stripe Checkout adapter) and Intercom rule-based slice are close #4/#5 — both GO, slightly more infra edge-case surface (images / concurrent sockets).

### Bottom 3 impossible at $0 (do not clone)

| Rank | Pick | Why it fails | What breaks first |
|------|------|--------------|-------------------|
| **1 (worst)** | **Stripe (payments infra)** | Licensing wall, not a code problem: PCI L1, money-transmitter licenses, bank sponsorship, fraud reserves. No free-tier path past first real dollar. | Regulation at $1 of volume |
| **2** | **Zoom (video conferencing)** | Media infra capex: SFU minutes, TURN egress, global latency, recording/transcode. Workers/Supabase cannot relay media; free media credits die in days. | ~1k group-call minutes |
| **3** | **GitHub (code hosting + CI)** | Compute/storage capex + abuse: runners, object bandwidth, miner/malware abuse teams, availability bar. Free storage/compute caps die on first real repo + first CI run. | First binary repo / first CI minute |

### Full verdict ledger

| Tool | Verdict | One-line rationale |
|------|---------|--------------------|
| Salesforce | GO | Niche CRM slice is pure CRUD + kanban; moat is sales motion, not tech |
| HubSpot | GO | Single-list + drip slice viable; deliverability caps scope, not feasibility |
| Slack | CUT | Broadcast realtime + network effects; only async niche slice survives |
| Zoom | NO-GO | Media relay capex; no $0 path |
| Notion | GO | Text + editor-lib economics; top-3 pick |
| Figma | CUT | Canvas engine + multiplayer needs team; single-player niche only |
| Canva | CUT | Asset licensing + GPU/AI + storage; generator-slice only |
| Shopify | GO | Static storefront + Stripe adapter; trivially $0 until images/scale |
| Stripe | NO-GO | Licenses + reserves; impossible solo-$0 |
| Jira | GO | Text CRUD + state machine; top-3 pick |
| monday.com | GO | Tables slice viable; breadth is moat, defer it |
| Zendesk | GO | Email-to-ticket + FTS KB; top-3 pick |
| Intercom | GO (no-AI) | 1:1 threads cheap; bundle no AI or BYO-key |
| GitHub | NO-GO | Runners + storage + abuse; impossible solo-$0 |

**Score: 8× GO (7 full + Intercom conditional), 3× CUT, 3× NO-GO.**

---

## 4. Cross-cutting $0 survival rules (all clones)

1. **Text first, media deferred.** Every GO pick is text-dominant. Cap uploads (5 MB), push binaries to R2 on day one, expire history (30–90 days) — keeps Supabase 500 MB / 1 GB alive.
2. **One Adapter per paid seam.** Email (Resend), payments (Stripe Checkout/Connect), auth (Clerk) each sit behind a single-module interface so free→paid swaps are local, not rewrites.
3. **Poll before Realtime.** Supabase Realtime free caps (~200 concurrent) kill Slack-like broadcast. Ship 5s polling, add sockets only for 1:1 (Intercom-slice) where fan-out is linear.
4. **AI as passthrough or not at all.** Never bundle $0.99/resolution or per-image GPU in base price. Rule-based v1; optional BYO-key toggle where the customer pays inference.
5. **Sell template, not platform.** Each GO verdict depends on a niche wedge (contractors, clinics, creators) — depth in one workflow beats shallow parity across all of Salesforce/Jira/Notion.

*End of report — builder subagent, files owned: this file only. No commit per instructions.*
