"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";

type Membership = {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string | null };
};

export default function TeamPage() {
  const t = useTranslations("settingsTeam");
  const members = trpc.organization.listMembers.useQuery();
  const list = (members.data ?? []) as unknown as Membership[];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">{t("title")}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t("subtitle")}
          </p>
        </div>
        <button className="bg-lime hover:bg-lime-dark text-white font-semibold px-4 py-2 rounded-lg transition-all hover:-translate-y-0.5 text-sm">
          {t("invite")}
        </button>
      </div>

      <div className="rounded-xl bg-surface border border-border divide-y divide-border">
        {list.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-muted">
            {t("noMembers")}
          </p>
        ) : (
          list.map((member) => (
            <div key={member.id} className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-lime/10 flex items-center justify-center text-xs font-bold text-lime-dark">
                  {(member.user.name?.split(" ").map((n) => n[0]).join("") ?? member.user.email?.[0]?.toUpperCase() ?? "?")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{member.user.name ?? "—"}</p>
                  <p className="text-xs text-text-muted">{member.user.email}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-text-secondary bg-surface-elevated px-3 py-1 rounded-full">
                {member.role}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
