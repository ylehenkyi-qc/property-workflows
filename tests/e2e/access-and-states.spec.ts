// UAT для трьох AC зрізу 2 на проді (домашка WS8). Дослівні AC — у requirements/ (AC-DSYS-02, AC-DSYS-04 —
// 19-use-one-design-system.md; AC-EDITOR-07 — 20-edit-a-template-with-version-control.md).
// Користувачі синтетичні: uat-<запуск>-<мітка>@example.test, їх створює й видаляє ця специфікація (@writes).
// Прод — спільна база з PM: сторінки лише читаються, пишуться лише синтетичні користувач і запуск, і вони прибираються.
import { expect, test } from "@playwright/test";
import { deleteUatUsers } from "./support/admin";
import {
  createUatManager,
  templateState,
  templateVersionCount,
  tenantMoveInTemplate,
  type UatUser,
} from "./support/data";
import { attachRuntimeErrors, given, signIn, thenStep, when } from "./support/uat";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.afterAll(async () => {
  await deleteUatUsers();
});

async function signedInAs(page: Parameters<typeof signIn>[0], user: UatUser) {
  await signIn(page, user.email, user.password);
  await expect(page.getByTestId("user-email")).toHaveText(user.email);
}

test(
  "AC-DSYS-02: manager B opens the editor of the template by a direct link and sees «Not enough rights» and «Back to templates»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DSYS-02" } },
  async ({ page }) => {
    const template = await tenantMoveInTemplate();
    const before = await templateState(template.id);
    let managerB!: UatUser;

    await given("manager B is signed in and the template «Tenant move-in» has a saved version", async () => {
      managerB = await createUatManager("b");
      await signedInAs(page, managerB);
    });
    await when("B opens the editor of this template by a direct link", async () => {
      await page.goto(`/templates/${template.id}/edit`);
    });

    await thenStep(
      page,
      {
        clause:
          'B sees the message "Not enough rights" and the link "Back to templates" in the same page layout as the other pages, no content of the editor, and the template stays at version 1 with no unpublished changes.',
        visible: [
          'the message "Not enough rights"',
          'the link "Back to templates"',
          "no editor: no «Save version» button and no fields for section or task names",
        ],
        hidden: [
          "the template keeps the same version and the same unpublished-changes flag as before the visit (read from the database)",
        ],
      },
      async () => {
        const main = page.getByRole("main");
        await expect(main.getByRole("heading", { level: 1, name: "Not enough rights" })).toBeVisible();
        await expect(main.getByRole("link", { name: "Back to templates" })).toBeVisible();
        await expect(main.getByRole("button", { name: "Save version" })).toHaveCount(0);
        await expect(main.getByRole("textbox")).toHaveCount(0);
        expect(await templateState(template.id)).toEqual(before);
      },
    );
  },
);

test(
  "AC-EDITOR-07: manager B opens the list of versions of the template by a direct link and sees «Not enough rights» and no versions",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-EDITOR-07" } },
  async ({ page }) => {
    const template = await tenantMoveInTemplate();
    const versions = await templateVersionCount(template.id);
    expect(versions, "у шаблону має бути збережена версія, яку менеджер не повинен побачити").toBeGreaterThan(0);

    await given(`manager B signed in and the template «Tenant move-in» with saved versions (${versions} in the database)`, async () => {
      await signedInAs(page, await createUatManager("v"));
    });
    await when("B opens the list of versions of this template by a direct link", async () => {
      await page.goto(`/templates/${template.id}/versions`);
    });

    await thenStep(
      page,
      {
        clause: 'B sees the message "Not enough rights" and no versions.',
        visible: ['the message "Not enough rights"', "no list of versions: no table and no rows «Version N»"],
        hidden: ["the page has no version rows or table, although the template has saved versions in the database"],
      },
      async () => {
        const main = page.getByRole("main");
        await expect(main.getByRole("heading", { level: 1, name: "Not enough rights" })).toBeVisible();
        await expect(main.getByTestId("version-row")).toHaveCount(0);
        await expect(main.getByRole("table")).toHaveCount(0);
        await expect(main.getByText(/^Version \d+$/)).toHaveCount(0);
      },
    );
  },
);

test(
  "AC-DSYS-04: manager B who has no runs opens the list of runs and sees «No runs yet. Launch a template to start one.» and «Launch a template»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DSYS-04" } },
  async ({ page }) => {
    await given("manager B who has no runs", async () => {
      await signedInAs(page, await createUatManager("empty"));
    });
    await when("B opens the list of runs", async () => {
      await page.goto("/runs");
    });

    await thenStep(
      page,
      {
        clause:
          'B sees the message "No runs yet. Launch a template to start one." and the link "Launch a template", and no empty table.',
        visible: ['the message "No runs yet. Launch a template to start one."', 'the link "Launch a template"'],
        hidden: ["there is no table on the page"],
      },
      async () => {
        const main = page.getByRole("main");
        await expect(main.getByText("No runs yet. Launch a template to start one.", { exact: true })).toBeVisible();
        await expect(main.getByRole("link", { name: "Launch a template", exact: true })).toBeVisible();
        await expect(main.getByRole("table")).toHaveCount(0);
      },
    );
  },
);
