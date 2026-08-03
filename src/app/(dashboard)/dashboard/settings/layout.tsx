"use client";

import TopBar from "@/components/dashboard/TopBar";
import { Settings, CreditCard, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsNav = [
  { href: "/dashboard/settings", label: "General", icon: Settings },
  { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings/team", label: "Team", icon: Users },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <TopBar title="Settings" />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 border-r border-border p-4 space-y-1">
          {settingsNav.map((item) => {
            const isActive =
              item.href === "/dashboard/settings"
                ? pathname === "/dashboard/settings"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-lime/10 text-lime"
                    : "text-text-secondary hover:text-foreground hover:bg-surface-elevated"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex-1 p-6 overflow-auto">{children}</div>
      </div>
    </>
  );
}
