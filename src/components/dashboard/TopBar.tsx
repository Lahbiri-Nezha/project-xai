"use client";

import { Bell, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";

export default function TopBar({ title }: { title: string }) {
  const t = useTranslations("topbar");

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            className="w-64 rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-lime/50 focus:border-lime"
          />
        </div>
        <LanguageSwitcher />
        <button className="relative p-2 rounded-lg hover:bg-surface-elevated transition-colors">
          <Bell className="h-5 w-5 text-text-secondary" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-lime" />
        </button>
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-lime/40 to-lime/10 flex items-center justify-center text-ink text-xs font-bold">
          HB
        </div>
      </div>
    </div>
  );
}
