"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import ScrollReveal from "@/components/shared/ScrollReveal";

/**
 * Les tarifs affichés ici reprennent exactement les clés `billing.*`
 * utilisées par la page de facturation : aucune valeur inventée.
 */
const PLANS = [
  {
    key: "starter",
    nameKey: "planStarter",
    priceKey: "priceStarter",
    volumeKey: "leadsStarter",
    featureKeys: ["featureStarter1", "featureStarter2", "featureStarter3"],
    highlight: false,
  },
  {
    key: "pro",
    nameKey: "planPro",
    priceKey: "pricePro",
    volumeKey: "leadsPro",
    featureKeys: ["featurePro1", "featurePro2", "featurePro3", "featurePro4"],
    highlight: true,
  },
  {
    key: "enterprise",
    nameKey: "planEnterprise",
    priceKey: "priceEnterprise",
    volumeKey: "leadsEnterprise",
    featureKeys: ["featureEnt1", "featureEnt2", "featureEnt3"],
    highlight: false,
  },
] as const;

export default function PricingSection() {
  const t = useTranslations("landing");
  const tb = useTranslations("billing");

  return (
    <section id="pricing" className="bg-background py-24 sm:py-32 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <ScrollReveal
          variant="perspectiveShift"
          className="mx-auto max-w-2xl text-center mb-16"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-strong mb-4">
            {t("pricingBadge")}
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
            <span className="font-serif block text-foreground/85">
              {t("pricingTitle1")}
            </span>
            <span className="block mt-1">{t("pricingTitle2")}</span>
          </h2>
          <p className="mt-5 text-lg text-text-secondary">
            {t("pricingSubtitle")}
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: i * 0.1,
              }}
              className={`relative flex h-full flex-col rounded-2xl border p-8 ${
                plan.highlight
                  ? "border-brand bg-surface shadow-lg shadow-brand/10 lg:-mt-4 lg:pb-10 lg:pt-10"
                  : "border-border-default bg-surface"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-8 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
                  <Sparkles className="h-3 w-3" />
                  {t("pricingPopular")}
                </span>
              )}

              <h3 className="text-lg font-bold text-foreground">
                {tb(plan.nameKey)}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                {tb(plan.volumeKey)}
              </p>

              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="font-data text-4xl font-bold text-foreground">
                  {tb(plan.priceKey)}
                </span>
                <span className="text-sm text-text-muted">{tb("madMonth")}</span>
              </p>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.featureKeys.map((featureKey) => (
                  <li key={featureKey} className="flex items-start gap-2.5">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-text-secondary">
                      {tb(featureKey)}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="/signup"
                className={`mt-8 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                  plan.highlight
                    ? "bg-brand text-white hover:bg-brand-strong"
                    : "border border-border-default text-foreground hover:bg-surface-elevated"
                }`}
              >
                {t("pricingCta")}
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}