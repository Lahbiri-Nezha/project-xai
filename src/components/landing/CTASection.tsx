"use client";

import { useRouter } from "next/navigation";
import ScrollReveal from "@/components/shared/ScrollReveal";
import MagneticButton from "@/components/shared/MagneticButton";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

export default function CTASection() {
  const router = useRouter();
  const t = useTranslations("landing");
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <ScrollReveal variant="scaleIn">
          <div className="relative overflow-hidden rounded-3xl bg-surface border border-border-default px-8 py-16 sm:px-16 sm:py-24 text-center">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
            <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-brand/5 blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full bg-purple/4 blur-3xl translate-x-1/4 translate-y-1/4" />

            <div className="relative z-10 mx-auto max-w-2xl">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
                <span className="font-serif block text-foreground/85">{t("ctaLine1")}</span>
                <span className="text-brand-strong block mt-1">{t("ctaLine2")}</span>
              </h2>
              <p className="mt-6 text-lg text-text-secondary">
                {t("ctaText")}
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <MagneticButton
                  onClick={() => router.push("/signup")}
                  className="bg-brand hover:bg-brand-strong text-white text-base font-bold px-8 h-12 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/15 inline-flex items-center"
                >
                  {t("startFreeTrial")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </MagneticButton>
                <MagneticButton className="text-base font-semibold px-8 h-12 rounded-xl bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.12] transition-all hover:-translate-y-0.5 inline-flex items-center">
                  {t("talkToSales")}
                </MagneticButton>
              </div>
              <p className="mt-5 text-xs text-text-muted font-medium">
                {t("ctaFootnote")}
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
