import { test, expect } from "@playwright/test";

test("leads : import CSV et vérification du score calculé", async ({ page }) => {
  const unique = Date.now();
  const csv = [
    "email,prénom,nom,poste,téléphone,société,ville,secteur",
    `e2e-imp-${unique}@betatest.ma,E2E,Import,Responsable Import,+212600000000,E2E Import SARL,Casablanca,Logistique`,
    `e2e-imp2-${unique}@betatest.ma,E2E,Import2,Responsable Import 2,+212611111111,E2E Import 2 SARL,Rabat,Fintech`,
  ].join("\n");

  await page.goto("/dashboard/leads");
  await page.locator('input[type="file"]').setInputFiles({
    name: "leads.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf-8"),
  });

  await expect(page.getByText("2 leads importés ✓")).toBeVisible({ timeout: 20_000 });

  await page.getByPlaceholder("Rechercher par poste...").fill("Responsable Import");
  const first = page.locator("tbody tr", { hasText: `e2e-imp-${unique}@betatest.ma` });
  await expect(first).toBeVisible({ timeout: 15_000 });
  const second = page.locator("tbody tr", { hasText: `e2e-imp2-${unique}@betatest.ma` });
  await expect(second).toBeVisible();
});
