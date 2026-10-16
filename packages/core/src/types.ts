export const MUSCLES = [
  'chest',
  'upper_back',
  'lats',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'lower_back',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'shoulder_isolation'
  | 'knee_extension'
  | 'knee_flexion'
  | 'calf_raise'
  | 'core_stability'
  | 'core_flexion';

export const EQUIPMENT = [
  'bodyweight',
  'dumbbell',
  'barbell',
  'bench',
  'squat_rack',
  'pullup_bar',
  'cable',
  'chest_press_machine',
  'lat_pulldown_machine',
  'seated_row_machine',
  'leg_press_machine',
  'leg_extension_machine',
  'leg_curl_machine',
  'shoulder_press_machine',
  'kettlebell',
  'resistance_band',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export type Goal = 'strength' | 'muscle_growth' | 'general_fitness' | 'endurance';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Limitation = 'knee' | 'lower_back' | 'shoulder' | 'wrist';
export type Diet = 'vegetarian' | 'eggetarian' | 'non_vegetarian' | 'vegan';

/** 0 = Monday ... 6 = Sunday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Exercise {
  id: string;
  name: string;
  pattern: MovementPattern;
  primary: Muscle[];
  secondary: Muscle[];
  /** All of these are required to perform the exercise. */
  equipment: Equipment[];
  /** 1 = beginner-friendly, 2 = intermediate, 3 = advanced */
  difficulty: 1 | 2 | 3;
  compound: boolean;
  instructions: string[];
  cues: string[];
  /** Self-reported limitations for which this exercise is not suggested by default. */
  avoidWith: Limitation[];
  /** Whether the camera form coach has rules for this exercise. */
  formCheck?: FormCheckExercise;
}

export type FormCheckExercise = 'squat' | 'pushup';

export interface Profile {
  name: string;
  goal: Goal;
  experience: Experience;
  trainingDays: Weekday[];
  sessionMinutes: number;
  equipment: Equipment[];
  limitations: Limitation[];
  diet: Diet;
  bodyWeightKg?: number;
  /** Exercise ids the user prefers not to do. */
  dislikedExercises?: string[];
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
  note?: string;
}

export type SessionStatus = 'planned' | 'completed' | 'skipped';

export interface Session {
  id: string;
  day: Weekday;
  title: string;
  exercises: PlannedExercise[];
  status: SessionStatus;
  warmup: string[];
  cooldown: string[];
}

export interface PlanChange {
  at: string;
  description: string;
}

export interface WeeklyPlan {
  /** ISO date (YYYY-MM-DD) of the Monday this plan starts on. */
  weekStart: string;
  sessions: Session[];
  changeLog: PlanChange[];
}

export interface LoggedSet {
  reps: number;
  weightKg?: number;
}

export interface LoggedExercise {
  exerciseId: string;
  sets: LoggedSet[];
}

export interface WorkoutLog {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  sessionId?: string;
  entries: LoggedExercise[];
}
