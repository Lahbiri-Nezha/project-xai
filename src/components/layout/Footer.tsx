import Link from "next/link";
import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("landing");

  // Uniquement des ancres qui existent réellement sur la page : le footer
  // ne propose aucun lien mort.
  const productLinks = [
    { href: "/#features", label: t("footerLeadScoring") },
    { href: "/#how-it-works", label: t("footerBuyingSignals") },
    { href: "/#pricing", label: t("navPricing") },
  ];

  return (
    <footer className="border-t border-border-default bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
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

          <nav aria-labelledby="footer-product-heading">
            <h3
              id="footer-product-heading"
              className="text-sm font-semibold text-foreground"
            >
              {t("footerProduct")}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary transition-colors hover:text-brand-strong"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("footerGetStarted")}
            </h3>
            <p className="mt-4 text-sm text-text-secondary">
              {t("footerGetStartedDesc")}
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {t("navSignUp")}
            </Link>
          </div>
        </div>

        <div className="mt-12 border-t border-border-default pt-6">
          <p className="text-xs text-text-muted">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}