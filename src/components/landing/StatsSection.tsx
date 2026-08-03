"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { useTranslations } from "next-intl";

function CountUp({
  target,
  suffix,
  decimals = 0,
}: {
  target: number;
  suffix: string;
  decimals?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;

    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(
          decimals > 0
            ? parseFloat(current.toFixed(decimals))
            : Math.floor(current)
        );
      }
    }, duration / steps);
  }, [isInView, target, decimals]);

  return (
    <span ref={ref} className="font-data">
      {decimals > 0 ? count.toFixed(decimals) : count}
      {suffix}
    </span>
  );
}

export default function StatsSection() {
  const t = useTranslations("landing");
  const stats = [
    { value: 50000, suffix: "+", label: t("statScored") },
    { value: 73, suffix: "%", label: t("statPipeline") },
    { value: 4, suffix: "x", label: t("statResponse") },
    { value: 2.3, suffix: "s", label: t("statScoring") },
  ];
  return (
    <section className="bg-surface-warm py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl text-center mb-16"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-dark mb-4">
            {t("statsBadge")}
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
            <span className="font-serif block text-foreground/85">{t("statsTitle")}</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: i * 0.1,
              }}
              className="text-center group"
            >
              <p className="text-5xl sm:text-6xl lg:text-7xl font-bold font-data text-lime-dark transition-colors group-hover:text-lime">
                <CountUp
                  target={stat.value}
                  suffix={stat.suffix}
                  decimals={stat.value % 1 !== 0 ? 1 : 0}
                />
              </p>
              <p className="mt-3 text-sm font-medium text-text-muted">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
