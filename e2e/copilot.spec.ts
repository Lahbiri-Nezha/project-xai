import { test, expect, type Page } from "@playwright/test";

type AskCtx = {
  page: Page;
  input: ReturnType<Page["getByPlaceholder"]>;
  container: ReturnType<Page["locator"]>;
  sendBtn: ReturnType<Page["getByRole"]>;
};

async function openCopilot(page: Page): Promise<AskCtx> {
  await page.goto("/dashboard/copilot");
  const input = page.getByPlaceholder(/Posez une question/);
  await expect(input).toBeVisible({ timeout: 30_000 });
  const container = page.locator(".flex-1.overflow-auto");
  const sendBtn = page.getByRole("button", { name: /Envoyer/ });
  return { page, input, container, sendBtn };
}

async function ask(ctx: AskCtx, text: string): Promise<void> {
  const { input, sendBtn } = ctx;
  await input.fill(text);
  // Le bouton n'est actif que si loading est false -> garantit que le
  // stream précédent est terminé avant d'envoyer le message suivant.
  await expect(sendBtn).toBeEnabled({ timeout: 60_000 });
  await input.press("Enter");
}

async function expectLastAnswer(ctx: AskCtx, re: RegExp): Promise<void> {
  const last = ctx.page.locator(".max-w-3xl.space-y-4 > div.flex.gap-3").last();
  await expect(last).toContainText(re, { timeout: 60_000 });
}

test("copilot: explique majda -> explication specifique (pas la liste)", async ({ page }) => {
  test.setTimeout(180_000);
  const ctx = await openCopilot(page);

  await ask(ctx, "explique moi la repartition");
  await expectLastAnswer(ctx, /répartition/);

  await ask(ctx, "explique majda");
  await expectLastAnswer(ctx, /Explication du score de Majda/);
  await expectLastAnswer(ctx, /Décomposition du score/);
  await expectLastAnswer(ctx, /Score/);
});

test("copilot: conversation libre -> salutation, smalltalk et fallback contextuel distincts", async ({ page }) => {
  test.setTimeout(180_000);
  const ctx = await openCopilot(page);

  await ask(ctx, "hello");
  await expectLastAnswer(ctx, /Ravi de vous aider/);

  await ask(ctx, "how are u");
  await expectLastAnswer(ctx, /Merci, tout va bien de mon côté/);

  await ask(ctx, "xyzzy plugh");
  await expectLastAnswer(ctx, /Je n'ai pas de réponse pour « xyzzy plugh »/);
});

test("topbar: menu profil et panneau notifications fonctionnels", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("aside")).toBeVisible({ timeout: 30_000 });

  const avatar = page.locator("button[aria-label='Mon profil']");
  await expect(avatar).toBeVisible();
  await expect(avatar).toContainText(/[A-Za-z]/);
  await avatar.click();
  await expect(page.getByText("Se déconnecter")).toBeVisible();
  await page.keyboard.press("Escape");

  const bell = page.locator("button[aria-label='Notifications']");
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByText("Aucune notification pour le moment")).toBeVisible();
  await page.keyboard.press("Escape");
});
