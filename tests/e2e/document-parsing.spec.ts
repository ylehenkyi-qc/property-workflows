// UAT на проді для зрізу 4 «document-parsing» (домашка WS10): AC-DOCAI-04 (людина підтверджує виправлені значення),
// AC-DOCAI-09 (відмова на сторонній текст), AC-DOCAI-14 (вендор не бачить блоку) і AC-DOCAI-16 (прямий запит оминає сторінки).
// Дослівні AC — requirements/59-parse-a-document-confirm-values.md (solomchaak/property-workflows-spec#59).
// AC-DOCAI-04 і AC-DOCAI-09 ходять до справжньої безкоштовної моделі на проді: ліміт — 20 запитів на хвилину й 50 на добу
// на акаунт, тож їх запускають по одному (`npm run uat -- --url … --grep "AC-DOCAI-04"`). Користувачі й запуски синтетичні
// (uat-<запуск>-<мітка>@example.test), їх прибирає deleteUatUsers() з ./admin разом із записами документів.
import { expect, test, type Browser, type Page } from "@playwright/test";
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
        await record.scrollIntoViewIfNeeded(); // запис має бути в кадрі «Тоді»
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
        const refusal = main.getByText("This document is not a maintenance request or an estimate.");
        await expect(refusal).toBeVisible({ timeout: AI_TIMEOUT });
        // Кадр «Тоді» — лише видима частина вікна: прокручуємо донизу, щоб у кадрі було повідомлення й порожнє місце під ним
        // (ні типу документа, ні значень, ні «Save values»).
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
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

/** Запит Server Action «Propose values», перехоплений на сторінці менеджера A: адреса, ідентифікатор дії й тіло. */
type CapturedAction = { url: string; actionId: string; body: string };

async function captureProposeAction(page: Page, runId: string): Promise<CapturedAction> {
  let captured: CapturedAction | undefined;
  // Перехоплюємо POST Server Action лише щоб запам'ятати його й пропускаємо далі: запит менеджера A справжній (одне звернення
  // до моделі), тож сторінка A не отримує мережевої помилки, а сам запит ми повторимо від сесій V і B.
  await page.route("**/runs/**", async (route) => {
    const request = route.request();
    const actionId = request.headers()["next-action"];
    if (request.method() === "POST" && actionId) {
      captured = { url: request.url(), actionId, body: request.postData() ?? "" };
    }
    return route.continue();
  });
  await page.goto(`/runs/${runId}`);
  await page.getByLabel("Email, call transcript or estimate").fill(LEAK_EMAIL);
  await page.getByRole("button", { name: "Propose values" }).click();
  await expect.poll(() => captured, { message: "не вдалося перехопити Server Action «Propose values»" }).toBeDefined();
  // Чекаємо відповіді A (пропозиція чи «assistant is not available»): навігація посеред запиту дала б помилку сторінки.
  await expect(page.getByLabel("Phone")).toBeVisible({ timeout: AI_TIMEOUT });
  await page.unroute("**/runs/**");
  return captured!;
}

/** Той самий запит Server Action від імені іншого користувача (його сесія в окремому контексті браузера). */
async function replayProposeAs(browser: Browser, baseURL: string | undefined, user: UatUser, action: CapturedAction): Promise<string> {
  const context = await browser.newContext({ baseURL });
  try {
    const other = await context.newPage();
    await signIn(other, user.email, user.password);
    const response = await context.request.post(action.url, {
      headers: {
        "next-action": action.actionId,
        "content-type": "text/plain;charset=UTF-8",
        accept: "text/x-component",
        origin: new URL(action.url).origin, // Server Actions перевіряють Origin (захист від CSRF)
      },
      data: action.body,
    });
    return await response.text();
  } finally {
    await context.close();
  }
}

test(
  'AC-DOCAI-16: vendor V, or manager B who is not the run manager, tries to ask the AI for values or to save values for the run directly, bypassing the pages; they receive no value and no record is saved',
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-DOCAI-16" } },
  async ({ page, browser }) => {
    let managerA!: UatUser;
    let vendorV!: UatUser;
    let managerB!: UatUser;
    let runId!: string;
    let action!: CapturedAction;
    const answers: Record<string, string> = {};
    const rejectedSave: Record<string, boolean> = {};

    await given('vendor V, or manager B who is not the run manager, in the run "Apartment 12, move-in"', async () => {
      managerA = await createUatUser("d16-a", "manager");
      vendorV = await createUatUser("d16-v", "vendor");
      managerB = await createUatUser("d16-b", "manager");
      runId = await launchUatRun(managerA, "Apartment 12, move-in", { vendor: vendorV, taskNumbers: [3, 4] });
      await signedInAs(page, managerA);
      action = await captureProposeAction(page, runId);
    });
    await when("they try to ask the AI for values or to save values for this run directly, bypassing the pages of the application", async () => {
      const baseURL = test.info().project.use.baseURL;
      for (const [who, user] of [["V", vendorV], ["B", managerB]] as const) {
        // 1) прямий запит значень: той самий Server Action, що викликає кнопка «Propose values», але з сесією V чи B;
        answers[who] = await replayProposeAs(browser, baseURL, user, action);
        // 2) прямий запис значень у базу (Data API) із сесією V чи B.
        const client = await userClient(user);
        const { error } = await client
          .from("run_document_values")
          .insert({ run_id: runId, kind: "request", values: { phone: "555-0101", description: null, category: null, urgency: null } });
        rejectedSave[who] = error !== null;
      }
    });

    await thenStep(
      page,
      {
        clause: 'They receive no value, no record is saved, and they see the message "Not enough rights".',
        visible: ['the end of the page of the run of manager A: under the block "Parse a document" there is no section "Saved records" and no record after the direct requests'],
        hidden: [
          'the Server Action that asks the AI for values answered {"status":"forbidden"} for V and for B, without any proposal (the model is not called)',
          "the direct insert of values was refused by the database for V and for B",
          'the page shows "Not enough rights" for the status "forbidden" of a Server Action: proved by src/lib/ai/block-state.test.ts and tests/document-actions.test.ts (a direct request has no screen)',
        ],
      },
      async () => {
        for (const who of ["V", "B"]) {
          expect(answers[who], `${who}: Server Action мав відповісти forbidden`).toContain('"status":"forbidden"');
          expect(answers[who], `${who}: жодної пропозиції`).not.toContain('"proposal"');
        }
        expect(rejectedSave, "прямий запис значень мав бути відхилений для V і для B").toEqual({ V: true, B: true });
        await signedInAs(page, managerA);
        await page.goto(`/runs/${runId}`);
        await expect(page.getByRole("heading", { level: 2, name: "Parse a document" })).toBeVisible();
        await expect(page.getByTestId("document-record")).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "Saved records" })).toHaveCount(0);
        // Кадр «Тоді» — лише видима частина вікна: робимо вікно вищим, щоб уся сторінка з порожнім місцем під блоком була в кадрі
        // і було видно, що розділу «Saved records» нижче немає.
        await page.setViewportSize({ width: 1280, height: 1300 });
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      },
    );
  },
);
