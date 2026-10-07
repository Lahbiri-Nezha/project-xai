import { test, expect } from "@playwright/test";

test("prospector : la recherche en langage naturel affiche des comptes", async ({ page }) => {
  await page.goto("/dashboard/prospector");

  const comptesTab = page.getByRole("button", { name: /Comptes/ });
  await expect(comptesTab).toBeVisible();
  await expect(comptesTab).toHaveClass(/bg-brand/);

  const input = page.getByPlaceholder(/Recherche en langage naturel/);
  await input.fill("PME logistique à Casablanca qui recrutent");
  await page.getByRole("button", { name: "Rechercher" }).click();

  await expect(page.getByText(/interprété via IA/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Aucun compte trouvé.")).not.toBeVisible();
  const cards = await page.locator("input[type='checkbox']").count();
  expect(cards).toBeGreaterThan(0);
});

test("prospector : l'onglet Contacts liste les leads scorés", async ({ page }) => {
  await page.goto("/dashboard/prospector");
  await page.getByRole("button", { name: /Contacts/ }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/HOT|WARM|COLD/).first()).toBeVisible();
});

test("prospector : filtre secteur logistique", async ({ page }) => {
  await page.goto("/dashboard/prospector");
  await page.getByPlaceholder("ex. logistique, fintech").fill("logistique");
  await expect(page.getByText("Atlas Logistique SA").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Aucun compte trouvé.")).not.toBeVisible();
});

test("prospector : export CSV des comptes (repli Blob)", async ({ page }) => {
  await page.goto("/dashboard/prospector");
  const csvBtn = page.getByRole("button", { name: "CSV" });
  await expect(csvBtn).toBeVisible({ timeout: 15_000 });

  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await csvBtn.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("prospector-companies.csv");
});
