# takeuforward.org Planly probes — 2026-09-22 (addendum to 2026-09-20 frozen spec)

Canonical host only: takeuforward.org. Capture: 2026-09-22T19:38–19:42Z UTC.
Grades: OBSERVED (rendered/static-string) vs NOT-OBSERVED (needs Playwright headed).

## P1 — Wizard Steps 1–6 (JS bundle static strings + SSR Step 1)

Source pages: https://takeuforward.org/planly/draft (+/_next/static/chunks/2gjb_172b43_1.js),
https://takeuforward.org/planly, https://takeuforward.org/planly?view=features.

### Row P1-S1 (OBSERVED rendered, SSR html @19:42:19Z)
Header `Planly by takeUforward`, `About you`, `Let's get to know you better!`,
`1. Which role are you preparing for? *` [SDE Intern, Software Engineer];
`2. How much experience do you have? *` [0 - 2 years, 2 - 5 years, 5+ years];
`3. What kind of companies are you mainly targeting? *`
[Startups, FAANG, All Product Based Companies, Open to all];
`4. Which region's companies are you preparing for? *` [India, US/Europe/Others];
`Step 1 of 6` + `Next`.

### Row P1-S1B (OBSERVED static-string, bundle PLANLY_STEP_COPY[1])
Extra vs SSR: `prepDays: "In how many days do you want to get prepared?"`,
`customDays: "Enter number of days"`,
`prepDaysHint: "You can adjust your daily study hours later."`,
options 30/60/90/120/custom (prepDaysOption; else custom).
Validators h(): role→"Select a role to continue.",
experience→"Select your experience level." (skipped intern track),
interviewTarget→"Select your interview target.",
companyRegion→"Select the company region you are preparing for.",
catalog adds prepDays→"Select how many days you want to prepare.",
customPrepDays→"Enter a number between 7 and 365."
(step-1 branch does NOT reference prepDays in this revision).
next="Next", label `Step ${e} of ${t}`, previous="Previous".
RENDERED PLACEMENT + INVALID-SUBMIT BLOCKING: NOT-OBSERVED (needs Playwright).

### Row P1-S2 (OBSERVED static-string copy+validation; options/`*` NOT-OBSERVED)
`PLANLY_STEP_COPY[2]`: title `Recommended subjects`,
mascot `We've picked the essentials for your goal.`,
subtitle `We selected subjects that matter most for your target interviews. You can remove anything you don't want to prepare.`,
headings `We selected subjects that matter most for your target` / `Other additional subjects`,
badge `Recommended`, CTA `Continue with selected subjects`.
Validation: subjects→"Select at least one subject.",
dynamic "Remove subjects that are no longer available before continuing."
Subject list server-driven (recommended-subjects API off Step-1 answers);
level-option keys hardcode slugs dsa, dbms, computer-networks, operating-system, oops, lld.

### Row P1-S3 (OBSERVED static-string copy+options+validation; `*`/prefill NOT-OBSERVED)
`codingLanguage: "What is your preferred coding language?"` [C++, Java, Python],
default cpp, shown only when dsa + new_to_this (isPlanlyCodingLanguageRequired).
Mascot `Let's find out levels for you.`, title `Select your current level for each subject`,
subtitle `We estimated your level from your TUF activity. You can change it before generating the plan.`,
CTA `Confirm levels`. Levels generic PLANLY_LEVEL_OPTIONS
[New to this / Basic / Intermediate / Strong + descriptions];
per-subject PLANLY_SUBJECT_LEVEL_OPTIONS: DSA [Start from zero / DSA Foundations /
Pattern Mastery / Quick Revision + descriptions], DBMS/CN/OS [Learn in Depth /
Interview Preparation], OOPs/LLD [Learn from Fundamentals / Interview Preparation].
Validation: preferredCodingLanguage→"Select your preferred coding language.",
levels→"Select a level for every subject."

### Row P1-S4 (OBSERVED static-string copy+validation; roadmap content NOT-OBSERVED)
Mascot `Ask Tufy to adjust this syllabus.`, title `Review your personalized roadmap`,
subtitle `We created this based on your goal, subjects, and comfort level. The final arrangement will be completed in the last step.`,
hoursBanner `We've planned ${e} hour(s) of focused learning for you.`,
tufyPrompt `Ask Tufy to adjust this syllabus — e.g. remove graphs, add SQL join practice.`,
placeholder `Ask Tufy...`, schedulePreview `Weighted schedule preview`,
hint `Tasks are mixed across subjects in backend order. This is the planned sequence before availability packing.`,
CTA `Confirm content`. Validation: roadmap→"Keep at least one subject in your roadmap."

