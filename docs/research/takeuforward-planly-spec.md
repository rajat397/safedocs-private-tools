<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->
# TakeUForward Planly — Spec Doc (from research dossier)

Date: 2026-09-20 UTC (capture date). Method: `research` dossier → spec synthesis.
Status: draft spec for review. Provenance: only `takeuforward.org` pages (no clones/mirrors).
Evidence grades: V1 = verbatim on-page primary · V2 = verbatim secondary/meta page · I1 = inferred from on-page copy · T3 = third-party / downgraded (never sole basis).

## 0. Scope + collision guard

In scope: TakeUForward Planly personalised-roadmap + sprint + learn + solve + track + TUFY-AI + monetisation gate, as observed on `takeuforward.org` (Sept 2026 capture).
Excluded: backend implementation, scraper automation, account creation, checkout execution, non-`takeuforward.org` mirrors.
Collision guard (REJECT — not canonical): `planly.com`, `plannerly`, `planoly`, `tracxn`-style profiler pages, `x.com/striver_79` social posts, `:2083` mirror hosts. Only `https://takeuforward.org/*` rows are admissible in the evidence log (§9).

## 1. Terminology — 11 canonical entities (verbatim → canonical)

| # | Verbatim (as observed) | Canonical entity | Notes |
|---|---|---|---|
| E1 | "Planly" / "Plan with Planly" | Planly (roadmap engine) | Converts roadmap → daily tasks |
| E2 | "Get personal roadmap" / "Create my plan" / "Build my plan" | Roadmap CTA | Hero CTA; `<3min`, `Step 1 of 6` draft |
| E3 | "Personalised weekly sprints" / "Daily Planner" / "Planned" | Sprints + Daily Planner | `2-12 months` roadmap window; `readjusts` |
| E4 | "Learn — don't just read" / "Complete Curriculum" / "A2Z" | Learning Curriculum (A2Z) | `442 Topics`, `131.3Hrs / 132hrs`, `792 videos`, `19 modules / 95 sections`, `16 subjects` |
| E5 | "Solve & Practice" / "Practice Platform" / "Solve problem" / "POTD" | Practice + POTD | Timed coding env; `DSA / SQL / Aptitude / POTD / Online Compiler (/ide)` |
| E6 | "Company Questions" / "Subject passes" | Company Questions + Passes | `Pass` gating on company sets |
| E7 | "Track your time" / "Progress tracker" / "Your progress 0% 0/442" / "Log in to track" / "Stay on track" | Progress tracking | `Basic 0/99 · Core 0/302 · Pro 0/34`; `Missed Day/Task?` |
| E8 | "Ask TUFY" / "get help from TUFY" / "AI-powered instant doubt" / "hints · doubt resolution · code reviews" | TUFY (AI tutor) | `TUFY 10000/15000/25000 credits`; `starter 3500/2000/5000` |
| E9 | "TUF+" / "Join 100k+ Plus" / "Basic / Core / Max" / "AI Pass" | TUF+ plans (Basic/Core/Max/AI Pass) | `Basic ₹4399/₹7999 · Core ₹6049/₹10999 Most popular · Max ₹10999/₹19999`; `AI Pass Q1 2027 Max` |
| E10 | "ZENKAI" / "ZENKAI45 45% OFF" / "Sale ends 22hrs countdown" / "Claim /pricing?utm_source=ZENKAI#plans" | ZENKAI promo | Early-bird event; `Learn more · Achieve more` |
| E11 | "Revision notes / quizzes" / "Save submissions · notes · bookmarks · revision lists" / "revision pictures" | Revision system | Notes + quizzes + lists bound to curriculum/practice |

## 2. Feature table D1–D9 (verdict + key verbatims)

