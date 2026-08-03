import { test, expect } from "@playwright/test";

const unique = Date.now();
const email = `e2e-lead-${unique}@betatest.ma`;
const title = `Directeur E2E ${unique}`;

test("leads : liste peuplée + filtre HOT", async ({ page }) => {
  await page.goto("/dashboard/leads");
  await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "HOT", exact: true }).click();
  await expect(page.getByText("HOT", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Aucun lead ne correspond à ces filtres.")).not.toBeVisible();
});

test("leads : ajouter un lead puis le supprimer", async ({ page }) => {
  await page.goto("/dashboard/leads");

  await page.getByRole("button", { name: "Ajouter" }).click();
  const panel = page.locator("div", { hasText: "Nouveau lead" }).last();
  const inputs = panel.locator("input");
  await inputs.nth(0).fill("E2E");
  await inputs.nth(1).fill(`Lead ${unique}`);
  await inputs.nth(2).fill(email);
  await inputs.nth(4).fill(title);
  await inputs.nth(5).fill("E2E Corp");
  await page.getByRole("button", { name: "Créer le lead" }).click();

  await expect(page.getByText("Lead ajouté ✓")).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder("Rechercher par poste...").fill(title);
  const row = page.locator("tbody tr", { hasText: email });
  await expect(row).toBeVisible({ timeout: 15_000 });

  page.on("dialog", (d) => d.accept());
  await row.getByTitle("Supprimer").click();
  await expect(page.getByText("Lead supprimé ✓")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Aucun lead ne correspond à ces filtres.")).toBeVisible({ timeout: 15_000 });
});

test("leads : export CSV", async ({ page }) => {
  await page.goto("/dashboard/leads");
  await page.getByRole("button", { name: "Exporter" }).click();
  await expect(page.getByText(/exporté/)).toBeVisible({ timeout: 15_000 });
});
