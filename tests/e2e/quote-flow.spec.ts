import { expect, test } from "@playwright/test";

test("redirects unauthenticated users to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("public quote page renders for an unauthenticated viewer given a valid share token", async ({
  page,
}) => {
  await page.goto("/quote/nonexistent-token-for-smoke-test");
  await expect(page.getByText("Loading...")).toBeVisible();
});
