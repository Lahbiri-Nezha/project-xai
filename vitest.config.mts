import path from "path";
import { defineConfig } from "vitest/config";

// Extension `.mts` : le package est en CommonJS (pas de "type": "module"),
// donc un fichier `.ts` à syntaxe ESM déclenchait un avertissement Vite.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});