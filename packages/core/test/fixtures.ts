import type { Profile } from '../src';

export const gymProfile: Profile = {
  name: 'Asha',
  goal: 'muscle_growth',
  experience: 'intermediate',
  trainingDays: [0, 2, 4],
  sessionMinutes: 60,
  equipment: [
    'dumbbell', 'barbell', 'bench', 'squat_rack', 'pullup_bar', 'cable',
    'chest_press_machine', 'lat_pulldown_machine', 'seated_row_machine',
    'leg_press_machine', 'leg_extension_machine', 'leg_curl_machine', 'shoulder_press_machine',
  ],
  limitations: [],
  diet: 'vegetarian',
  bodyWeightKg: 70,
};

export const homeBeginner: Profile = {
  name: 'Ravi',
  goal: 'general_fitness',
  experience: 'beginner',
  trainingDays: [1, 3, 5],
  sessionMinutes: 30,
  equipment: [],
  limitations: [],
  diet: 'vegan',
};

export const WEEK = '2026-10-12'; // a Monday
