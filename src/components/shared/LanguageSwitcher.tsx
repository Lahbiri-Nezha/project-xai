"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";

const LOCALES = [
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("common");

  return (
    <div className="flex items-center gap-1.5">
      <Globe className="h-4 w-4 shrink-0 text-slate-400" />
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(e) => {
          document.cookie = `NEXT_LOCALE=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
        className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none focus:border-slate-500"
      >
        {LOCALES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
