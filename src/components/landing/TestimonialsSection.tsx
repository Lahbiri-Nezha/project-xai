"use client";

import { motion } from "framer-motion";
import ScrollReveal from "@/components/shared/ScrollReveal";
import { Quote } from "lucide-react";
import { useTranslations } from "next-intl";

export default function TestimonialsSection() {
  const t = useTranslations("landing");
  const testimonials = [
    {
      quote: t("testimonial1Quote"),
      name: t("testimonial1Name"),
      role: t("testimonial1Role"),
      company: t("testimonial1Company"),
      metric: t("testimonial1Metric"),
    },
    {
      quote: t("testimonial2Quote"),
      name: t("testimonial2Name"),
      role: t("testimonial2Role"),
      company: t("testimonial2Company"),
      metric: t("testimonial2Metric"),
    },
    {
      quote: t("testimonial3Quote"),
      name: t("testimonial3Name"),
      role: t("testimonial3Role"),
      company: t("testimonial3Company"),
      metric: t("testimonial3Metric"),
    },
  ];

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <ScrollReveal className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-strong mb-4">
            {t("testimonialsBadge")}
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
            <span className="font-serif block text-foreground/85">{t("testimonialsTitle")}</span>
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: i * 0.1,
              }}
              whileHover={{ y: -4 }}
              className="relative rounded-2xl bg-surface border border-border-default p-8 transition-colors hover:border-brand/30"
            >
              <Quote className="h-8 w-8 text-brand/30 mb-4" />
              <p className="text-base leading-relaxed text-text-secondary">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-4 inline-flex items-center rounded-full bg-brand/10 px-3 py-1">
                <span className="text-xs font-semibold text-brand-strong">
                  {t.metric}
                </span>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand/40 to-brand/10 flex items-center justify-center text-white text-xs font-bold">
                  {t.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t.role}, {t.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
