"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Affiche la pile d'erreur (développement uniquement). */
  error?: Error & { digest?: string };
};

/**
 * Affichage d'erreur réutilisable pour les `error.tsx` de l'App Router.
 * Ne rend jamais la pile en production : elle peut contenir des détails
 * internes (chemins, requêtes) qui n'ont rien à faire dans le navigateur.
 */
export default function ErrorState({
  title,
  message,
  onRetry,
  error,
}: ErrorStateProps) {
  const t = useTranslations("error");

  useEffect(() => {
    // En production on remonte l'erreur au serveur de logs ; en local la
    // console suffit et reste lisible.
    if (process.env.NODE_ENV === "production") {
      console.error("[sales-insight] render error", error);
    }
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>

      <h2 className="text-xl font-bold text-foreground">
        {title ?? t("title")}
      </h2>
      <p className="max-w-md text-sm text-text-secondary">
        {message ?? t("description")}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t("retry")}
        </button>
      )}

      {process.env.NODE_ENV !== "production" && error?.digest && (
        <p className="font-data text-xs text-text-muted">
          {t("digest", { digest: error.digest })}
        </p>
      )}
    </div>
  );
}