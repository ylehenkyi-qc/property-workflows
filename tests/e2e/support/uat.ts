// UAT-кроки: кожне «Дано / Коли / Тоді» з AC — окремий test.step, а кожне «Тоді» лишає докази для агента-рецензента:
// кадр екрана, aria-знімок сторінки і список частин «Тоді», які людина БАЧИТЬ (агент має їх процитувати з кадру).
// Невидимі частини (буфер обміну, рядки в базі, «даних немає») вирішують лише автоматичні перевірки.
// Джерело: демо-репо курсу, tests/e2e/support/uat.ts (тег ws8-03-uat). Змінюйте лише signIn (форма входу).
import { test, type Locator, type Page } from "@playwright/test";

export type ThenSpec = {
  /** Частина «Тоді» — дослівно з AC від PM. */
  clause: string;
  /** Що має бути видно на екрані; агент підтверджує кожну частину цитатою з кадру. */
  visible: string[];
  /** Що доводить лише перевірка (не з кадрів). */
  hidden?: string[];
  /** Що замазати на кадрі: живі облікові дані, наприклад посилання для активації. */
  mask?: Locator[];
};

// Номер «Тоді» в межах тесту. Лічильник за testId, а не test.beforeEach у цьому модулі: модуль кешується,
// і хук зареєструвався б лише у файлі, який імпортував його першим.
const thenCounters = new Map<string, number>();

export async function given(title: string, body: () => Promise<void>) {
  await test.step(`Дано: ${title}`, body);
}

export async function when(title: string, body: () => Promise<void>) {
  await test.step(`Коли: ${title}`, body);
}

/**
 * «Тоді»: спершу детерміновані перевірки, потім — ЗАВЖДИ, навіть якщо вони впали, — докази.
 * Назва thenStep, а не then: модуль з експортом then стає thenable, і await import() поводиться дивно.
 */
export async function thenStep(page: Page, spec: ThenSpec, assertions: () => Promise<void>) {
  const { testId } = test.info();
  const n = (thenCounters.get(testId) ?? 0) + 1;
  thenCounters.set(testId, n);

  await test.step(`Тоді: ${spec.clause}`, async () => {
    let passed = false;
    try {
      await assertions();
      passed = true;
    } finally {
      // Помилка перевірки летить далі (тест червоний), а докази знято в будь-якому разі. Якщо перевірка впала, а
      // кадр теж не вдалося зняти (сторінка закрита), помилка кадру не має затирати справжню причину FAIL.
      // Локальна правка WS8 за зауваженням CodeRabbit.
      try {
        await captureEvidence(page, n, spec, passed);
      } catch (evidenceError) {
        // eslint-disable-next-line playwright/no-conditional-in-test -- допоміжна функція, не тест: умова вибирає, яку помилку показати
        if (passed) throw evidenceError;
      }
    }
  });
}

async function captureEvidence(page: Page, n: number, spec: ThenSpec, assertionsPassed: boolean) {
  const info = test.info();
  // Накладки відео (назва тесту й кроку, підказки дій, курсор) вбудовано в саму сторінку, тож вони потрапляють
  // і в page.screenshot(). Назва кроку МІСТИТЬ очікуваний текст «Тоді» — без hideOverlays агент «бачив» би його.
  await page.screencast.hideOverlays().catch(() => {});
  await page.screencast.hideActions().catch(() => {});
  await info.attach(`then-${n}.png`, {
    body: await page.screenshot({ mask: spec.mask ?? [], maskColor: "#6b7280" }),
    contentType: "image/png",
  });
  await page.screencast.showOverlays().catch(() => {});
  await info.attach(`then-${n}.aria.yml`, {
    body: await page.locator("body").ariaSnapshot(),
    contentType: "text/yaml",
  });
  const meta = { n, url: page.url(), clause: spec.clause, visible: spec.visible, hidden: spec.hidden ?? [], assertionsPassed };
  await info.attach(`then-${n}.json`, { body: JSON.stringify(meta, null, 2), contentType: "application/json" });
}

/** Помилки консолі, необроблені помилки сторінки й відповіді 5xx за час тесту (API Playwright 1.56+). */
export async function attachRuntimeErrors(page: Page) {
  const consoleErrors = (await page.consoleMessages({ filter: "all" }))
    .filter((m) => m.type() === "error")
    .map((m) => m.text());
  const pageErrors = (await page.pageErrors({ filter: "all" })).map((e) => String(e));
  // r.response() чекає відповіді без кінця, якщо запит ще в польоті (наприклад, префетч посилання): afterEach тоді
  // висить до таймауту тесту. Чекаємо відповідь 3 с; хто не встиг — у списку pending (це не помилка сама по собі).
  // Локальна правка WS8 (прогін на проді: AC-DSYS-02 і AC-TASK-10 упали саме в цьому хуку).
  const responses = await Promise.all(
    (await page.requests()).map(async (r) => {
      const response = await Promise.race([r.response(), new Promise<null>((resolve) => setTimeout(resolve, 3_000, null))]);
      return { r, status: response?.status() ?? 0, pending: response === null && r.failure() === null };
    }),
  );
  const failed = responses
    .filter(({ r, status }) => r.failure() !== null || status >= 500)
    .map(({ r, status }) => `${r.method()} ${new URL(r.url()).pathname} → ${r.failure()?.errorText ?? status}`);
  const pending = responses
    .filter(({ pending: notAnswered }) => notAnswered)
    .map(({ r }) => `${r.method()} ${new URL(r.url()).pathname}${new URL(r.url()).search}`);
  await test.info().attach("runtime-errors.json", {
    body: JSON.stringify({ console: consoleErrors, pageErrors, failed, pending }, null, 2),
    contentType: "application/json",
  });
}

/**
 * Вхід через форму /login. Пароль вводимо через evaluate, а не fill: назва кроку fill містить введене значення,
 * і пароль потрапив би у звіт і трасу.
 * Локатори — наша форма /login (поля «Email» і «Password», кнопка «Sign in») і перехід на «/» після входу.
 */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
  }, password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}
