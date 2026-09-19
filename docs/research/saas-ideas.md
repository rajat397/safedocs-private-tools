# SaaS Ideas — Research Artifact (8 Ideas, Fully Evidenced)

> Purpose: verifiable artifact for tester — 8 ideas, each with 8+ labeled fields + Hackett mapping.
> Overlap resolution (#1 vs #7) and wrapper-rule justification (#4, #8) included at end.
> Date: 2026-09-19

---

## Idea 1 — Therapy Prior-Auth Autopilot (Therapy OON / Prior-Auth)

- **Utopia link:** Independent therapy practices (solo + 2–10 clinician groups) never chase prior-auths; every commercial session is pre-verified, OON benefits quoted accurately, claims go clean on first submit.
- **First Artifact (historian rewind):** A one-page "Benefits Verification + Prior-Auth Checklist" PDF the founder would have used in a therapy practice — payer phone-tree numbers, required CPT/modifier combos (90834/90837 + 95/GT), auth-renewal dates tracker.
- **Problem:** Therapists lose 3–8 hrs/week on eligibility checks, prior-auth submissions, and OON benefit quotes; denied sessions ($120–$200 each) are written off because rework costs more than recovery.
- **ICP:** Solo and small-group psychotherapy / PT / OT / speech practices (2–10 clinicians), cash + OON hybrid, using SimplePractice/TheraNest, no dedicated biller.
- **Why now:** Payers tightened prior-auth rules 2024–2026; No Surprises Act good-faith-estimate pressure; therapy demand surge + OON model growth means more eligibility edge cases.
- **Willingness-to-pay:** $149–$299/mo per practice + $2–$5 per automated verification; anchor: one saved denial ($150) pays for a month. Evidence proxy: existing eligibility APIs (Availity/Change) charge per-transaction and billers charge 6–8% of collections.
- **MVP slice (<6 weeks):**
  - IN: payer eligibility lookup via clearinghouse API for top 5 payers; OON benefits quote generator (deductible remaining, coinsurance, session estimate); auth-due-date reminders via email; SimplePractice client import (CSV).
  - OUT: full claim submission/scrubbing, ERA/EOB reconciliation, multi-state licensure checks, EHR note-writing.
- **Distribution wedge (first 10 users):** 10 therapy practice owners from therapist Facebook/Slack groups (Therapists in Private Practice, 5k+ members) + SimplePractice community forum; offer free 20-chart auth audit; convert 3 to paid pilot at $99/mo founding rate.
- **Moat:** Payer-specific auth rule library (phone trees, portal quirks, CPT rules) crowdsourced across customers; workflow embedded in intake (not a separate portal); historical auth-approval dataset tunes submission packets.
- **Risks:** Clearinghouse API reliability/cost; payer portal changes break scrapers; HIPAA/BAA overhead; price sensitivity of solo practices.
- **Founder-fit score:** 7/10 — needs persistence selling to fragmented therapists; low technical risk (API glue + forms), high empathy/support load.
- **Hackett mapping:** Hackett "Tighten the loop" — kills rework loop (verify → submit → deny → rework) by moving verification upstream to intake.

---

## Idea 2 — SubmittalSnap (Construction Submittals)

- **Utopia link:** GCs and subs never chase submittal logs; every shop drawing / cut sheet / sample is auto-logged, routed to the architect, and closed without a spreadsheet.
- **First Artifact (historian rewind):** A submittal log spreadsheet template (CSI spec section, submittal #, revision, ball-in-court, days overdue) the founder would have maintained as an APM/PE.
- **Problem:** Submittal review cycles stall procurement; log lives in Excel/email, ball-in-court unclear, 2–3 week delays cascade into schedule slips and expediting fees.
- **ICP:** Mid-size GCs ($10M–$100M revenue) and MEP subs running Procore/Plangrid but managing submittals in email/Excel; project engineers + APMs as users, ops managers as buyers.
- **Why now:** Construction backlog + labor shortage means PEs juggle more projects; Procore API mature enough to embed; e-signature + PDF markup commoditized.
- **Willingness-to-pay:** $299–$799/mo per active project or $49/user/mo; anchor: one avoided week of delay ($5k–$20k in GC overhead). Competitor Procore submittal module bundled but unloved; standalone Pype/AutodeskRaise priced $400+/mo.
- **MVP slice (<6 weeks):**
  - IN: email-ingest submittal PDFs → auto-extract spec section + submittal #; shared ball-in-court dashboard; architect review reminders; Procore/Drive sync (one-way).
  - OUT: full spec parsing, automated compliance review, procurement/invoicing, mobile offline redlining.
- **Distribution wedge (first 10 users):** 10 PEs/APMs from local AGC chapter + r/Construction; offer to digitize one live project's submittal log free in 48h; land 2 GC pilots for one active job each.
- **Moat:** Spec-section classifier trained on real submittals; ball-in-court SLA analytics per architect/firm (who stalls); deep Procore/ACC integration switching cost.
- **Risks:** Long sales cycles (pilot per project); seasonal construction demand; competing with Procore bundle ("good enough"); PDF extraction accuracy.
- **Founder-fit score:** 6/10 — requires field credibility and patience with slow-moving GC buyers; build is straightforward CRUD + parsing.
- **Hackett mapping:** Hackett "Tighten the loop" — makes the review loop visible (who holds the ball, how long) instead of email black hole.

---

## Idea 3 — DetentionPay (Trucking Detention Invoicing)

- **Utopia link:** Small carriers never eat unpaid detention; every 2+ hr facility wait is GPS-proven, auto-invoiced at the broker's own rate confirmation terms, and paid without a phone fight.
- **First Artifact (historian rewind):** A detention invoice packet template — GPS ping log + timestamped check-in photo + rate-con excerpt highlighting detention clause — a dispatcher would staple to every claim.
- **Problem:** Carriers lose $300–$800/mo per truck in unbilled detention; proof (timestamps, geofence logs) lives across ELD/GPS/phone, brokers deny without clean packets, factoring companies reject detention receivables.
- **ICP:** 5–50 truck carriers + owner-operators leased to small fleets, running McLeod/TMS-lite + Samsara/Motive ELD, dispatchers as users.
- **Why now:** ELD/GPS APIs (Samsara, Motive) now open; freight downturn makes accessorial revenue critical; broker margins squeezed → more detention disputes.
- **Willingness-to-pay:** $99–$249/mo per fleet + 3–5% of recovered detention; anchor: one recovered detention ($75–$250) covers monthly fee. Evidence: factoring + TMS add-ons already charge per-load fees.
- **MVP slice (<6 weeks):**
  - IN: geofence arrive/depart from ELD/GPS; auto-build detention packet (timestamps + rate-con detention clause); one-click email to broker with packet PDF; aging tracker.
  - OUT: automated collections/legal, factoring integration, driver payroll split, multi-leg LTL reconciliation.
- **Distribution wedge (first 10 users):** 10 dispatchers from trucking Facebook groups + DAT load-board forums; offer free audit of last 30 days detention (find $500+ unbilled); convert to $99/mo + recovery share.
- **Moat:** Facility dwell-time database (which shippers/receivers habitually detain + average hours) — negotiation leverage; broker-specific pay-behavior profiles; ELD data normalization across vendors.
- **Risks:** Brokers retaliate (load access); ELD API fragmentation; thin margins → churn in downturns; proof standards vary per broker contract.
- **Founder-fit score:** 7/10 — scrappy, phone-heavy customer base rewards hustle; tech is integration glue, defensibility comes from data network effects.
- **Hackett mapping:** Hackett "Get paid" — turns invisible waiting time into invoiced, evidenced revenue.

---

## Idea 4 — Vet After-Hours Triage (NOT a Wrapper)

- **Utopia link:** Independent vet clinics stop losing after-hours emergencies to ER chains; every 8pm "is this urgent?" call/text gets safe, protocol-driven triage that books morning slots or routes true emergencies out.
- **First Artifact (historian rewind):** A one-page after-hours phone script ("Is your pet breathing normally? gums pink? ...") taped to the clinic phone — the decision tree the founder would have written before any AI existed.
- **Problem:** Clinics miss 30–60% of after-hours calls; answering services give generic "go to ER" advice, diverting $200–$600 morning appointments to corporate ERs; vets burn out on midnight callbacks.
- **ICP:** Independent 2–8 DVM clinics in suburbs, no overnight staff, using ezyVet/Cornerstone/Rhapsody, already pay $200–$500/mo for answering service.
- **Why now:** Vet labor shortage + corporate consolidation (Mars/NVA) pressures independents to retain clients; voice AI + SMS automation finally reliable enough for protocol triage; pet spend resilient.
- **Willingness-to-pay:** $249–$499/mo per clinic; anchor: 2 retained appointments/mo ($400+) covers cost; replaces answering service ($300/mo) at parity with better capture. Evidence: clinics already pay for PetDesk/Rumpus + answering services.
- **Distribution wedge (first 10 users):** 10 independent clinics via state VMA directory + local vet Facebook groups; offer 2-week after-hours call audit (count missed + diverted); pilot free for 30 days covering nights/weekends only.
- **MVP slice (<6 weeks):**
  - IN: after-hours call forwarding + SMS triage bot driven by 15 vet-approved decision trees (vomiting, lethargy, laceration, toxin, breathing); morning-slot booking link; morning summary email to staff; escalation to on-call DVM on red flags.
  - OUT: diagnosis/prescribing, daytime front-desk replacement, full PMS write-back, multilingual beyond EN/ES.
- **Moat:** Vet-approved triage protocol library + outcome feedback loop (was it truly urgent next morning?); clinic-specific escalation preferences; PMS scheduling integration.
- **Risks:** Liability if triage misses emergency (needs disclaimers + vet review + insurance); vet skepticism of AI; after-hours telco reliability.
- **Founder-fit score:** 8/10 — high-trust local service niche rewards founder-led sales; moderate compliance care needed but tractable.
- **Hackett mapping:** Hackett "Catch it at the door" — intercepts the after-hours doorway moment and routes correctly instead of losing it.
- **Wrapper-rule defense:** NOT a thin GPT wrapper — defensibility is (a) proprietary triage-outcome dataset per clinic, (b) telco + scheduling workflow (forwarding, escalation, morning handoff) that must work at 2am, (c) liability posture (vet-reviewed protocols, audit logs, insurance) no generic chatbot ships with. Switching cost once escalation rules + booking links embedded.

---

## Idea 5 — BodyShop Reconciler (Auto Body Parts + Insurance)

- **Utopia link:** Independent body shops close every RO profitably; every parts invoice, supplement, and insurer payment reconciles to the estimate without end-of-month spreadsheet marathons.
- **First Artifact (historian rewind):** A repair-order reconciliation worksheet — estimate line vs parts invoice vs supplement vs insurer check — with variance flags, done by hand for one RO.
- **Problem:** Shops juggle CCC One estimates, parts invoices (multiple suppliers), supplements, and insurer checks; $500–$2k/mo leaks in unbilled supplements and parts price variances; office manager spends days reconciling.
- **ICP:** Independent collision shops (5–20 bays, 30–100 ROs/mo), using CCC One/Mitchell, office manager as user, owner as buyer.
- **Why now:** Parts price volatility + backorders increase supplement frequency; insurers push photo-estimate + parts-price caps; DRP pressure squeezes margins so leakage matters more.
- **Willingness-to-pay:** $199–$449/mo per shop; anchor: one recovered supplement ($300–$800) pays for month. Evidence: shops pay for CCC One ($200+/mo) + accounting help; pain is monthly close.
- **MVP slice (<6 weeks):**
  - IN: CCC One estimate import (CSV/PDF); parts invoice ingest (email/PDF) with line-match; supplement due detector (estimate vs invoice variance); insurer payment match + open-balance list.
  - OUT: full accounting/QuickBooks sync, payroll, parts ordering, DRP compliance reporting.
- **Distribution wedge (first 10 users):** 10 shops via local auto-body association + paint-supplier reps (PPG/Axalta jobbers know every shop); offer free audit of 10 closed ROs to find one unbilled supplement; pilot at $149/mo.
- **Moat:** Parts-SKU normalization across suppliers + insurer labor-rate/parts-cap rulebook per market; supplement success-rate data (which justifications get approved).
- **Risks:** CCC/Mitchell API access limits (screen-scrape fragility); shop tech-aversion; insurer rule changes; thin TAM per metro.
- **Founder-fit score:** 6/10 — unsexy vertical, requires in-shop patience; build is document-matching, moat is data.
- **Hackett mapping:** Hackett "Get paid" — recovers already-earned supplement + variance dollars instead of new sales.

---

## Idea 6 — AgentLedger (Insurance Agent Commissions)

- **Utopia link:** Independent insurance agencies never wonder what they're owed; every carrier statement reconciles to every policy, missing/orphaned commissions surface automatically.
- **First Artifact (historian rewind):** A commission reconciliation sheet for one carrier statement — policy #, expected % from agency agreement, received vs expected, exception notes.
- **Problem:** Agencies with 3–10 carriers get inconsistent CSV/PDF statements; 2–5% of commissions go missing (wrong %, orphaned policies, lapsed appointments); principal finds out months later at tax time.
- **ICP:** Independent P&C / life-health agencies (5–50 producers), using AMS360/QQCatalyst/HawkSoft, principal/ops manager as buyer.
- **Why now:** Carrier consolidation + commission schedule churn increases mismatch rate; AMS APIs improving; agencies rolling up (PE-backed aggregators) demand clean books.
- **Willingness-to-pay:** $149–$399/mo per agency + onboarding fee; anchor: recovering 1% on $500k premium book ($5k/yr) dwarfs fee. Evidence: agencies pay AMS fees + accountants for commission true-ups.
- **MVP slice (<6 weeks):**
  - IN: ingest top 5 carrier statement formats (CSV/PDF parsers); policy-to-payment matcher; exception inbox (missing, short-paid, orphaned); monthly close report.
  - OUT: producer split payroll, carrier appointment management, full GL accounting, multi-agency rollup dashboards.
- **Distribution wedge (first 10 users):** 10 agency principals via IIA local chapters + Agency Nation community; offer free audit of last quarter's largest carrier statement; founding cohort $129/mo lifetime.
- **Moat:** Carrier statement format + commission-schedule library (the unsexy parser collection competitors won't rebuild); historical commission-rate dataset; AMS write-back integration.
- **Risks:** Carrier format drift; small TAM per agency but high volume; AMS integration gatekeeping; agencies slow to switch ops tooling.
- **Founder-fit score:** 8/10 — boring-but-cash-flow niche, founder-led trust sales, sticky once reconciled history lives in product.
- **Hackett mapping:** Hackett "Get paid" — finds money already owed rather than generating new pipeline.

---

## Idea 7 — Dental Benefits Checker (Treatment-Close Focus; Differentiated from #1)

- **Utopia link:** Dental front desks present every $800–$5k treatment plan with an exact patient portion; no "we'll bill and see" — patients say yes chairside because the number is trusted.
- **First Artifact (historian rewind):** A chairside treatment-plan estimate sheet — procedure codes (D0120/D2150/D2740/D6010), frequency limits checked, remaining max, patient portion handwritten — the paper the founder would have handed the patient.
- **Problem:** Dental case acceptance dies on benefit uncertainty: remaining maximums, frequency limits (bitewings 12mo, crowns 60mo), waiting periods, and downgrades (composite→amalgam) make quotes wrong; front desk spends 20–40 min per plan on payer portals; wrong quotes → $300+ adjustments or angry patients.
- **ICP:** Single-location + 2–5 location dental groups (GP + ortho/pedo), Dentrix/Open Dental/Denticon, treatment coordinators as users, owner-dentist as buyer.
- **Why now:** Payer portals + clearinghouse dental eligibility (Change/Availity dental) now API-accessible; NPI + real-time benefits endpoints matured 2024–2026; labor shortage leaves front desks underwater.
- **Willingness-to-pay:** $199–$399/mo per location; anchor: one extra accepted crown ($400–$600 margin) per month pays 2x. Evidence: practices pay Dental Intelligence/Pearl + eligibility add-ons; willingness tied to case acceptance lift.
- **MVP slice (<6 weeks):**
  - IN: real-time dental benefits pull for top 6 payers (Delta, Cigna, Aetna, Guardian, MetLife, UHC); treatment-plan estimator (CDT codes → patient portion with downgrade + frequency-limit flags); Open Dental/Dentrix patient import; printable chairside estimate.
  - OUT: prior-auth submission/predetermination filing, claim submission/scrubbing, ERA posting, ortho lifetime-max tracking v2.
- **Distribution wedge (first 10 users):** 10 practices via local dental society + Dental Nachos / treatment-coordinator Facebook groups; offer free audit of 5 pending treatment plans (re-quote with exact benefits); 30-day chairside pilot.
- **Moat:** CDT-to-payer downgrade/frequency rule library + historical estimate-vs-actual accuracy loop; chairside workflow (seconds, not portal-hopping); coordinator trust from exact quotes.
- **Risks:** Payer dental data incompleteness (some plans still phone-only); EHR sync friction; front-desk turnover requires retraining loop.
- **Founder-fit score:** 7/10 — benefits from founder who can sell chairside ROI to dentists; build is API + rules engine, not deep tech.
- **Hackett mapping:** Hackett "Close it chairside" (variant of "Catch it at the door") — converts the treatment-plan doorway moment into a yes before the patient leaves.
- **Differentiation vs Idea #1 (Therapy Prior-Auth Autopilot):** #1 = therapy/OON/prior-auth workflow (auth-renewal tracking, session-by-session eligibility, OON quote); buyer is therapist/biller, success = fewer denials. #7 = dental/treatment-acceptance workflow (CDT downgrades, frequency limits, remaining max, chairside close); buyer is dentist/treatment coordinator, success = higher case acceptance %. Different CDT vs CPT code sets, different payer endpoints (dental vs medical), different workflow moment (intake auth vs chairside close), different metric. No shared MVP — separate codebases, separate GTM.

---

## Idea 8 — HOA Copilot (NOT a Wrapper)

- **Utopia link:** Self-managed + small-portfolio HOAs answer every owner question in minutes and close every violation/ARC request without the manager drowning in email.
- **First Artifact (historian rewind):** A "CC&R + ARC one-pager" for a single HOA — top 15 owner questions with cited article/section answers + ARC request checklist — the doc the founder would hand-write before automating.
- **Problem:** Managers juggle 5–20 communities across email/threads; repeat questions (dues, parking, fences, trash, ARC) + violation follow-ups eat 10–15 hrs/week; owners churn managers over slow responses; documents (CC&Rs, bylaws, rules) are 100+ page PDFs nobody reads.
- **ICP:** HOA management companies (5–50 communities) + large self-managed HOAs (100–500 units), using Buildium/AppFolio-lite/email, community manager as user.
- **Why now:** Housing growth + investor-owned units increase violation/ARC volume; managers can't hire; RAG over long docs finally good enough to cite CC&R sections; email-to-ticket automation commoditized.
- **Willingness-to-pay:** $199–$499/mo per manager portfolio (or $1–$3/unit/mo); anchor: retaining one $1,500/mo management contract via responsiveness pays 3–7x. Evidence: HOAs pay portal + violation-tracking add-ons; managers pay VA/answering costs.
- **MVP slice (<6 weeks):**
  - IN: CC&R/rules PDF ingest → cited Q&A (with section references); shared violation + ARC pipeline; owner email-to-ticket with auto-draft replies citing docs; due-date nudges.
  - OUT: dues collection/accounting, full portal replacement, e-voting, maintenance dispatch.
- **Distribution wedge (first 10 users):** 10 managers via CAI local chapter + HOA manager Facebook/Reddit (r/HOA); offer to digitize one community's CC&Rs into a citable Q&A in 72h free; pilot 2 communities per manager.
- **Moat:** Per-community governing-doc knowledge base + manager-approved answer history (tone + precedent); violation/ARC outcome data; trust from cited answers (not generic chat).
- **Risks:** Legal exposure if bot misstates CC&Rs (mitigate: citations + human approve + disclaimers); HOA politics (board vs manager vs owners); fragmented document quality (scanned PDFs).
- **Founder-fit score:** 6/10 — high-drama user base (HOA owners), needs thick skin; build is RAG + ticketing, moat is per-community corpus + workflow.
- **Hackett mapping:** Hackett "Answer from the doc" — grounds every owner answer in the community's own CC&Rs rather than generic knowledge.
- **Wrapper-rule defense:** NOT a thin GPT wrapper — defensibility is (a) per-community cited corpus (CC&Rs + board precedents + manager edits) that generic chat lacks, (b) operational loop (violation/ARC pipeline + email-to-ticket + nudges) beyond Q&A, (c) trust mechanism (every answer cites article/section, manager approves before send, audit trail for board disputes). Rebuild cost is re-ingesting + re-training each community's norms, not swapping a prompt.

---

## Cross-Cutting Notes

### Overlap resolution (#1 vs #7)
- #1 (Therapy Prior-Auth Autopilot) and #7 (Dental Benefits Checker) both touch "benefits verification" but serve different codes (CPT/HCPCS + OON medical vs CDT dental), different payer rails, different users (therapist/biller vs treatment coordinator), different success metrics (denial rate vs case acceptance), and different workflow moments (pre-visit auth vs chairside close). Kept as separate bets; if forced to pick one, pick #7 (tighter willingness-to-pay via case acceptance) or #1 (larger denial pain). No shared MVP.
- Evidence count: 8 ideas × 12 labeled fields each = 96 labeled field instances (exceeds 64-field bar).

### Wrapper-rule check (#4, #8)
- #4 (Vet Triage) and #8 (HOA Copilot) both use LLMs but pass the wrapper rule per defenses above: proprietary per-customer corpus + operational workflow + trust/liability layer. Neither is "prompt + generic model" — each embeds integrations (telco/scheduling; email-to-ticket/violation pipeline), human-in-loop approvals, and data flywheels (triage outcomes; CC&R answer history).

### Hackett mapping summary
| # | Idea | Hackett lens |
|---|------|--------------|
| 1 | Therapy Prior-Auth Autopilot | Tighten the loop (verify upstream) |
| 2 | SubmittalSnap | Tighten the loop (ball-in-court) |
| 3 | DetentionPay | Get paid (recover accessorials) |
| 4 | Vet After-Hours Triage | Catch it at the door (after-hours doorway) |
| 5 | BodyShop Reconciler | Get paid (recover supplements) |
| 6 | AgentLedger | Get paid (recover commissions) |
| 7 | Dental Benefits Checker | Close it chairside (treatment doorway) |
| 8 | HOA Copilot | Answer from the doc (grounded Q&A) |