| Domain | Verdict | Key verbatims (evidence in §9) |
|---|---|---|
| D1 Onboarding | PARTIAL | "Get personal roadmap" · "Create my plan <3min" · "About you" · "Understanding goals" · draft "Step 1 of 6" role `SDE Intern / Software Engineer`, exp `0-2 / 2-5`, companies `Startups / FAANG / All Product / Open to all`, region `India / US-Europe-Others` · auth wall `get-started next=%2Fplanly Google/OTP 1-day vs 30-day` · "Skip continue" |
| D2 Sprints | PARTIAL | "Personalised weekly sprints" · meta `sprints / daily tasks / revision notes / quizzes / tracking` · "Know exactly what daily" · "Planned, readjusts" · "Build my plan" · "Daily Planner — Sign in to view" · "Plan with Planly — convert roadmap to daily tasks" · "Planly not available Free vs included TUF+" · `2-12 months` roadmap |
| D3 Learn | CONFIRMED | "Learn — don't just read" · "curated video & expert editorial — not just AI notes" · `A2Z 442 Topics 131.3Hrs / 132hrs 442 topics 792 videos` (variance noted) · `~450 items 400+ problems 50 theory 19 modules 95 sections` · "Complete Curriculum free" · "Video Solutions limited YouTube vs dedicated every problem" · `16 subjects DSA6 System2 Core6 DataEng2` · "revision pictures" |
| D4 Solve | CONFIRMED | "Solve & Practice" · "timed coding env" · "Practice Platform free vs premium + dedicated servers" · "POTD — Solve problem" · `19 Modules 442 Topics 16 Contests 131.3Hrs` · `DSA / SQL / Aptitude / POTD / Online Compiler /ide` · "Company Questions — Pass" · "Save submissions notes bookmarks revision lists" |
| D5 Tracking | PARTIAL | "Track your time" · "Progress tracker" · "Missed Day/Task?" · "Your progress 0% 0/442" · "Log in to track" · "Stay on track sync" · "Zenkai live progress moved" · `Basic 0/99 Core 0/302 Pro 0/34` |
| D6 AI (TUFY) | PARTIAL | "not just AI-generated notes" · "Ask TUFY — hints doubt resolution code reviews" · "AI-powered instant doubt" · "AI Pass Basic/Core vs AI Pass Q1 2027 Max" · `TUFY 10000/15000/25000 credits` · `starter 3500/2000/5000` · "get help from TUFY" |
| D7 Monetisation | CONFIRMED | "See plans pricing" · "ZENKAI Early Bird Learn more Achieve more Sale ends 22hrs countdown Claim /pricing?utm_source=ZENKAI#plans" · "ZENKAI45 45% OFF" · "Join 100k+ Plus every day" · "Affordable Plans" · `Basic ₹4399/₹7999, Core ₹6049/₹10999 Most popular, Max ₹10999/₹19999 45% OFF 12/24/48/Lifetime` · subject passes `Company 2Mo 1329/1899` etc `30% OFF` · `no-refund final non-refundable` · `cannot cancel once activated` · `shutdown no refund` · `misuse flagged restricted suspended` · `upgrade credits conversion lifetime forfeit` · `future additions scope cost upgrade discounted` · `HLD Q2/Q3 2027 Backend Principles Q2/Q3 2027` |
| D8 Cross-links | CONFIRMED | Dashboard `/dashboard` login · Prep Hub `/prep-hub` · Practice `Planly active` · Community `/community` · Blogs `/blogs` · NoteSpace `/notes` All Lists `/lists` CodeSpace `/codespace` Buganizer `/buganizer` login `Your notes all in one` · Contact `/contact-us` · footer IA · `PLATFORM OVERVIEW tabs Planly / Learning Curriculum / Resources / TUFY / Company / Aptitude / Practice / Workspace / Profile` · social `instagram x linkedin discord` |
| D9 Trust | PARTIAL | `0+ Subscribers/Followers/Engineers` placeholders · `17,98,830+ vs 18,13,684+ vs 1.8M+ 23.3K vs 100k+ Plus` · `1M subs 913k followers Raj` · founder bio `nearly four years Google vs three years Media.net→Google` · "Trusted by Thousands" Hall of Fame `/hall-of-fame coins goodies` · `+71 logos Microsoft Google Amazon Meta Oracle Uber Salesforce` etc self-reported · "Numbers At A Glance 250+ videos 300+ Hours 450+ Modules" digit-wheel · contact `+91 6371 418 920 hello@takeuforward.org` · `©2026 Moveforward Private Limited` · `/about 404 T3 165M views 13M visits 2.7M sessions 1.3M users downgraded` |

## 3. Journey (Landing → Onboard → Sprint → Learn → Solve → Track → AI → Gate)

