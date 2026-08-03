import Link from "next/link";
import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("landing");
  const columns = [
    {
      title: t("footerProduct"),
      links: [
        t("footerLeadScoring"),
        t("footerBuyingSignals"),
        t("footerAiCopilot"),
        t("footerIntegrations"),
      ],
    },
    {
      title: t("footerCompany"),
      links: [t("footerAbout"), t("footerBlog"), t("footerCareers"), t("footerContact")],
    },
    {
      title: t("footerLegal"),
      links: [t("footerPrivacy"), t("footerTerms"), t("footerSecurity")],
    },
  ];

  return (
    <footer className="border-t border-border-default bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-bold tracking-tight text-foreground">
                Sales Insight
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary max-w-xs">
              {t("footerTagline")}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-foreground">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-sm text-text-secondary transition-colors hover:text-lime-dark"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border-default pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-5">
            {["Twitter", "LinkedIn", "GitHub"].map((social) => (
              <Link
                key={social}
                href="#"
                className="text-xs text-text-muted transition-colors hover:text-lime-dark"
              >
                {social}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
