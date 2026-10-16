import type { Diet, Equipment, Experience, Goal, Limitation, MovementPattern, Muscle, Weekday } from './types';

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest',
  upper_back: 'Upper back',
  lats: 'Lats (side of back)',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  core: 'Core (stomach)',
  lower_back: 'Lower back',
  glutes: 'Glutes (hips)',
  quads: 'Quads (front of thigh)',
  hamstrings: 'Hamstrings (back of thigh)',
  calves: 'Calves',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  bodyweight: 'No equipment',
  dumbbell: 'Dumbbells',
  barbell: 'Barbell',
  bench: 'Bench',
  squat_rack: 'Squat rack',
  pullup_bar: 'Pull-up bar',
  cable: 'Cable machine',
  chest_press_machine: 'Chest press machine',
  lat_pulldown_machine: 'Lat pulldown machine',
  seated_row_machine: 'Seated row machine',
  leg_press_machine: 'Leg press machine',
  leg_extension_machine: 'Leg extension machine',
  leg_curl_machine: 'Leg curl machine',
  shoulder_press_machine: 'Shoulder press machine',
  kettlebell: 'Kettlebell',
  resistance_band: 'Resistance band',
};

export const PATTERN_LABELS: Record<MovementPattern, string> = {
  horizontal_push: 'pushing forward',
  vertical_push: 'pushing overhead',
  horizontal_pull: 'rowing (pulling towards you)',
  vertical_pull: 'pulling down from above',
  squat: 'squatting',
  hinge: 'bending at the hips',
  lunge: 'single-leg work',
  elbow_flexion: 'bending the elbow (curl)',
  elbow_extension: 'straightening the elbow',
  shoulder_isolation: 'shoulder raise',
  knee_extension: 'straightening the knee',
  knee_flexion: 'bending the knee',
  calf_raise: 'rising onto the toes',
  core_stability: 'holding the core steady',
  core_flexion: 'curling the core',
};

export const GOAL_LABELS: Record<Goal, string> = {
  strength: 'Get stronger',
  muscle_growth: 'Build muscle',
  general_fitness: 'General fitness',
  endurance: 'Endurance / stamina',
};

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  beginner: 'New (under 6 months)',
  intermediate: 'Some experience (6 months – 2 years)',
  advanced: 'Experienced (2+ years)',
};

export const LIMITATION_LABELS: Record<Limitation, string> = {
  knee: 'Knee discomfort',
  lower_back: 'Lower back discomfort',
  shoulder: 'Shoulder discomfort',
  wrist: 'Wrist discomfort',
};

export const DIET_LABELS: Record<Diet, string> = {
  vegetarian: 'Vegetarian',
  eggetarian: 'Vegetarian + eggs',
  non_vegetarian: 'Non-vegetarian',
  vegan: 'Vegan',
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: 'Monday',
  1: 'Tuesday',
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
  6: 'Sunday',
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: 'Mon',
  1: 'Tue',
  2: 'Wed',
  3: 'Thu',
  4: 'Fri',
  5: 'Sat',
  6: 'Sun',
};

export function listMuscles(muscles: Muscle[]): string {
  return muscles.map((m) => MUSCLE_LABELS[m].replace(/ \(.*\)$/, '').toLowerCase()).join(', ');
}