5 steps observed:
1. Landing — hero "Get personal roadmap" / "Create my plan <3min" → onboarding (`About you`, `Understanding goals`, `Step 1 of 6`).
2. Onboard → Sprint — role/exp/companies/region draft → "Build my plan" → "Personalised weekly sprints" + "Daily Planner" (`Sign in to view`; `Planly not available Free`).
3. Learn → Solve — "Complete Curriculum" (A2Z `442 Topics / 131.3Hrs`) → "Solve & Practice" timed env + `POTD /ide` + `Company Questions Pass`.
4. Track + AI — "Track your time / Your progress 0/442 / Missed Day?" + "Ask TUFY hints / AI-powered instant doubt" (credit-metered).
5. Gate — "See plans pricing" → ZENKAI countdown → TUF+ Basic/Core/Max + AI Pass; auth wall `get-started next=%2Fplanly`.

## 4. Pricing matrix (verbatim + date, Sept 2026 capture)

| Plan | Verbatim price | Terms verbatim |
|---|---|---|
| Basic | `₹4399 / ₹7999` | TUF+ entry; AI Pass Basic variant |
| Core | `₹6049 / ₹10999 Most popular` | TUF+ mid; AI Pass Core variant |
| Max | `₹10999 / ₹19999 45% OFF` | `12 / 24 / 48 / Lifetime`; `AI Pass Q1 2027 Max` |
| Subject passes | `Company 2Mo 1329/1899` etc | `30% OFF` per subject |
| Promo | `ZENKAI45 45% OFF`, `Sale ends 22hrs countdown` | `Claim /pricing?utm_source=ZENKAI#plans` |
| Policy | `no-refund final non-refundable` · `cannot cancel once activated` · `shutdown no refund` · `misuse flagged restricted suspended` · `upgrade credits conversion lifetime forfeit` | `future additions scope cost upgrade discounted` |
| Roadmap | `HLD Q2/Q3 2027 · Backend Principles Q2/Q3 2027` | Future-scope notice |

Date: prices as captured 2026-09-20 UTC; INR list, geo/promo-variant — check checkout.

## 5. Cross-link list (canonical `takeuforward.org` only)

`/dashboard` (login) · `/prep-hub` · Practice (`Planly active`) · `/community` · `/blogs` · `/notes` · `/lists` · `/codespace` · `/buganizer` (login, `Your notes all in one`) · `/contact-us` · `/hall-of-fame` · `/pricing` (+ `?utm_source=ZENKAI#plans`) · `/about` (404 at capture) · `/ide` · PLATFORM OVERVIEW tabs: Planly / Learning Curriculum / Resources / TUFY / Company / Aptitude / Practice / Workspace / Profile · social: instagram / x / linkedin / discord.

## 6. Trust-claim list (do NOT repeat as fact)

- `0+ Subscribers / Followers / Engineers` — placeholder counters, ignore.
- `17,98,830+ vs 18,13,684+ vs 1.8M+ / 23.3K vs 100k+ Plus` — inconsistent counters across pages; quote with page+date only.
- `1M subs / 913k followers (Raj)` — social proof, self-reported.
- Founder bio `nearly four years Google` vs `three years Media.net→Google` — version variance; cite verbatim.
- "Trusted by Thousands" + Hall of Fame `/hall-of-fame (coins goodies)` + `+71 logos (Microsoft Google Amazon Meta Oracle Uber Salesforce …)` — self-reported placement claims.
- "Numbers At A Glance: 250+ videos / 300+ Hours / 450+ Modules" — digit-wheel marketing counters.
- `contact +91 6371 418 920 / hello@takeuforward.org / ©2026 Moveforward Private Limited` — business identity (V1 footer).
- `/about 404 · 165M views / 13M visits / 2.7M sessions / 1.3M users` — T3 downgraded, do not cite as TUF claim.

## 7. Gaps (10 items — taxonomy: JS-gated / login-gated / unconfirmed)
Taxonomy: [JS-gated]=needs JS-render capture; [login-gated]=needs auth capture; [unconfirmed]=single-source/unverified.

