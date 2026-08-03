import { useTranslations } from "next-intl";

export default function LogoStrip() {
  const t = useTranslations("landing");
  const logos = [
    { name: "OCP Group", letter: "OC" },
    { name: "Maroc Telecom", letter: "MT" },
    { name: "Attijariwafa", letter: "AW" },
    { name: "BMCE Bank", letter: "BM" },
    { name: "Taqa Morocco", letter: "TQ" },
    { name: "Renault Maroc", letter: "RM" },
  ];

  return (
    <section className="bg-background border-y border-border-default py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-text-muted mb-8">
          {t("logoTrust")}
        </p>
        <div className="relative overflow-hidden">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...logos, ...logos, ...logos].map((logo, i) => (
              <div
                key={`${logo.name}-${i}`}
                className="mx-8 sm:mx-12 flex items-center gap-2 text-text-muted/40"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-elevated text-xs font-bold text-text-muted/50">
                  {logo.letter}
                </div>
                <span className="text-lg font-semibold tracking-tight">
                  {logo.name}
                </span>
              </div>
            ))}
          </div>
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
