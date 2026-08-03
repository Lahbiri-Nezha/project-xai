import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "ar", "en"],
  defaultLocale: "fr",
  localeCookie: {
    name: "NEXT_LOCALE",
    sameSite: "lax",
  },
});
