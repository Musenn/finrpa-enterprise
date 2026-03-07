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
    (key: MessageKey) => locales[locale][key] ?? key,
    [locale],
  );

  return { locale, setLocale, t };
}
