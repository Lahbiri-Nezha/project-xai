"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { createOrg } from "@/server/actions/org";

// Validation volontairement simple : le serveur fait autorité,
// ce garde-fou sert surtout à éviter un aller-retour réseau inutile.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

type InvalidField = "name" | "email" | "company" | "password" | null;

export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations("auth.signup");
  const tb = useTranslations("brand");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<InvalidField>(null);
  const [loading, setLoading] = useState(false);
  // Vrai quand le compte est créé mais pas l'espace : on réessaie
  // uniquement la création de l'espace au prochain envoi.
  const [needsOrgRetry, setNeedsOrgRetry] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  /** Traduit les codes d'erreur better-auth en messages localisés. */
  const describeError = (authError: {
    message?: string | null;
    code?: string | null;
    status?: number | null;
  }) => {
    if (authError.status === 429) return t("tooManyRequests");
    switch (authError.code) {
      case "USER_ALREADY_EXISTS":
      case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      case "EMAIL_ALREADY_EXISTS":
        return t("userExists");
      case "INVALID_EMAIL":
        return t("invalidEmail");
      case "WEAK_PASSWORD":
      case "PASSWORD_TOO_SHORT":
        return t("passwordTooShort");
      default:
        return t("genericError");
    }
  };

  const focusError = () => {
    // Laisse le DOM peindre le bandeau avant de lui donner le focus.
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  const fail = (message: string, field: InvalidField, ref?: React.RefObject<HTMLInputElement | null>) => {
    setError(message);
    setInvalidField(field);
    ref?.current?.focus();
    focusError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedOrg = orgName.trim();

    if (!trimmedName) {
      fail(t("nameRequired"), "name", nameRef);
      return;
    }
    if (!normalizedEmail) {
      fail(t("emailRequired"), "email", emailRef);
      return;
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      fail(t("invalidEmail"), "email", emailRef);
      return;
    }
    // L'espace est obligatoire : sans lui, le tableau de bord n'a aucune
    // donnée à afficher (getOrganizationId rejetterait chaque requête).
    if (!trimmedOrg) {
      fail(t("companyRequired"), "company", companyRef);
      return;
    }
    if (password.length < MIN_PASSWORD && !needsOrgRetry) {
      fail(t("passwordTooShort"), "password", passwordRef);
      return;
    }

    setLoading(true);
    setError("");
    setInvalidField(null);

    try {
      // Après un échec de création d'espace, le compte existe déjà :
      // on réessaie uniquement l'espace au lieu de recréer le compte.
      if (!needsOrgRetry) {
        const { error: authError } = await authClient.signUp.email({
          name: trimmedName,
          email: normalizedEmail,
          password,
        });

        if (authError) {
          setError(describeError(authError));
          focusError();
          return;
        }
      }

      const orgResult = await createOrg(trimmedOrg);
      if (orgResult && "error" in orgResult) {
        setNeedsOrgRetry(true);
        setError(t("orgError"));
        focusError();
        return;
      }

      setNeedsOrgRetry(false);
      // Un simple push() : le cookie de session est déjà posé par les
      // réponses /api/auth/*, donc la navigation l'envoie au serveur.
      // Ne PAS appeler router.refresh() ici : exécuté dans le même tick,
      // il invalide la route courante et annule la navigation (le fetch
      // RSC /dashboard part mais l'URL reste /signup).
      router.push("/dashboard");
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
            id="signup-error"
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
            htmlFor="name"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {t("fullName")}
          </label>
          <input
            ref={nameRef}
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={invalidField === "name"}
            aria-describedby={invalidField === "name" ? "signup-error" : undefined}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand aria-[invalid=true]:border-destructive"
            placeholder={t("namePlaceholder")}
            required
          />
        </div>

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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={invalidField === "email"}
            aria-describedby={invalidField === "email" ? "signup-error" : undefined}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand aria-[invalid=true]:border-destructive"
            placeholder={t("emailPlaceholder")}
            required
          />
        </div>

        <div>
          <label
            htmlFor="company"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {t("companyName")}
          </label>
          <input
            id="company"
            ref={companyRef}
            name="company"
            type="text"
            autoComplete="organization"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            aria-invalid={invalidField === "company"}
            aria-describedby={invalidField === "company" ? "signup-error" : undefined}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand aria-[invalid=true]:border-destructive"
            placeholder={t("companyPlaceholder")}
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
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={invalidField === "password"}
            aria-describedby={invalidField === "password" ? "signup-error" : undefined}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand aria-[invalid=true]:border-destructive"
            placeholder={t("passwordPlaceholder")}
            minLength={MIN_PASSWORD}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full bg-brand hover:bg-brand-strong text-white font-semibold py-2.5 rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t("creatingAccount") : needsOrgRetry ? t("retryOrg") : t("createAccount")}
        </button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        {t("hasAccount")}{" "}
        <Link href="/login" className="text-brand-strong hover:text-brand font-medium">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
