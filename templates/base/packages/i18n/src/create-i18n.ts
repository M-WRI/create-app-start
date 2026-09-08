import i18n, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE, type SupportedLocale, localeResources } from "./locales/index.js";

export type CreateI18nOptions = {
  locale?: SupportedLocale;
  debug?: boolean;
};

export async function createI18n(options: CreateI18nOptions = {}): Promise<I18nInstance> {
  const instance = i18n.createInstance();
  await instance.use(initReactI18next).init({
    resources: localeResources,
    lng: options.locale ?? DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    debug: options.debug ?? false,
  });
  return instance;
}
