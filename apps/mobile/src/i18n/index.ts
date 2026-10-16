import { en, type Strings } from './en';

const locales: Record<string, Strings> = { en };

/** Active UI strings. Language switching can be added here without changing screens. */
export let S: Strings = en;

export function setLocale(code: string): void {
  S = locales[code] ?? en;
}
