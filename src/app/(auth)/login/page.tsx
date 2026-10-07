"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";

// Validation volontairement simple : le serveur fait autorité,
// ce garde-fou sert surtout à éviter un aller-retour réseau inutile.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth.login");
  const tb = useTranslations("brand");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  /** Traduit les codes d'erreur better-auth en messages localisés. */
  const describeError = (authError: {
    message?: string | null;
    code?: string | null;
    status?: number | null;
  }) => {
    if (authError.status === 429) return t("tooManyRequests");
    switch (authError.code) {
      case "INVALID_EMAIL_OR_PASSWORD":
      case "USER_NOT_FOUND":
      case "INVALID_PASSWORD":
      case "INVALID_EMAIL":
        return t("invalidCredentials");
      case "EMAIL_NOT_VERIFIED":
        return t("emailNotVerified");
      default:
        return t("genericError");
    }
  };

  const focusError = () => {
    // Laisse le DOM peindre le bandeau avant de lui donner le focus.
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError(t("emailRequired"));
      emailRef.current?.focus();
      focusError();
      return;
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError(t("invalidEmail"));
      emailRef.current?.focus();
      focusError();
      return;
    }
    if (!password) {
      setError(t("passwordRequired"));
      focusError();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: authError } = await authClient.signIn.email({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        setError(describeError(authError));
        focusError();
      } else {
        // Un simple push() : le cookie de session est déjà posé par la
        // réponse /api/auth/*, donc la navigation l'envoie au serveur.
        // Ne PAS appeler router.refresh() ici : exécuté dans le même tick,
        // il invalide la route courante et annule la navigation.
        router.push("/dashboard");
      }
    } catch {
      setError(t("genericError"));
      focusError();
    } finally {
      setLoading(false);
    }
  };

  const hasError = error.length > 0;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            {tb("name")}
          </span>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-2 text-sm text-text-secondary">{t("subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {hasError && (
          <div
            ref={errorRef}
            id="login-error"
            role="alert"
            tabIndex={-1}
            aria-live="assertive"
            className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive outline-none focus:ring-2 focus:ring-destructive/50"
          >
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {t("email")}
          </label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={hasError}
            aria-describedby={hasError ? "login-error" : undefined}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand aria-[invalid=true]:border-destructive"
            placeholder={t("emailPlaceholder")}
            required
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {t("password")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={hasError}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand aria-[invalid=true]:border-destructive"
            placeholder={t("passwordPlaceholder")}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full bg-brand hover:bg-brand-strong text-white font-semibold py-2.5 rounded-lg transition-colors hover:shadow-lg hover:shadow-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        {t("noAccount")}{" "}
        <Link href="/signup" className="text-brand-strong hover:text-brand font-medium">
          {t("signUp")}
        </Link>
      </p>
    </div>
  );
}