### Row P1-S5 (OBSERVED static-string copy+controls+validation; est-days math NOT-OBSERVED)
Mascot `Set a pace that works for you.`, title `Set your weekly study availability.`,
subtitle `Tell us how much time you can give each day so we can schedule your roadmap realistically.`,
tip `You can finish earlier by adding more hours on any day.`,
estDays `Est. days:`, dayOff `Day off`, hoursLabel 1→"1 hour" else "N hours",
totalAllocated `You have allocated a total of ${e} hours for your weekly schedule.`,
CTA `Confirm availability`. Controls: weekday sliders min 0 / max PLANLY_HOURS_MAX=16 /
step 1 over PLANLY_WEEKDAYS [Monday…Sunday], defaults PLANLY_EMPTY_WEEKLY_HOURS all 0.
Validation: availability→"Allocate at least one study hour in your week."

### Row P1-S6 (OBSERVED static-string copy+options+validation; generate behavior NOT-OBSERVED)
Mascot `Looks perfect! You're all set to begin your preparation journey.`,
title `Finalise your plan`, subtitle `Review your schedule and lock it in`,
detailsTitle `Plan details`, detailsSubtitle `Give your roadmap a name and choose when to start`,
planName `Plan name` (max PLANLY_PLAN_NAME_MAX=60),
startWhen `When do you want to start?` [Today / Tomorrow / Custom date, calendar disabled before today],
startHint `No pressure to begin today. Start whenever you're ready, we'll adjust your roadmap from there.`,
startUnavailableHint `There isn't enough time left today for your allocated study hours. Choose tomorrow or a later date — we'll adjust your roadmap from there.`,
CTA `Generate plan`. Metrics: Total sprints / Subjects / Study hours / Est. duration / Est. completion.
Validation: planName→"Enter a plan name (1–60 characters).",
startDate→"Choose when you want to start.",
customStartDate→"Pick a start date that is today or later."
Success screen (7): `Your personalised roadmap is ready` + `Go to Dashboard`.
Post-plan loader: `Understanding your goals / Estimating preparation time / Arranging the topics / Organising into sprints / Crafting your plan`.
Websearch corroboration: no third-party Steps 2–6 source (only marketing + unrelated 1planly.com + ZENKAI post).

## P2 — Auth enforcement (OBSERVED labels + Skip targets; step + OAuth-target NOT-OBSERVED)

/planly landing (no auth block): `Get a personal roadmap built around your goals`,
`Create my plan / Takes less than 3 minutes`, `[Log in / Sign up](/get-started?next=%2Fplanly)`.
/planly/draft Step 1 renders unauthenticated (full Q1-Q4 + Step 1 of 6 + Next),
`[Log in / Sign up](/get-started?next=%2Fplanly%2Fdraft)`.
/get-started variants: `Welcome 👋 Let's Get Started! / Email / Continue (disabled) / or /
Continue with Google / OTP Login: 1-Day session / • / Google Login: 30-Day session /
Skip and continue to [Planly](/planly)` — Skip preserves next= (/planly, /planly/draft, /dashboard all observed).
Enforcement step (>= Step 2 or save/generate) NOT-OBSERVED; OAuth redirect targets NOT-OBSERVED.

## P4 — Generate contract ( trigger labels OBSERVED; payload/schema NOT-OBSERVED, gated)

E1 trigger: `Create my plan` + `Takes less than 3 minutes` (/planly @19:39:57Z).
E2 value prop: `Get a personal roadmap built around your goals` /
`Learn, don't just read. Every Planly task comes with a curated video & expert editorial`.
E3 7-step labels: `About you / Understanding your goals / Personalised weekly sprints /
Solve & Practice / Track your time / Progress tracker / Missed a Day/Task?` +
`Tell Planly who you are. It builds the plan around you.`
E4 payload/latency: NOT-OBSERVED (login-gated, no bypass attempted).
E5 Sprint/Daily schema: NOT-OBSERVED (labels only).
E6 missed-day: label `Missed a Day/Task?` only.
E7 edit/readjust: NOT-OBSERVED (community: code-editor read-only complaint is task-editor, not plan edit).
E9 token cost: single user claim (no charge for plan creation; check Account -> Plan Details) — hypothesis only.
E10 horizon: 2–12mo NOT a plan field — only subscription validity copy
(Basic/Core/Max 12/24/48/Lifetime, Company PASS 2 Months, subject PASSes 12 Months).
FORBID modeling horizon as contract field.
