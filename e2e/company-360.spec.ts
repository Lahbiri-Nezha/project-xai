import { test, expect } from "@playwright/test";

test("company 360 : fraîcheur affichée (enrichissement, vérification, sources)", async ({ page }) => {
  await page.goto("/dashboard/prospector");

  const link = page.getByRole("link", { name: /Voir le compte 360/ }).first();
  await expect(link).toBeVisible({ timeout: 15_000 });
  await link.click();

  await expect(page.getByRole("heading", { name: "Sources & traçabilité" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Aucune source enregistrée.")).not.toBeVisible();

  for (const label of ["Site web", "DNS / en-têtes", "Job boards / RSS", "API publiques", "Heuristique"]) {
    await expect(page.getByText(label).first()).toBeVisible();
  }

  const enrichedRow = page.getByText("Dernier enrichissement", { exact: true }).locator("..");
  await expect(enrichedRow).toContainText(/\d{2}\/\d{2}\/\d{4}/);
  await expect(enrichedRow).not.toContainText("—");

  const verifiedRow = page.getByText("Dernière vérification", { exact: true }).locator("..");
  await expect(verifiedRow).toContainText(/\d{2}\/\d{2}\/\d{4}/);
  await expect(verifiedRow).not.toContainText("—");
});

test("listes : export CSV d'une liste (repli Blob)", async ({ page }) => {
  await page.goto("/dashboard/lists");
  const exportBtn = page.getByRole("button", { name: "Exporter en CSV" }).first();
  await expect(exportBtn).toBeVisible({ timeout: 15_000 });

  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await exportBtn.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});
