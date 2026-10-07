"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";

type MemberView = {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string | null; image: string | null };
};

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { data: rawOrg, isLoading } = trpc.organization.getCurrent.useQuery();
  const utils = trpc.useUtils();
  const [saved, setSaved] = useState(false);

  const org = rawOrg as unknown as
    | {
        name: string;
        slug: string;
        plan: string;
        members: MemberView[];
      }
    | undefined;

  const [name, setName] = useState("");

  const update = trpc.organization.update.useMutation({
    onSuccess: async () => {
      await utils.organization.getCurrent.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="h-6 w-48 bg-surface rounded animate-pulse" />
        <div className="h-40 bg-surface rounded-xl animate-pulse" />
      </div>
    );
  }

  const orgName = name || org?.name || "";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-foreground">{t("title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {t("subtitle")}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t("orgName")}
          </label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{t("slug")}</label>
          <input
            type="text"
            value={org?.slug ?? ""}
            disabled
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text-muted cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{t("plan")}</label>
          <input
            type="text"
            value={org?.plan ?? ""}
            disabled
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text-muted cursor-not-allowed"
          />
        </div>

        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">{t("members")}</h3>
          {!org || org.members.length === 0 ? (
            <p className="text-sm text-text-muted">{t("noMembers")}</p>
          ) : (
            <div className="space-y-2">
              {org.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl bg-surface border border-border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-brand/10 flex items-center justify-center text-xs font-bold text-brand-strong">
                      {m.user.name?.[0] ?? m.user.email?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {m.user.name ?? "—"}
                      </p>
                      <p className="text-xs text-text-muted">{m.user.email}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => update.mutate({ name: orgName.trim() })}
            disabled={update.isPending || !orgName.trim() || orgName.trim() === org?.name}
            className="bg-brand hover:bg-brand-strong text-white font-semibold px-6 py-2.5 rounded-lg transition-all hover:-translate-y-0.5 disabled:opacity-50"
          >
            {update.isPending ? t("saving") : t("save")}
          </button>
          {saved && (
            <span className="text-xs text-lead-excellent font-medium">
              {t("savedMsg")}
            </span>
          )}
          {update.isError && (
            <span className="text-xs text-lead-low">
              {update.error.message || t("saveFailed")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
