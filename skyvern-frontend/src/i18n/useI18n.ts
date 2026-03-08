import { useCallback, useSyncExternalStore } from "react";
import { locales, type Locale, type MessageKey } from "./locales";

const STORAGE_KEY = "finrpa-locale";

let currentLocale: Locale =
  (typeof window !== "undefined"
    ? (localStorage.getItem(STORAGE_KEY) as Locale)
    : null) ?? "zh";

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  listeners.forEach((cb) => cb());
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getSnapshot);

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => {
      let text: string = locales[locale][key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), String(v));
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return text;
    },
    [locale],
  );

  return { locale, setLocale, t };
}
