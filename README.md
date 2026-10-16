# RepPilot

An AI-assisted fitness companion for gym-goers: personalised weekly plans, equipment-aware exercise swaps, missed-session rescheduling, muscle-coverage tracking, nutrition and water logging, a constrained fitness coach, and a camera form check that is honest about what it can and cannot see.

This repository holds the **Phase 1 MVP** described in the RepPilot PRD v1.0. It runs entirely on the device, with sample data, no backend and no paid APIs.

## Repository layout

```
packages/core   Deterministic training engine (TypeScript, no UI). Unit-tested.
apps/mobile     Expo / React Native app (Android, iOS, web) built on core.
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

Nothing in core uses randomness or a language model, so the same input always gives the same plan.

### `apps/mobile`

Tabs: **Plan**, **Exercises**, **Progress**, **Food**, **Coach**. Other screens: onboarding, workout logging, exercise detail, form check and profile.

- Onboarding has an 18+ gate (the PRD calls for an adult-only pilot) and collects only what the plan needs.
- Workout screen: log reps and weight, swap an exercise (with reasons), or report a missed workout. You see the proposed change and approve it before anything is saved. Every change goes into "What changed in your plan".
- Data is stored on the device (AsyncStorage). Profile → "Delete all my data" wipes it.
- Large touch targets and simple wording. All UI text is in `src/i18n/en.ts`, so adding Hindi means adding one file of the same shape.
- **Camera form check**
  - **Web:** fully working. MediaPipe Pose Landmarker runs in the browser and the video never leaves the device; only the model files are downloaded.
  - **Native:** camera preview for positioning plus a manual self-check. Live pose analysis on native needs an on-device pose module in a development build (see next steps).

## Running it

Requires Node 20+.

```bash
npm install
npm test            # core engine unit tests
npm run typecheck   # core + app
npm run web         # open the app in a browser (camera form check works here)
npm start           # Expo dev server — scan the QR code with Expo Go on a phone
```

To build a static web version: `cd apps/mobile && npx expo export --platform web` (output goes to `apps/mobile/dist`).

## Safety design

- Plans come from fixed rules and a curated library. The chatbot does not invent exercises or prescriptions.
- The coach stops and redirects on chest pain, dizziness, injury, medication and supplement doses, and extreme dieting.
- Form feedback states its confidence, refuses to judge when visibility is poor, and says it cannot see which muscles or joints take the load.
- Missed workouts never double the volume. Rest days never break streaks. Ranks are described as consistency, not fitness or worth.
- Water goals are capped and come with a warning against over-drinking. Nutrition values are labelled as estimates.

## Not in this MVP (by design, per the PRD roadmap)

- Social feed, friends, messaging, video sharing, leaderboards and moderation (Phase 4). The PRD requires moderation, reporting and appeals to exist *before* any uploads are allowed.
- Cloud accounts and sync. The FastAPI + PostgreSQL backend in the PRD is not needed for a local-first pilot.
- Billing.

## Suggested next steps

1. **Trainer review** of the exercise library, prescription rules (`planner.ts`) and form thresholds (`form.ts`) before any public pilot. Build the labelled video evaluation set the PRD asks for.
2. **Native pose detection**: add an on-device MediaPipe pose module to an Expo development build and feed its landmarks into the existing `analyzeForm`.
3. Hindi strings (`src/i18n/hi.ts`), then voice-friendly instructions and demonstration media.
4. An optional LLM behind the existing `reply()` interface, grounded on the same library and keeping the safety pre-checks.
5. Product analytics for the PRD success metrics (onboarding completion, first workout, week-4 retention).
