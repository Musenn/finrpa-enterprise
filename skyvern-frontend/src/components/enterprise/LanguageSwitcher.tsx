import { useI18n } from "@/i18n/useI18n";
import type { Locale } from "@/i18n/locales";

const options: { value: Locale; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "EN" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center rounded-md border border-white/20 overflow-hidden text-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLocale(opt.value)}
          className={`px-3 py-1 transition-colors ${
            locale === opt.value
              ? "bg-[var(--finrpa-blue)] text-white"
              : "bg-white/10 text-[var(--finrpa-text-muted)] hover:bg-white/20"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
