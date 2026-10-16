import type { FormCheckExercise } from './types';

/**
 * Rule-based form feedback on pose landmarks (MediaPipe Pose 33-point
 * layout, normalised image coordinates with y pointing down).
 *
 * This only checks a few visible movement characteristics. It cannot tell
 * which muscle, bone or joint carries the load and is not a medical or expert
 * assessment. Every result carries a confidence level and the app must say
 * when the camera cannot judge the movement.
 */

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseFrame {
  /** Milliseconds since recording started. */
  t: number;
  landmarks: Landmark[];
}

export const LM = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

type Side = 'left' | 'right';

const SIDE_POINTS: Record<Side, { shoulder: number; elbow: number; wrist: number; hip: number; knee: number; ankle: number }> = {
  left: { shoulder: LM.leftShoulder, elbow: LM.leftElbow, wrist: LM.leftWrist, hip: LM.leftHip, knee: LM.leftKnee, ankle: LM.leftAnkle },
  right: { shoulder: LM.rightShoulder, elbow: LM.rightElbow, wrist: LM.rightWrist, hip: LM.rightHip, knee: LM.rightKnee, ankle: LM.rightAnkle },
};

type PointName = keyof (typeof SIDE_POINTS)['left'];

const REQUIRED: Record<FormCheckExercise, PointName[]> = {
  squat: ['shoulder', 'hip', 'knee', 'ankle'],
  pushup: ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'],
};

export const FORM_DISCLAIMER =
  'This is an estimate from your camera, not an expert or medical assessment. It cannot see which muscles or joints are working ' +
  'and cannot guarantee an exercise is safe. Stop if you feel pain, dizziness or anything unusual.';

export const CAMERA_SETUP_TIPS = [
  'Place the phone at hip height, about 2–3 metres away.',
  'Film from the side so your whole body is in view, head to feet.',
  'Use good lighting and avoid a bright window behind you.',
  'Wear clothes that contrast with the background.',
];

