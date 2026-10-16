import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_WATER_GOAL_ML,
  clampWaterGoalMl,
  generateWeeklyPlan,
  localISODate,
  mondayOf,
  suggestedWaterGoalMl,
  weekdayOf,
  type MealEntry,
  type Profile,
  type WaterEntry,
  type WeeklyPlan,
  type WorkoutLog,
} from '@reppilot/core';
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';

export interface ChatMessage {
  id: string;
  from: 'user' | 'coach';
  text: string;
  kind?: string;
}

export interface AppState {
  version: 1;
  profile?: Profile;
  plan?: WeeklyPlan;
  /** Previous weeks' plans, newest first (kept for the auditable change history). */
  pastPlans: WeeklyPlan[];
  logs: WorkoutLog[];
  meals: MealEntry[];
  water: WaterEntry[];
  waterGoalMl: number;
  chat: ChatMessage[];
}

const STORAGE_KEY = 'reppilot:v1';
const MAX_PAST_PLANS = 12;
const MAX_CHAT = 100;

export const initialState: AppState = {
  version: 1,
  pastPlans: [],
  logs: [],
  meals: [],
  water: [],
  waterGoalMl: DEFAULT_WATER_GOAL_ML,
  chat: [],
};

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'setProfile'; profile: Profile; today: string }
  | { type: 'ensureWeek'; today: string }
  | { type: 'replacePlan'; plan: WeeklyPlan }
  | { type: 'saveWorkout'; log: WorkoutLog }
  | { type: 'addMeal'; entry: MealEntry }
  | { type: 'removeMeal'; id: string }
  | { type: 'addWater'; entry: WaterEntry }
  | { type: 'undoWater'; date: string }
  | { type: 'setWaterGoal'; ml: number }
  | { type: 'addChat'; messages: ChatMessage[] }
  | { type: 'clearChat' }
  | { type: 'reset' };

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * When the profile changes mid-week, regenerate the plan but keep every
 * session that is already done or skipped, and anything earlier in the week.
 */
function replanKeepingHistory(old: WeeklyPlan | undefined, profile: Profile, today: string): WeeklyPlan {
  const weekStart = mondayOf(today);
  const fresh = generateWeeklyPlan(profile, { weekStart });
  if (!old || old.weekStart !== weekStart) return fresh;
  const todayDay = weekdayOf(today);
  const kept = old.sessions.filter((s) => s.status !== 'planned' || s.day < todayDay);
  const keptDays = new Set(kept.map((s) => s.day));
  const upcoming = fresh.sessions.filter((s) => s.day >= todayDay && !keptDays.has(s.day));
  return {
    weekStart,
    sessions: [...kept, ...upcoming].sort((a, b) => a.day - b.day),
    changeLog: [...old.changeLog, { at: today, description: 'Plan updated after you changed your profile.' }],
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'setProfile': {
      const firstTime = !state.profile;
      return {
        ...state,
        profile: action.profile,
        plan: replanKeepingHistory(state.plan, action.profile, action.today),
        waterGoalMl: firstTime ? suggestedWaterGoalMl(action.profile.bodyWeightKg) : state.waterGoalMl,
      };
    }
    case 'ensureWeek': {
      if (!state.profile) return state;
      const weekStart = mondayOf(action.today);
      if (state.plan?.weekStart === weekStart) return state;
      return {
        ...state,
        plan: generateWeeklyPlan(state.profile, { weekStart }),
        pastPlans: state.plan ? [state.plan, ...state.pastPlans].slice(0, MAX_PAST_PLANS) : state.pastPlans,
      };
    }
    case 'replacePlan':
      return { ...state, plan: action.plan };
    case 'saveWorkout': {
      // Upsert by session + date so saving twice never creates duplicate logs.
      const { log } = action;
      const others = state.logs.filter(
        (l) => !(log.sessionId && l.sessionId === log.sessionId && l.date === log.date) && l.id !== log.id,
      );
      const plan =
        state.plan && log.sessionId
          ? {
              ...state.plan,
              sessions: state.plan.sessions.map((s) => (s.id === log.sessionId ? { ...s, status: 'completed' as const } : s)),
            }
          : state.plan;
      return { ...state, logs: [...others, log].sort((a, b) => a.date.localeCompare(b.date)), plan };
    }
    case 'addMeal':
      return { ...state, meals: [...state.meals, action.entry] };
    case 'removeMeal':
      return { ...state, meals: state.meals.filter((m) => m.id !== action.id) };
    case 'addWater':
      return { ...state, water: [...state.water, action.entry] };
    case 'undoWater': {
      const idx = state.water.map((w) => w.date).lastIndexOf(action.date);
      if (idx < 0) return state;
      return { ...state, water: state.water.filter((_, i) => i !== idx) };
    }
    case 'setWaterGoal':
      return { ...state, waterGoalMl: clampWaterGoalMl(action.ml) };
    case 'addChat':
      return { ...state, chat: [...state.chat, ...action.messages].slice(-MAX_CHAT) };
    case 'clearChat':
      return { ...state, chat: [] };
    case 'reset':
      return initialState;
  }
}

interface StoreValue {
  state: AppState;
  dispatch: (a: Action) => void;
  ready: boolean;
  today: string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);
  const today = localISODate();

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as AppState;
            if (parsed.version === 1) dispatch({ type: 'hydrate', state: { ...initialState, ...parsed } });
          } catch {
            // Corrupt storage: start fresh rather than crash.
          }
        }
      })
      .finally(() => {
        if (cancelled) return;
        dispatch({ type: 'ensureWeek', today: localISODate() });
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  // Roll over to a new weekly plan when the week changes while the app is open.
  useEffect(() => {
    if (ready) dispatch({ type: 'ensureWeek', today });
  }, [today, ready]);

  const value = useMemo(() => ({ state, dispatch, ready, today }), [state, today, ready]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}

export async function wipeStorage(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
