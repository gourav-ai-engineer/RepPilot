import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_WATER_GOAL_ML,
  clampWaterGoalMl,
  generateWeeklyPlan,
  localISODate,
  mergeSyncData,
  mondayOf,
  suggestedWaterGoalMl,
  weekdayOf,
  type MealEntry,
  type Profile,
  type SyncData,
  type WaterEntry,
  type WeeklyPlan,
  type WorkoutLog,
} from '@reppilot/core';
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import type { Me } from '../api/client';
import { setLocale, type Locale } from '../i18n';

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
  /** When synced data (profile, plans, logs, food, water) last changed on this device. */
  dataUpdatedAt: string;
  account?: { token: string; user: Me };
  sync: SyncMeta;
  reminders: Reminders;
  locale: Locale;
}

export interface SyncMeta {
  version: number;
  lastSyncedAt?: string;
  status: 'idle' | 'syncing' | 'error';
  error?: string;
}

export interface Reminders {
  workout: boolean;
  /** Hour of day (0–23) for workout reminders on training days. */
  workoutHour: number;
  water: boolean;
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
  dataUpdatedAt: new Date(0).toISOString(),
  sync: { version: 0, status: 'idle' },
  reminders: { workout: false, workoutHour: 18, water: false },
  locale: 'en',
};

export function toSyncData(s: AppState): SyncData {
  return {
    updatedAt: s.dataUpdatedAt,
    profile: s.profile,
    plan: s.plan,
    pastPlans: s.pastPlans,
    logs: s.logs,
    meals: s.meals,
    water: s.water,
    waterGoalMl: s.waterGoalMl,
  };
}

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
  | { type: 'setAccount'; account: { token: string; user: Me } }
  | { type: 'updateUser'; user: Me }
  | { type: 'logout' }
  | { type: 'setSync'; patch: Partial<SyncMeta> }
  | { type: 'applySynced'; data: SyncData; version: number }
  | { type: 'setReminders'; reminders: Reminders }
  | { type: 'setLocale'; locale: Locale }
  | { type: 'reset' };

/** Actions that change data which is backed up to the account. */
const SYNCED_ACTIONS = new Set<Action['type']>([
  'setProfile', 'ensureWeek', 'replacePlan', 'saveWorkout', 'addMeal', 'removeMeal', 'addWater', 'undoWater', 'setWaterGoal',
]);

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
  const next = baseReducer(state, action);
  if (next !== state && SYNCED_ACTIONS.has(action.type)) return { ...next, dataUpdatedAt: new Date().toISOString() };
  return next;
}

function baseReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      setLocale(action.state.locale);
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
    case 'setAccount':
      return { ...state, account: action.account, sync: { version: 0, status: 'idle' } };
    case 'updateUser':
      return state.account ? { ...state, account: { ...state.account, user: action.user } } : state;
    case 'logout':
      return { ...state, account: undefined, sync: { version: 0, status: 'idle' } };
    case 'setSync':
      return { ...state, sync: { ...state.sync, ...action.patch } };
    case 'applySynced': {
      // Changes made on this device while the sync was in flight are merged in, not lost.
      const current = toSyncData(state);
      const d = current.updatedAt > action.data.updatedAt ? mergeSyncData(current, action.data) : action.data;
      return {
        ...state,
        profile: d.profile,
        plan: d.plan,
        pastPlans: d.pastPlans,
        logs: d.logs,
        meals: d.meals,
        water: d.water,
        waterGoalMl: d.waterGoalMl,
        dataUpdatedAt: d.updatedAt,
        sync: { version: action.version, status: 'idle', lastSyncedAt: new Date().toISOString() },
      };
    }
    case 'setReminders':
      return { ...state, reminders: action.reminders };
    case 'setLocale':
      setLocale(action.locale);
      return { ...state, locale: action.locale };
    case 'reset':
      setLocale('en');
      return { ...initialState, dataUpdatedAt: new Date().toISOString() };
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
            if (parsed.version === 1) {
              dispatch({
                type: 'hydrate',
                state: { ...initialState, ...parsed, sync: { ...initialState.sync, ...parsed.sync, status: 'idle' } },
              });
            }
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