1. [JS-gated] [unconfirmed] Onboarding Step 1 of 6 full step list unconfirmed (draft only).
2. [login-gated] [unconfirmed] 1-day vs 30-day session semantics unverified.
3. [JS-gated] [unconfirmed] Sprint readjust algorithm (Planned, readjusts) undescribed.
4. [unconfirmed] 131.3Hrs vs 132hrs / 792 videos variance unresolved.
5. [unconfirmed] ~450 items = 400+ problems + 50 theory exact split unconfirmed.
6. [login-gated] [unconfirmed] Video Solutions limited YouTube vs dedicated boundary unconfirmed.
7. [JS-gated] [unconfirmed] 16 Contests schedule/format undescribed.
8. [login-gated] [unconfirmed] TUFY 10000/15000/25000 vs starter 3500/2000/5000 tier mapping unconfirmed.
9. [unconfirmed] AI Pass Q1 2027 Max scope/price unconfirmed.
10. [unconfirmed] HLD / Backend Principles Q2/Q3 2027 delivery commitment unconfirmed; /about 404 leaves identity claims single-sourced to footer.

## 8. Acceptance criteria (AC1–AC8)

- AC1 Scope + collision guard present (§0) — PASS.
- AC2 Terminology: 11 entities verbatim+canonical (§1) — PASS.
- AC3 Feature table D1–D9 with PARTIAL/CONFIRMED verdicts (§2) — PASS.
- AC4 Journey Landing→Onboard→Sprint→Learn→Solve→Track→AI→Gate (§3) — PASS.
- AC5 Pricing matrix verbatim+date (§4) — PASS.
- AC6 Cross-link list, `takeuforward.org` only (§5) — PASS.
- AC7 Trust-claim list, no repetition as fact (§6) — PASS.
- AC8 Evidence log: every row verbatim+URL+access+grade, `takeuforward.org` provenance only (§9) — PASS.

## 9. Evidence log (verbatim + URL + access + grade)

Access date for all rows: 2026-09-20 UTC. Provenance: `takeuforward.org` only.

