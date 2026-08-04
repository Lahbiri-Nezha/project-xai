"use client";

import { useState, useCallback, useEffect } from "react";
import { Bell, BellOff, Search, LogOut, UserRound, Building2, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as MenuModule from "@base-ui/react/menu";
import * as AvatarModule from "@base-ui/react/avatar";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";

const Menu = MenuModule.Menu;
const Avatar = AvatarModule.Avatar;

const menuItemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none transition-colors hover:bg-surface-elevated hover:text-foreground cursor-pointer data-[highlighted]:bg-surface-elevated data-[highlighted]:text-foreground";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function TopBar({ title }: { title: string }) {
  const t = useTranslations("topbar");
  const router = useRouter();
  const { data } = trpc.organization.me.useQuery();
  const me = data as unknown as {
    userName: string | null;
    userEmail: string | null;
    userImage: string | null;
    orgCount: number;
  } | undefined;

  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const name = me?.userName || "…";
  const email = me?.userEmail ?? "";
  const unreadCount = 0;

  const loadOrgs = useCallback(async () => {
    if (orgs.length > 0) return;
    const res = await authClient.organization.list();
    setOrgs((res.data ?? []).map((org) => ({ id: org.id, name: org.name })));
  }, [orgs.length]);

  const handleSwitchWorkspace = async (orgId: string) => {
    await authClient.organization.setActive({ organizationId: orgId });
    router.refresh();
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

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

        <Menu.Root>
          <Menu.Trigger
            className="relative p-2 rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer outline-none"
            aria-label={t("notifications")}
          >
            <Bell className="h-5 w-5 text-text-secondary" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-lime" />
            )}
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
              <Menu.Popup className="w-80 rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <span className="text-sm font-semibold text-foreground">
                    {t("notifications")}
                  </span>
                </div>
                <div className="px-4 py-8 flex flex-col items-center gap-2 text-center">
                  <BellOff className="h-6 w-6 text-text-muted" />
                  <p className="text-sm text-text-secondary">{t("noNotifications")}</p>
                </div>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <Menu.Root>
          <Menu.Trigger
            className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-lime/60"
            aria-label={t("myProfile")}
          >
            <Avatar.Root className="h-8 w-8 rounded-full">
              {mounted && me?.userImage ? (
                <Avatar.Image src={me.userImage} alt={name} className="h-8 w-8 rounded-full object-cover" />
              ) : null}
              <Avatar.Fallback className="h-8 w-8 rounded-full bg-gradient-to-br from-lime/40 to-lime/10 flex items-center justify-center text-ink text-xs font-bold">
                {initials(mounted ? name : "")}
              </Avatar.Fallback>
            </Avatar.Root>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
              <Menu.Popup className="w-64 rounded-xl border border-border bg-surface shadow-xl p-1.5">
                <div className="px-3 py-2.5 border-b border-border mb-1">
                  <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                  <p className="text-xs text-text-muted truncate">{email}</p>
                </div>
                <Menu.Item className={menuItemClass} onClick={() => router.push("/dashboard/settings")}>
                  <UserRound className="h-4 w-4" />
                  {t("myProfile")}
                </Menu.Item>
                {me && me.orgCount > 1 && (
                  <Menu.SubmenuRoot onOpenChange={(open: boolean) => open && loadOrgs()}>
                    <Menu.SubmenuTrigger className={menuItemClass}>
                      <Building2 className="h-4 w-4" />
                      {t("switchWorkspace")}
                      <ChevronRight className="ml-auto h-3.5 w-3.5" />
                    </Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner side="right" align="start" sideOffset={4} className="z-50">
                        <Menu.Popup className="w-56 rounded-xl border border-border bg-surface shadow-xl p-1.5">
                          {orgs.map((org) => (
                            <Menu.Item
                              key={org.id}
                              className={menuItemClass}
                              onClick={() => handleSwitchWorkspace(org.id)}
                            >
                              <span className="truncate">{org.name}</span>
                            </Menu.Item>
                          ))}
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                )}
                <Menu.Separator className="my-1 h-px bg-border" />
                <Menu.Item className={menuItemClass} onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  {t("signOut")}
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </div>
  );
}
