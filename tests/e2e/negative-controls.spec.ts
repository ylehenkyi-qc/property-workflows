// НЕГАТИВНІ КОНТРОЛІ — навмисно хибні очікування. Не AC-тести: назви починаються з NC-, а не з AC ID, тож
// ac:coverage їх не рахує. У звичайному прогоні їх немає (проєкт chromium має grepInvert @negative-control);
// запуск: npm run uat:nc (UAT_NEGATIVE_CONTROLS=1 → проєкт negative-controls).
// Формат — зразок із materials/uat/examples/negative-controls.spec.ts курсу; AC, тексти й сторінки — наші (AC-DSYS-04).
// Що мають показати:
//   NC-1 — у тесті неправильний очікуваний текст → перевірка падає → FAIL, хоч би що сказав агент (R1);
//   NC-2 — текст «Тоді» у вимозі «уточнено», а тест і застосунок ні → перевірки зелені, агент звіряє кадр з НОВИМ текстом
//          і не погоджується → NEEDS-HUMAN (R3).
// Користувач синтетичний (uat-<запуск>-nc1@example.test), його прибирає afterAll і teardown cleanup.
import { expect, test } from "@playwright/test";
import { deleteUatUsers } from "./support/admin";
import { createUatManager } from "./support/data";
import { createUatUser } from "./support/vendor-data";
import { attachRuntimeErrors, given, signIn, thenStep, when } from "./support/uat";

const CLAUSE =
  'B sees the message "No runs yet. Launch a template to start one." and the link "Launch a template", and no empty table.';

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.afterAll(async () => {
  await deleteUatUsers();
});

async function openEmptyRunsList(page: Parameters<typeof signIn>[0], label: string) {
  await given("manager B who has no runs", async () => {
    const manager = await createUatManager(label);
    await signIn(page, manager.email, manager.password);
    await expect(page.getByTestId("user-email")).toHaveText(manager.email);
  });
  await when("B opens the list of runs", async () => {
    await page.goto("/runs");
  });
}

test(
  "NC-1 (AC-DSYS-04, навмисно хибне очікування в тесті: інший текст повідомлення)",
  {
    tag: ["@negative-control", "@writes"],
    annotation: [
      { type: "ac", description: "AC-DSYS-04" },
      { type: "case", description: "NC-1" },
    ],
  },
  async ({ page }) => {
    await openEmptyRunsList(page, "nc1");
    await thenStep(
      page,
      { clause: CLAUSE, visible: ['the message "No runs yet. Launch a template to start one."'] },
      async () => {
        await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText(
          "No runs found. Create a run to begin.",
          { timeout: 5_000 },
        );
      },
    );
  },
);

test(
  "NC-2 (AC-DSYS-04, текст «Тоді» у вимозі уточнено, тест і застосунок — ні)",
  {
    tag: ["@negative-control", "@writes"],
    annotation: [
      { type: "ac", description: "AC-DSYS-04" },
      { type: "case", description: "NC-2" },
      {
        type: "ac-text",
        description:
          'AC-DSYS-04: Given manager B who has no runs. When B opens the list of runs. Then B sees the message "You have no runs. Create one from a template." and the link "Create a run", and no empty table.',
      },
    ],
  },
  async ({ page }) => {
    await openEmptyRunsList(page, "nc2");
    await thenStep(
      page,
      { clause: CLAUSE, visible: ['the message "No runs yet. Launch a template to start one."'] },
      async () => {
        await expect(
          page.getByRole("main").getByText("No runs yet. Launch a template to start one.", { exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("main").getByRole("table")).toHaveCount(0);
      },
    );
  },
);

// NC-3 — той самий контроль NC-1 для вендорського AC зрізу 3 (AC-VENDOR-10): у твердженні навмисно інший текст
// повідомлення, ніж в AC PM. Очікуваний вердикт — FAIL (R1), а не PASS: UAT зрізу 3 уміє падати.
test(
  "NC-3 (AC-VENDOR-10, навмисно хибне очікування в тесті: інший текст повідомлення вендора)",
  {
    tag: ["@negative-control", "@writes"],
    annotation: [
      { type: "ac", description: "AC-VENDOR-10" },
      { type: "case", description: "NC-3" },
    ],
  },
  async ({ page }) => {
    await given("vendor V to whom no task is assigned", async () => {
      const vendor = await createUatUser("nc3-v", "vendor");
      await signIn(page, vendor.email, vendor.password);
    });
    await when("V opens the list of runs", async () => {
      await page.goto("/runs");
    });
    await thenStep(
      page,
      {
        clause: 'V sees the message "No tasks assigned to you yet." and no empty table.',
        visible: ['the message "No tasks assigned to you yet."'],
      },
      async () => {
        await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText(
          "You have no tasks. Ask your manager.",
          { timeout: 5_000 },
        );
      },
    );
  },
);
