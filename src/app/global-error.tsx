"use client";

/**
 * Dernier rempart : ce fichier REMPLACE le layout racine, donc il doit
 * fournir ses propres <html>/<body> et ne peut utiliser ni next-intl
 * (provider non monté) ni ErrorState (qui appelle useTranslations).
 */
const COPY = {
  fr: {
    title: "Une erreur inattendue est survenue",
    description: "L'application n'a pas pu s'afficher correctement.",
    retry: "Réessayer",
  },
  en: {
    title: "An unexpected error occurred",
    description: "The application could not be displayed correctly.",
    retry: "Try again",
  },
  ar: {
    title: "حدث خطأ غير متوقع",
    description: "تعذّر عرض التطبيق بشكل صحيح.",
    retry: "أعد المحاولة",
  },
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (process.env.NODE_ENV !== "production") {
    console.error("[sales-insight] global error", error);
  }

  const lang =
    typeof document !== "undefined"
      ? (document.documentElement.lang as keyof typeof COPY)
      : "fr";
  const text = COPY[lang] ?? COPY.fr;

  return (
    <html lang={lang}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5F6FB",
          color: "#12141F",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div role="alert" style={{ maxWidth: 480, padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>{text.title}</h1>
          <p style={{ fontSize: 14, color: "#4E5468", margin: "0 0 24px" }}>
            {text.description}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#4A3FC4",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {text.retry}
          </button>
        </div>
      </body>
    </html>
  );
}