import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-7xl font-bold text-lime">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 text-text-secondary">
          {t("description")}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block bg-lime text-ink font-semibold px-6 py-2.5 rounded-lg hover:bg-lime-dark transition-colors"
        >
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
