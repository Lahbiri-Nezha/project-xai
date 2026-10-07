import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "ar", "en"],
  defaultLocale: "fr",
  // Les URL ne portent pas de préfixe de locale (/login, pas /fr/login) :
  // la locale est portée par le cookie NEXT_LOCALE. Sans cette option,
  // next-intl prend "always" par défaut, ce qui contredit les routes réelles.
  localePrefix: "never",
  localeCookie: {
    name: "NEXT_LOCALE",
    sameSite: "lax",
  },
});
