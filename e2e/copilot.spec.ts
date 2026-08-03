import { test, expect } from "@playwright/test";

test("copilot: explique majda -> explication specifique (pas la liste)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/dashboard/copilot");

  const input = page.getByPlaceholder(/Posez une question/);
  await expect(input).toBeVisible({ timeout: 30_000 });

  await input.fill("explique moi la repartition");
  await input.press("Enter");
  await expect(page.locator(".flex-1.overflow-auto")).toContainText(
    "répartition",
    { timeout: 60_000 }
  );

  await input.fill("explique majda");
  await input.press("Enter");

  const explanation = page
    .locator(".flex-1.overflow-auto .max-w-3xl > div")
    .filter({ hasText: /Explication du score de Majda/ });
  await expect(explanation.first()).toBeVisible({ timeout: 60_000 });
  await expect(explanation.first()).toContainText("Décomposition du score");
  await expect(explanation.first()).toContainText("Score");
});

test("topbar: menu profil et panneau notifications fonctionnels", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("aside")).toBeVisible({ timeout: 30_000 });

  const avatar = page.locator("button[aria-label='Mon profil']");
  await expect(avatar).toBeVisible();
  await avatar.click();
  await expect(page.getByText("Se déconnecter")).toBeVisible();
  await page.keyboard.press("Escape");

  const bell = page.locator("button[aria-label='Notifications']");
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByText("Aucune notification pour le moment")).toBeVisible();
  await page.keyboard.press("Escape");
});
