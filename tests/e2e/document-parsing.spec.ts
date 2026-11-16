// UAT на проді для зрізу 4 «document-parsing» (домашка WS10): AC-DOCAI-04 (людина підтверджує виправлені значення),
// AC-DOCAI-09 (відмова на сторонній текст), AC-DOCAI-14 (вендор не бачить блоку) і AC-DOCAI-16 (прямий запит оминає сторінки).
// Дослівні AC — requirements/59-parse-a-document-confirm-values.md (solomchaak/property-workflows-spec#59).
// AC-DOCAI-04 і AC-DOCAI-09 ходять до справжньої безкоштовної моделі на проді: ліміт — 20 запитів на хвилину й 50 на добу
// на акаунт, тож їх запускають по одному (`npm run uat -- --url … --grep "AC-DOCAI-04"`). Користувачі й запуски синтетичні
// (uat-<запуск>-<мітка>@example.test), їх прибирає deleteUatUsers() з ./admin разом із записами документів.
import { expect, test, type Page } from "@playwright/test";
import { deleteUatUsers } from "./support/admin";
import type { UatUser } from "./support/data";
import { attachRuntimeErrors, given, signIn, thenStep, when } from "./support/uat";
import { createUatUser, launchUatRun, userClient } from "./support/vendor-data";

const LEAK_EMAIL =
  "Subject: Dripping tap. Hi, the kitchen tap in apartment 12 has been dripping for three days. Please send someone this week. My phone is 555-0101. Lena Test";
const MENU = "Tonight's menu: tomato soup 6.50, roast chicken 14.00, apple pie 5.00";
const AI_TIMEOUT = 90_000;

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.afterAll(async () => {
  await deleteUatUsers();
});

async function signedInAs(page: Page, user: UatUser) {
  await signIn(page, user.email, user.password);
  await page.goto("/");
}

/** Вставляє текст у блок «Parse a document» і обирає «Propose values». */
async function propose(page: Page, text: string) {
  await page.getByLabel("Email, call transcript or estimate").fill(text);
  await page.getByRole("button", { name: "Propose values" }).click();
}

test(
  'AC-DOCAI-04: run manager A changes Urgency to "urgent" and saves; the page of the run shows one saved record with the type, the values, the email of A and the date and time',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOCAI-04" } },
  async ({ page }) => {
    test.setTimeout(150_000);
    let managerA!: UatUser;
    let runId!: string;

    await given(
      'run manager A with Document type "Maintenance request", Phone "555-0101", Category "plumbing" and Urgency "not urgent" proposed in the block',
      async () => {
        managerA = await createUatUser("d04-a", "manager");
        runId = await launchUatRun(managerA, "Apartment 12, leak");
        await signedInAs(page, managerA);
        await page.goto(`/runs/${runId}`);
        await propose(page, LEAK_EMAIL);
        await expect(page.getByLabel("Phone")).toHaveValue("555-0101", { timeout: AI_TIMEOUT });
        await expect(page.locator("#doc-type")).toContainText("Maintenance request");
        await expect(page.locator("#doc-category")).toContainText("plumbing");
        await expect(page.locator("#doc-urgency")).toContainText("not urgent");
      },
    );
    await when('A changes Urgency to "urgent" and chooses "Save values"', async () => {
      await page.locator("#doc-urgency").click();
      await page.getByRole("option", { name: "urgent", exact: true }).click();
      await page.getByRole("button", { name: "Save values" }).click();
    });

    await thenStep(
      page,
      {
        clause:
          'The page of the run shows one saved record with Document type "Maintenance request", Phone "555-0101", Category "plumbing" and Urgency "urgent", the email of A and the date and time of the confirmation.',
        visible: [
          'one saved record with Document type "Maintenance request"',
          'Phone "555-0101", Category "plumbing" and Urgency "urgent"',
          "the email of A and the date and time of the confirmation",
        ],
      },
      async () => {
        const records = page.getByTestId("document-record");
        await expect(records).toHaveCount(1, { timeout: 30_000 });
        const record = records.first();
        await expect(record).toContainText("Maintenance request");
        await expect(record).toContainText("555-0101");
        await expect(record).toContainText("plumbing");
        await expect(record.getByText("urgent", { exact: true })).toBeVisible();
        await expect(record.getByText("not urgent", { exact: true })).toHaveCount(0);
        await expect(record).toContainText(managerA.email);
        await expect(record).toContainText(/\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}/);
      },
    );
  },
);

