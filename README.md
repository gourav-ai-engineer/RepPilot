# RepPilot

An AI-assisted fitness companion for gym-goers: personalised weekly plans, equipment-aware exercise swaps, missed-session rescheduling, muscle-coverage tracking, nutrition and water logging, a constrained fitness coach, a camera form check that is honest about what it can and cannot see, and a moderated fitness community with friends, messages, challenges and leaderboards.

This repository implements the features in the RepPilot PRD v1.0. Training, food and the coach work offline on the device. An optional account adds cloud backup and the community. No paid APIs are used.

## Repository layout

```
packages/core   Deterministic training engine (TypeScript, no UI). Unit-tested.
apps/mobile     Expo / React Native app (Android, iOS, web) built on core.
apps/api        FastAPI backend: accounts, sync, community, messages, challenges, moderation. See apps/api/README.md.
```

### `@reppilot/core`

| Module | What it does | PRD |
| --- | --- | --- |
| `exercises.ts` | Curated library of 53 exercises, each with primary and secondary muscles, movement pattern, equipment, difficulty, plain-language steps, cues and limitation flags | FR-02, FR-03 |
| `planner.ts` | Rule-based weekly plan: split chosen by number of training days, filtered by equipment, experience and limitations, sized to session length. Explicit set/rep/rest rules per goal and level. Always keeps one rest day | FR-01, FR-02 |
| `substitution.ts` | Ranks alternatives by movement pattern, muscle overlap, equipment, difficulty and limitations. Returns *why* each was chosen and *how it differs* | FR-05 |
| `schedule.ts` | Missed session: move it to a safe day (no stacking, no similar sessions back to back, no runs longer than the plan already has) or skip it. Adds at most one short exercise for muscles that would otherwise go untrained. Returns a proposal for the user to approve | FR-06 |
| `coverage.ts` | Weighted sets per muscle across the week; flags neglected major muscle groups | FR-03 |
| `progress.ts` | Personal records, week streaks (rest never breaks them), points, ranks Recruit → Champion, badges | FR-11, FR-12 |
| `nutrition.ts`, `hydration.ts` | Indian-familiar food list with estimates, diet filtering, protein range, capped water goals, general vitamin and mineral information | FR-07, FR-08 |
| `chatbot.ts` | Rule-based coach grounded in the library and the user's plan. Safety checks run first (emergency symptoms, pain, medical, extreme dieting, unsafe lifting) | FR-09 |
| `form.ts` | Form rules on MediaPipe pose landmarks for squats and push-ups: rep counting, depth, torso lean, hip sag and tempo, with confidence levels and a "cannot assess" outcome | FR-04 |
| `sync.ts` | Merges data from two devices without losing workouts, meals or water | Reliability |

Nothing in core uses randomness or a language model, so the same input always gives the same plan.

### `apps/mobile`

Tabs: **Plan**, **Exercises**, **Social**, **Progress**, **Food**, **Coach**.

- **Onboarding** has an 18+ gate (adult-only pilot) and collects only what the plan needs.
- **Workouts:** log reps and weight, swap an exercise (with reasons), or report a missed workout. You approve proposed changes before they are saved, and every change goes into "What changed in your plan".
- **Account and sync (optional):** back up to the server and use it on several devices. Changes made offline are merged, never overwritten. On logout you choose whether to keep data on the device. Accounts can be deleted from the app.
- **Social:**
  - Feed (friends / everyone / mine) with posts, likes and comments
  - Photo and video posts that stay hidden until a moderator approves them
  - Friend search and requests, blocking, friends-only messages
  - Reporting on posts, comments and messages
  - A screen showing every moderation decision about you, with appeals
- **Challenges:** push-ups, pull-ups, plank, squats, a bench 5-rep best (never a one-rep max) and a consistency week. Leaderboards have experience divisions, a friends view, a "most improved" mode and an opt-out.
- **Moderator screen:** review queue (high priority first), approve / remove / warn / suspend / close account, appeals and safety metrics. Moderators are set by email in the API config.
- **Reminders** (phone app): workout reminders on training days only, and up to 4 water nudges a day. Both are off by default.
- **Languages:** English and Hindi (Profile → Language). The Hindi strings in `src/i18n/hi.ts` are a first draft. Exercise, food and coach content is still English.
- **Camera form check:** the MediaPipe pose model runs on the device and the video is never uploaded.
  - **Web:** runs in the browser.
  - **Phone:** runs inside a WebView with the same model.
  - The landmarks are scored by `@reppilot/core` on both. If the camera can't start, a manual self-check is offered.

## Running it

Requires Node 20+ and Python 3.11+.

```bash
# Backend (needed for accounts and Social; the rest of the app works without it)
cd apps/api && python -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
MODERATOR_EMAILS=you@example.com uvicorn reppilot_api.main:app --reload --port 8000

# App (from the repository root, in another terminal)
npm install
npm run web         # opens in a browser
npm start           # Expo dev server — scan the QR code with Expo Go
```

The app talks to `http://localhost:8000` by default. Set `EXPO_PUBLIC_API_URL` to point it at a deployed server. On a real phone, use your computer's LAN IP or a public URL, not localhost.

Tests:

```bash
npm test                                   # core engine (vitest)
npm run typecheck                          # core + app
cd apps/api && pytest                      # backend
```

To build a static web version: `cd apps/mobile && npx expo export --platform web` (output goes to `apps/mobile/dist`).

## Safety design

- Plans come from fixed rules and a curated library. The chatbot does not invent exercises or prescriptions.
- The coach stops and redirects on chest pain, dizziness, injury, medication and supplement doses, and extreme dieting.
- Form feedback states its confidence, refuses to judge when visibility is poor, and says it cannot see which muscles or joints take the load.
- Missed workouts never double the volume. Rest days never break streaks. Ranks are described as consistency, not fitness or worth.
- Water goals are capped and come with a warning against over-drinking. Nutrition values are labelled as estimates.

- Community safety: see [apps/api/README.md](apps/api/README.md#safety-model). It covers screening, human review of all media, report thresholds, strikes, suspensions, appeals to a second moderator, blocking and rate limits.

## Before a public launch

1. **Trainer review** of the exercise library, prescription rules (`planner.ts`), form thresholds (`form.ts`) and challenge rules. Build the labelled video evaluation set the PRD asks for.
2. **Test on real phones.** The camera form check in the Android/iOS WebView and the notification reminders were built against the libraries' APIs, but have only been exercised in a desktop browser.
3. **Native speaker review** of the Hindi text, and translation of exercise, food and coach content.
4. **Production server:** PostgreSQL, a strong `JWT_SECRET`, HTTPS, object storage for media, shared rate limiting (Redis), database migrations and backups. Text screening is keyword-based; consider a moderation service once there is traffic. A legal and privacy review (India's DPDP Act) is also needed.
5. **Billing** is not built. The PRD says to validate willingness to pay first.
6. Product analytics for the PRD success metrics (onboarding completion, first workout, week-4 retention).
