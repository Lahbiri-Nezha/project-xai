"use client";

import { motion } from "framer-motion";
import { Radar, Scale, Route } from "lucide-react";
import { useTranslations } from "next-intl";
import ScrollReveal from "@/components/shared/ScrollReveal";

type Step = {
  icon: typeof Radar;
  step: string;
  title: string;
  description: string;
};

function buildSteps(t: ReturnType<typeof useTranslations<"landing">>): Step[] {
  return [
    {
      icon: Radar,
      step: t("howStep1Number"),
      title: t("howStep1Title"),
      description: t("howStep1Desc"),
    },
    {
      icon: Scale,
      step: t("howStep2Number"),
      title: t("howStep2Title"),
      description: t("howStep2Desc"),
    },
    {
      icon: Route,
      step: t("howStep3Number"),
      title: t("howStep3Title"),
      description: t("howStep3Desc"),
    },
  ];
}

export default function HowItWorksSection() {
  const t = useTranslations("landing");
  const steps = buildSteps(t);

  return (
    <section
      id="how-it-works"
      className="bg-surface-warm py-24 sm:py-32 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <ScrollReveal
          variant="perspectiveShift"
          className="mx-auto max-w-2xl text-center mb-16"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-strong mb-4">
            {t("howBadge")}
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
            <span className="font-serif block text-foreground/85">
              {t("howTitle1")}
            </span>
            <span className="block mt-1">{t("howTitle2")}</span>
          </h2>
          <p className="mt-5 text-lg text-text-secondary">
            {t("howSubtitle")}
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: i * 0.12,
              }}
              className="relative rounded-2xl bg-surface border border-border-default p-8"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
                  <item.icon className="h-5 w-5 text-brand-strong" />
                </div>
                <span className="font-data text-xs font-bold uppercase tracking-widest text-text-muted">
                  {item.step}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-bold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}