test(
  'AC-DOCAI-09: run manager A pastes a restaurant menu; the block shows "This document is not a maintenance request or an estimate." and no value is proposed',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOCAI-09" } },
  async ({ page }) => {
    test.setTimeout(150_000);
    await given('run manager A and the pasted text "Tonight\'s menu: tomato soup 6.50, roast chicken 14.00, apple pie 5.00"', async () => {
      const managerA = await createUatUser("d09-a", "manager");
      const runId = await launchUatRun(managerA, "Apartment 12, leak");
      await signedInAs(page, managerA);
      await page.goto(`/runs/${runId}`);
      await page.getByLabel("Email, call transcript or estimate").fill(MENU);
    });
    await when('A chooses "Propose values"', async () => {
      await page.getByRole("button", { name: "Propose values" }).click();
    });

    await thenStep(
      page,
      {
        clause: 'The block shows "This document is not a maintenance request or an estimate." and no value is proposed.',
        visible: ['the message "This document is not a maintenance request or an estimate."', "no Document type, no values and no button \"Save values\""],
      },
      async () => {
        const main = page.getByRole("main");
        await expect(main.getByText("This document is not a maintenance request or an estimate.")).toBeVisible({ timeout: AI_TIMEOUT });
        await expect(main.getByText("Document type")).toHaveCount(0);
        await expect(main.getByRole("button", { name: "Save values" })).toHaveCount(0);
        await expect(page.getByTestId("document-record")).toHaveCount(0);
      },
    );
  },
);

test(
  'AC-DOCAI-14: vendor V who is the assignee of tasks 3 and 4 opens the page of the run and does not see the block "Parse a document"',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOCAI-14" } },
  async ({ page }) => {
    await given('vendor V who is the assignee of tasks 3 and 4 in the run "Apartment 12, move-in"', async () => {
      const managerA = await createUatUser("d14-a", "manager");
      const vendorV = await createUatUser("d14-v", "vendor");
      const runId = await launchUatRun(managerA, "Apartment 12, move-in", { vendor: vendorV, taskNumbers: [3, 4] });
      await signedInAs(page, vendorV);
      await page.goto(`/runs/${runId}`);
    });
    await when("V opens the page of this run", async () => {
      await expect(page.getByRole("heading", { level: 1, name: "Apartment 12, move-in" })).toBeVisible();
    });

    await thenStep(
      page,
      {
        clause: 'V does not see the block "Parse a document".',
        visible: ['the page of the run "Apartment 12, move-in" with the tasks of V', 'no block "Parse a document", no "Propose values"'],
      },
      async () => {
        const main = page.getByRole("main");
        await expect(main.getByTestId("run-task")).toHaveCount(2);
        await expect(main.getByText("Parse a document")).toHaveCount(0);
        await expect(main.getByRole("button", { name: "Propose values" })).toHaveCount(0);
      },
    );
  },
);

test(
  'AC-DOCAI-16: vendor V, or manager B who is not the run manager, tries to save values for the run directly, bypassing the pages; no record is saved',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOCAI-16" } },
  async ({ page }) => {
    let managerA!: UatUser;
    let vendorV!: UatUser;
    let managerB!: UatUser;
    let runId!: string;
    const rejected: Record<string, boolean> = {};

    await given('vendor V, or manager B who is not the run manager, in the run "Apartment 12, move-in"', async () => {
      managerA = await createUatUser("d16-a", "manager");
      vendorV = await createUatUser("d16-v", "vendor");
      managerB = await createUatUser("d16-b", "manager");
      runId = await launchUatRun(managerA, "Apartment 12, move-in", { vendor: vendorV, taskNumbers: [3, 4] });
    });
    await when("they try to ask the AI for values or to save values for this run directly, bypassing the pages of the application", async () => {
      for (const [who, user] of [["V", vendorV], ["B", managerB]] as const) {
        const client = await userClient(user);
        const { data: canManage } = await client.rpc("can_manage_run", { p_run_id: runId });
        const { error } = await client
          .from("run_document_values")
          .insert({ run_id: runId, kind: "request", values: { phone: "555-0101", description: null, category: null, urgency: null } });
        rejected[who] = canManage !== true && error !== null;
      }
    });

    await thenStep(
      page,
      {
        clause: 'They receive no value, no record is saved, and they see the message "Not enough rights".',
        visible: ["the page of the run of manager A shows no saved record after the direct requests"],
        hidden: [
          "the check of the right on the run answered no for V and for B",
          "the direct insert was refused by the database for V and for B",
          'the message "Not enough rights" of a refused Server Action is proved by tests/document-actions.test.ts (the direct request has no screen)',
        ],
      },
      async () => {
        expect(rejected, "прямі запити мали бути відхилені для V і для B").toEqual({ V: true, B: true });
        await signedInAs(page, managerA);
        await page.goto(`/runs/${runId}`);
        await expect(page.getByRole("heading", { level: 2, name: "Parse a document" })).toBeVisible();
        await expect(page.getByTestId("document-record")).toHaveCount(0);
      },
    );
  },
);