/** Angle ABC in degrees, at point B. */
export function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (mag === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

/** Angle of the hip→shoulder line from vertical, in degrees (0 = upright). */
export function torsoLeanDeg(shoulder: Landmark, hip: Landmark): number {
  const dx = shoulder.x - hip.x;
  const dy = hip.y - shoulder.y;
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
}

const MIN_VISIBILITY = 0.5;
const MIN_FRAMES = 15;

export interface RepDetail {
  index: number;
  startT: number;
  endT: number;
  /** Smallest knee angle (squat) or elbow angle (push-up) in the rep. */
  bottomAngle: number;
  issues: string[];
}

export interface FormCue {
  id: string;
  message: string;
  severity: 'tip' | 'fix';
  /** 1-based rep numbers where it was seen. */
  reps: number[];
}

export interface FormResult {
  exercise: FormCheckExercise;
  assessable: boolean;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  reps: number;
  repDetails: RepDetail[];
  cues: FormCue[];
  /** Camera/visibility problems to fix before trusting the result. */
  setupIssues: string[];
  summary: string;
  disclaimer: string;
}

function visibility(l: Landmark | undefined): number {
  if (!l) return 0;
  const inFrame = l.x >= -0.02 && l.x <= 1.02 && l.y >= -0.02 && l.y <= 1.02;
  return inFrame ? (l.visibility ?? 1) : 0;
}

function pickSide(frames: PoseFrame[], names: PointName[]): Side {
  const score = (side: Side) =>
    frames.reduce((t, f) => t + names.reduce((s, n) => s + visibility(f.landmarks[SIDE_POINTS[side][n]]), 0), 0);
  return score('left') >= score('right') ? 'left' : 'right';
}

const CUE_TEXT: Record<string, { message: string; severity: 'tip' | 'fix' }> = {
  shallow_squat: { message: 'Try to squat a little deeper if it feels comfortable — aim for your thighs to get closer to parallel.', severity: 'tip' },
  forward_lean: { message: 'Keep your chest up a bit more as you go down.', severity: 'fix' },
  shallow_pushup: { message: 'Lower your chest a bit further on each rep.', severity: 'tip' },
  hips_sag: { message: 'Keep your hips in line with your body — squeeze your stomach and glutes.', severity: 'fix' },
  too_fast: { message: 'Slow down — take about 2 seconds to lower each rep.', severity: 'tip' },
};

const RULES = {
  squat: { enter: 140, exit: 155, shallowAbove: 110, maxLean: 55 },
  pushup: { enter: 130, exit: 150, shallowAbove: 110, minBodyLine: 155 },
  /** Time from leaving the top position to returning to it. */
  minRepMs: 800,
};

export function analyzeForm(exercise: FormCheckExercise, frames: PoseFrame[]): FormResult {
  const names = REQUIRED[exercise];
  const side = pickSide(frames, names);
  const pts = SIDE_POINTS[side];
  const setupIssues: string[] = [];

  const usable = frames.filter((f) => names.every((n) => visibility(f.landmarks[pts[n]]) >= MIN_VISIBILITY));
  const avgVis =
    frames.length === 0
      ? 0
      : frames.reduce((t, f) => t + names.reduce((s, n) => s + visibility(f.landmarks[pts[n]]), 0) / names.length, 0) /
        frames.length;
  const usableRatio = frames.length ? usable.length / frames.length : 0;
  const confidenceScore = Math.round(avgVis * usableRatio * 100) / 100;

  if (frames.length < MIN_FRAMES) setupIssues.push('The recording is too short. Record at least 3 full reps.');
  const outOfFrame = frames.some((f) => names.some((n) => {
    const l = f.landmarks[pts[n]];
    return !!l && (l.x < -0.02 || l.x > 1.02 || l.y < -0.02 || l.y > 1.02);
  }));
  if (outOfFrame) setupIssues.push('Part of your body went out of view. Step back so your whole body stays in the frame.');
  if (frames.length >= MIN_FRAMES && avgVis < 0.6) {
    setupIssues.push('The camera could not see you clearly. Improve the lighting and film from the side.');
  }

  // Rep detection with hysteresis on the main joint angle.
  const rules = exercise === 'squat' ? RULES.squat : RULES.pushup;
  const repDetails: RepDetail[] = [];
  let inRep = false;
  let lastTopT = usable[0]?.t ?? 0;
  let cur: { startT: number; bottom: number; bottomFrame: PoseFrame; minBodyLine: number } | null = null;

  for (const f of usable) {
    const L = (n: PointName) => f.landmarks[pts[n]]!;
    const main = exercise === 'squat' ? angleDeg(L('hip'), L('knee'), L('ankle')) : angleDeg(L('shoulder'), L('elbow'), L('wrist'));
    const bodyLine = exercise === 'pushup' ? angleDeg(L('shoulder'), L('hip'), L('ankle')) : 180;

    if (!inRep && main > rules.exit) {
      lastTopT = f.t;
    } else if (!inRep && main < rules.enter) {
      inRep = true;
      cur = { startT: lastTopT, bottom: main, bottomFrame: f, minBodyLine: bodyLine };
    } else if (inRep && cur) {
      if (main < cur.bottom) {
        cur.bottom = main;
        cur.bottomFrame = f;
      }
      cur.minBodyLine = Math.min(cur.minBodyLine, bodyLine);
      if (main > rules.exit) {
        const issues: string[] = [];
        if (cur.bottom > rules.shallowAbove) issues.push(exercise === 'squat' ? 'shallow_squat' : 'shallow_pushup');
        if (exercise === 'squat') {
          const b = cur.bottomFrame.landmarks;
          if (torsoLeanDeg(b[pts.shoulder]!, b[pts.hip]!) > RULES.squat.maxLean) issues.push('forward_lean');
        } else if (cur.minBodyLine < RULES.pushup.minBodyLine) {
          issues.push('hips_sag');
        }
        if (f.t - cur.startT < RULES.minRepMs) issues.push('too_fast');
        repDetails.push({ index: repDetails.length + 1, startT: cur.startT, endT: f.t, bottomAngle: Math.round(cur.bottom), issues });
        inRep = false;
        cur = null;
      }
    }
  }

  if (repDetails.length === 0 && frames.length >= MIN_FRAMES) {
    setupIssues.push('No complete reps were detected. Make sure the camera sees the full movement from the side.');
  }

  const cueMap = new Map<string, number[]>();
  for (const r of repDetails) for (const i of r.issues) cueMap.set(i, [...(cueMap.get(i) ?? []), r.index]);
  // Report an issue only if it shows up in at least a third of reps, to avoid
  // nagging about one-off noise.
  const minReps = Math.max(1, Math.ceil(repDetails.length / 3));
  const cues: FormCue[] = [...cueMap.entries()]
    .filter(([, reps]) => reps.length >= minReps)
    .map(([id, reps]) => ({ id, ...CUE_TEXT[id]!, reps }))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'fix' ? -1 : 1));

  const confidence: FormResult['confidence'] = confidenceScore >= 0.8 ? 'high' : confidenceScore >= 0.6 ? 'medium' : 'low';
  const assessable = usable.length >= MIN_FRAMES && confidenceScore >= 0.5 && repDetails.length > 0;

  let summary: string;
  if (!assessable) summary = 'We could not check your form reliably this time. Fix the camera tips below and try again.';
  else if (cues.length === 0) summary = `Counted ${repDetails.length} reps. Nothing to fix on the points we can check (depth, ${exercise === 'squat' ? 'chest position' : 'body line'} and speed).`;
  else summary = `Counted ${repDetails.length} reps. ${cues.length === 1 ? 'One thing' : `${cues.length} things`} to work on.`;

  return {
    exercise,
    assessable,
    confidence,
    confidenceScore,
    reps: repDetails.length,
    repDetails,
    cues: assessable ? cues : [],
    setupIssues,
    summary,
    disclaimer: FORM_DISCLAIMER,
  };
}
