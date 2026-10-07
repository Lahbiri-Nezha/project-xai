"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";
import {
  LayoutDashboard,
  Users,
  Crosshair,
  MessageSquare,
  Settings,
  Zap,
  ChevronDown,
  List,
  Bookmark,
  Timer,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", labelKey: "overview", icon: LayoutDashboard },
  { href: "/dashboard/prospector", labelKey: "prospector", icon: Crosshair },
  { href: "/dashboard/leads", labelKey: "leads", icon: Users },
  { href: "/dashboard/copilot", labelKey: "copilot", icon: MessageSquare },
  { href: "/dashboard/lists", labelKey: "lists", icon: List },
  { href: "/dashboard/saved-searches", labelKey: "savedSearches", icon: Bookmark },
  { href: "/dashboard/sequences", labelKey: "sequences", icon: Timer },
  { href: "/dashboard/compliance", labelKey: "compliance", icon: ShieldCheck },
  { href: "/dashboard/settings", labelKey: "settings", icon: Settings },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations();
  const [orgOpen, setOrgOpen] = useState(false);

  const { data: rawMe } = trpc.organization.me.useQuery();
  const { data: rawSub } = trpc.billing.getSubscription.useQuery();
  const me = rawMe as unknown as { orgName: string | null } | undefined;
  const sub = rawSub as unknown as
    | { planName: string; leadsPerMonth: number; leadsUsed: number }
    | undefined;

  const orgName = me?.orgName ?? t("nav.myOrganization");
  const usedPct =
    sub && sub.leadsPerMonth > 0
      ? Math.min(100, Math.round((sub.leadsUsed / sub.leadsPerMonth) * 100))
      : 0;

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">
            {t("brand.name")}
          </span>
        </Link>
      </div>

      <button
        onClick={() => setOrgOpen(!orgOpen)}
        className="mx-3 mt-3 flex items-center justify-between rounded-lg bg-surface-elevated border border-border px-3 py-2 text-sm"
      >
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-brand/20 flex items-center justify-center text-[10px] font-bold text-brand">
            {initials(orgName)}
          </div>
          <span className="font-medium text-foreground truncate">{orgName}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-text-muted transition-transform ${orgOpen ? "rotate-180" : ""}`}
        />
      </button>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand/10 text-brand"
                  : "text-text-secondary hover:text-foreground hover:bg-surface-elevated"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {t(`nav.${item.labelKey}`)}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <div className="rounded-lg bg-brand/5 border border-brand/10 p-3">
          <p className="text-xs font-semibold text-brand">{sub?.planName ?? "…"}</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {sub
              ? t("nav.leadsThisMonth", {
                  used: sub.leadsUsed,
                  total: sub.leadsPerMonth,
                })
              : "…"}
          </p>
          <div className="mt-2 h-1 rounded-full bg-surface-elevated overflow-hidden">
            <div
              className={`h-full rounded-full ${usedPct >= 90 ? "bg-lead-low" : "bg-brand"}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <Link
            href="/dashboard/settings/billing"
            className="mt-2 block text-[10px] font-medium text-brand hover:text-brand-strong"
          >
            {t("nav.upgradePlan")}
          </Link>
        </div>
      </div>
    </aside>
  );
}
