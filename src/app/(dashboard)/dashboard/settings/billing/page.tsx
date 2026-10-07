"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/client";

type PlanMeta = {
  key: string;
  name: string;
  price: string;
  leads: string;
  features: string[];
};

export default function BillingPage() {
  const t = useTranslations("billing");
  const PLANS_UI: PlanMeta[] = [
    {
      key: "STARTER",
      name: t("planStarter"),
      price: t("priceStarter"),
      leads: t("leadsStarter"),
      features: [t("featureStarter1"), t("featureStarter2"), t("featureStarter3")],
    },
    {
      key: "PRO",
      name: t("planPro"),
      price: t("pricePro"),
      leads: t("leadsPro"),
      features: [t("featurePro1"), t("featurePro2"), t("featurePro3"), t("featurePro4")],
    },
    {
      key: "ENTERPRISE",
      name: t("planEnterprise"),
      price: t("priceEnterprise"),
      leads: t("leadsEnterprise"),
      features: [t("featureEnt1"), t("featureEnt2"), t("featureEnt3")],
    },
  ];
  const sub = trpc.billing.getSubscription.useQuery();
  const checkout = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
  const cancel = trpc.billing.cancelSubscription.useMutation({
    onSuccess: () => {
      setSuccess(t("cancelOk"));
      utils.billing.getSubscription.invalidate();
    },
    onError: (err) => {
      setNotice(err?.message ?? t("cancelFailed"));
    },
  });
  const utils = trpc.useUtils();
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState("");

  const s = sub.data;
  const planKey = s?.plan ?? "FREE";
  const usagePct =
    s && s.leadsPerMonth > 0
      ? Math.min(100, Math.round((s.leadsUsed / s.leadsPerMonth) * 100))
      : 0;

  const onUpgrade = (plan: "STARTER" | "PRO") => {
    setNotice("");
    checkout.mutate(
      { plan },
      {
        onError: (err) => {
          setNotice(err?.message ?? t("checkoutFailed"));
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-foreground">{t("title")}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {t("subtitle")}
        </p>
      </div>

      <div className="rounded-xl bg-surface border border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("plan", { name: PLANS_UI.find((p) => p.key === planKey)?.name ?? planKey })}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {s && s.leadsPerMonth === -1
                ? t("unlimited")
                : s
                  ? t("leadsPerMonth", { count: s.leadsPerMonth })
                  : "…"}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-strong">
            {t("currentPlan")}
          </span>
        </div>
        {s && s.leadsPerMonth > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>{t("leadsUsed")}</span>
              <span className="font-data font-semibold">
                {s.leadsUsed.toLocaleString("fr-FR")} / {s.leadsPerMonth.toLocaleString("fr-FR")}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
              <div
                className={`h-full rounded-full ${usagePct >= 90 ? "bg-lead-excellent" : "bg-brand"}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>
        )}
      </div>

        {s && s.hasStripe && planKey !== "FREE" && (
          <div className="flex items-center justify-between rounded-xl bg-surface border border-border p-6">
            <div>
              <p className="text-sm font-semibold text-foreground">{t("cancelTitle")}</p>
              <p className="text-xs text-text-muted mt-1">
                {t("cancelDesc")}
              </p>
            </div>
            <button
              onClick={() => {
                if (window.confirm(t("cancelConfirm"))) {
                  cancel.mutate();
                }
              }}
              disabled={cancel.isPending}
              className="rounded-lg border border-lead-low/30 text-lead-low px-4 py-2 text-sm font-medium hover:bg-lead-low/10 transition-colors disabled:opacity-50"
            >
              {cancel.isPending ? t("cancelling") : t("cancel")}
            </button>
          </div>
        )}

        {notice && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {notice}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-lead-excellent/10 border border-lead-excellent/20 p-3 text-sm text-lead-excellent">
            {success}
          </div>
        )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS_UI.map((plan) => {
          const isCurrent = plan.key === planKey;
          const isUpgradeable = plan.key === "STARTER" || plan.key === "PRO";
          return (
            <div
              key={plan.key}
              className={`rounded-xl bg-surface border p-6 ${isCurrent ? "border-brand/50 ring-1 ring-brand/30" : "border-border"}`}
            >
              <p className="text-lg font-bold text-foreground">{plan.name}</p>
              <p className="mt-1 text-2xl font-bold font-data text-brand-strong">
                {plan.price}
                {plan.key !== "ENTERPRISE" && (
                  <span className="text-sm font-medium text-text-muted"> {t("madMonth")}</span>
                )}
              </p>
              <p className="mt-1 text-xs text-text-muted">{plan.leads}</p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="text-xs text-text-secondary flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-brand" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="mt-4 w-full block text-center bg-brand/10 text-brand-strong font-semibold py-2 rounded-lg text-sm">
                  {t("planCurrent")}
                </span>
              ) : isUpgradeable ? (
                <button
                  onClick={() => onUpgrade(plan.key as "STARTER" | "PRO")}
                  disabled={checkout.isPending}
                  className="mt-4 w-full bg-brand hover:bg-brand-strong text-white font-semibold py-2 rounded-lg transition-all text-sm hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkout.isPending ? t("redirecting") : t("upgrade", { name: plan.name })}
                </button>
              ) : (
                <span className="mt-4 w-full block text-center bg-surface-elevated text-text-secondary font-semibold py-2 rounded-lg text-sm">
                  {t("contactTeam")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