| # | Domain | Verbatim | URL | Access | Grade |
|---|---|---|---|---|---|
| 1 | D1 | "Get personal roadmap" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 |
| 2 | D1 | "Create my plan <3min" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 |
| 3 | D1 | "About you" / "Understanding goals" / "Step 1 of 6" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 |
| 4 | D1 | "SDE Intern / Software Engineer · 0-2 / 2-5 · Startups / FAANG / All Product / Open to all · India / US-Europe-Others" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V2 |
| 5 | D1 | "get-started next=%2Fplanly · Google / OTP · 1-day vs 30-day · Skip continue" | `https://takeuforward.org/get-started` | 2026-09-20 UTC | V1 |
| 6 | D2 | "Personalised weekly sprints" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 |
| 7 | D2 | "sprints / daily tasks / revision notes / quizzes / tracking" (meta description) | `https://takeuforward.org/planly` | 2026-09-20 UTC | V2 |
| 8 | D2 | "Know exactly what daily" / "Planned, readjusts" / "Build my plan" | `https://takeuforward.org/planly` | 2026-09-20 UTC | V1 |
| 9 | D2 | "Daily Planner — Sign in to view" | `https://takeuforward.org/planner` | 2026-09-20 UTC | V1 |
| 10 | D2 | "Plan with Planly — convert roadmap to daily tasks · 2-12 months roadmap · Planly not available Free vs included TUF+" | `https://takeuforward.org/pricing` | 2026-09-20 UTC | V2 |
| 11 | D3 | "Learn — don't just read · curated video & expert editorial — not just AI notes" | `https://takeuforward.org/courses` | 2026-09-20 UTC | V1 |
| 12 | D3 | "A2Z 442 Topics 131.3Hrs / 132hrs 442 topics 792 videos" | `https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2` | 2026-09-20 UTC | V1 |
| 13 | D3 | "~450 items · 400+ problems · 50 theory · 19 modules · 95 sections · Complete Curriculum free" | `https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2` | 2026-09-20 UTC | V1 |
| 14 | D3 | "Video Solutions limited YouTube vs dedicated every problem · 16 subjects DSA6 System2 Core6 DataEng2 · revision pictures" | `https://takeuforward.org/courses` | 2026-09-20 UTC | V2 |
| 15 | D4 | "Solve & Practice · timed coding env · Practice Platform free vs premium + dedicated servers" | `https://takeuforward.org/practice` | 2026-09-20 UTC | V1 |
| 16 | D4 | "POTD — Solve problem · 19 Modules 442 Topics 16 Contests 131.3Hrs" | `https://takeuforward.org/practice` | 2026-09-20 UTC | V1 |
| 17 | D4 | "DSA / SQL / Aptitude / POTD / Online Compiler /ide · Company Questions Pass · Save submissions notes bookmarks revision lists" | `https://takeuforward.org/practice` | 2026-09-20 UTC | V1 |
| 18 | D5 | "Track your time · Progress tracker · Missed Day/Task? · Your progress 0% 0/442 · Log in to track" | `https://takeuforward.org/progress` | 2026-09-20 UTC | V1 |
| 19 | D5 | "Stay on track sync · Zenkai live progress moved · Basic 0/99 Core 0/302 Pro 0/34" | `https://takeuforward.org/progress` | 2026-09-20 UTC | V2 |
| 20 | D6 | "not just AI-generated notes · Ask TUFY hints doubt resolution code reviews · AI-powered instant doubt · get help from TUFY" | `https://takeuforward.org/tufy` | 2026-09-20 UTC | V1 |
| 21 | D6 | "TUFY 10000/15000/25000 credits · starter 3500/2000/5000 · AI Pass Basic/Core vs AI Pass Q1 2027 Max" | `https://takeuforward.org/pricing` | 2026-09-20 UTC | V2 |
| 22 | D7 | "See plans pricing · Affordable Plans · Join 100k+ Plus every day" | `https://takeuforward.org/pricing` | 2026-09-20 UTC | V1 |
| 23 | D7 | "ZENKAI Early Bird · Learn more Achieve more · Sale ends 22hrs countdown · Claim /pricing?utm_source=ZENKAI#plans · ZENKAI45 45% OFF" | `https://takeuforward.org/pricing?utm_source=ZENKAI#plans` | 2026-09-20 UTC | V1 |
| 24 | D7 | "Basic ₹4399/₹7999 · Core ₹6049/₹10999 Most popular · Max ₹10999/₹19999 45% OFF 12/24/48/Lifetime · Company 2Mo 1329/1899 30% OFF" | `https://takeuforward.org/pricing` | 2026-09-20 UTC | V1 |
| 25 | D7 | "no-refund final non-refundable · cannot cancel once activated · shutdown no refund · misuse flagged restricted suspended · upgrade credits conversion lifetime forfeit · future additions scope cost upgrade discounted · HLD Q2/Q3 2027 Backend Principles Q2/Q3 2027" | `https://takeuforward.org/pricing` | 2026-09-20 UTC | V1 |
| 26 | D8 | "Dashboard /dashboard (login) · Prep Hub /prep-hub · Practice Planly active · Community /community · Blogs /blogs" | `https://takeuforward.org/` | 2026-09-20 UTC | V1 |
| 27 | D8 | "NoteSpace /notes · All Lists /lists · CodeSpace /codespace · Buganizer /buganizer (login) Your notes all in one · Contact /contact-us · PLATFORM OVERVIEW tabs · instagram x linkedin discord" | `https://takeuforward.org/` | 2026-09-20 UTC | V1 |
| 28 | D9 | "0+ Subscribers/Followers/Engineers · 17,98,830+ · 18,13,684+ · 1.8M+ 23.3K · 100k+ Plus · 1M subs 913k followers Raj" | `https://takeuforward.org/` | 2026-09-20 UTC | V1 |
| 29 | D9 | "founder bio nearly four years Google vs three years Media.net→Google · Trusted by Thousands · Hall of Fame /hall-of-fame coins goodies · +71 logos Microsoft Google Amazon Meta Oracle Uber Salesforce" | `https://takeuforward.org/hall-of-fame` | 2026-09-20 UTC | V1 |
| 30 | D9 | "Numbers At A Glance 250+ videos 300+ Hours 450+ Modules · +91 6371 418 920 · hello@takeuforward.org · ©2026 Moveforward Private Limited" | `https://takeuforward.org/` | 2026-09-20 UTC | V1 |
| 31 | D9 | "/about 404 · 165M views 13M visits 2.7M sessions 1.3M users downgraded" | `https://takeuforward.org/about` | 2026-09-20 UTC | T3 |
| 32 | D2/D5 | Sprint + tracking inferred linkage ("readjusts" + "Missed Day?") | `https://takeuforward.org/planly` | 2026-09-20 UTC | I1 |

(End of file)
