import { en, type Strings } from './en';
import { hi } from './hi';

export type Locale = 'en' | 'hi';

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
];

const locales: Record<Locale, Strings> = { en, hi };

/** Active UI strings. Screens read S during render, so a re-render picks up a language change. */
export let S: Strings = en;

export function setLocale(code: Locale | undefined): void {
  S = locales[code ?? 'en'] ?? en;
}
