import { en } from "./en.js";

export const localeResources = {
  en: { translation: en },
} as const;

export const DEFAULT_LOCALE = "en" as const;
export type SupportedLocale = keyof typeof localeResources;
