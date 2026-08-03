import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

setup("authentifier hicham@betatest.ma et sauvegarder la session", async ({ page }) => {
  mkdirSync("e2e/.auth", { recursive: true });

  await page.goto("/login");
  await page.getByPlaceholder("vous@entreprise.com").fill("hicham@betatest.ma");
  await page.getByPlaceholder("Entrez votre mot de passe").fill("Hicham2026!");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await page.waitForURL("**/dashboard");
  await expect(page.getByText("Tableau de Bord")).toBeVisible();
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
