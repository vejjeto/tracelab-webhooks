import { expect, test } from "@playwright/test";

test("TraceLab loads demo bin, simulates signed GitHub webhook via SSE, verifies HMAC, and runs MCP Inspector", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "TraceLab" })).toBeVisible();
  await expect(page.getByTestId("sse-status")).toContainText("SSE Conectado");

  // Trigger 1-click GitHub signed webhook simulation
  await page.getByRole("button", { name: "Disparar Webhook GitHub" }).click();

  // Switch to HMAC Verifier tab and assert valid signature badge
  await page.getByRole("button", { name: "HMAC Verifier" }).click();
  await expect(page.getByTestId("hmac-status-badge")).toContainText(
    "Firma HMAC Válida",
  );

  // Switch to Snippets tab and check cURL snippet
  await page.getByRole("button", { name: "Snippets" }).click();
  await expect(page.getByText("curl -X POST")).toBeVisible();

  // Switch to MCP Inspector tab and run list_recent_webhooks
  await page.getByRole("button", { name: "MCP Inspector" }).click();
  await page.getByTestId("mcp-run-button").click();
  await expect(page.getByTestId("mcp-response-output")).toContainText(
    "webhooks",
  );
});
