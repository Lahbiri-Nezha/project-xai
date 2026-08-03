import { test, expect } from "@playwright/test";

test.describe("visiteur non authentifié", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirigé vers /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("échec de connexion avec un mauvais mot de passe", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("vous@entreprise.com").fill("hicham@betatest.ma");
    await page.getByPlaceholder("Entrez votre mot de passe").fill("MauvaisMotDePasse");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });
});

test("compte démo : connexion → dashboard avec l'org Beta Test", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Tableau de Bord")).toBeVisible();
  await expect(page.getByText(/Ravi de vous revoir, Hicham/)).toBeVisible();
  await expect(page.getByText("Beta Test").first()).toBeVisible();
});
