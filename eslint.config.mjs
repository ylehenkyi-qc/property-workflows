import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import vitest from "@vitest/eslint-plugin";
import playwright from "eslint-plugin-playwright";

// AC ID, як його читає ac:coverage (scripts/lib/spec-lib.mjs): лише на початку назви тесту.
const AC = String.raw`AC-[A-Z]+-\d+`;
// Власні модулі, які не мокаємо: src/lib/** (крім адаптерів src/lib/supabase/**) і src/app/** — через аліас
// (@/lib/…, @/app/…) або відносним шляхом (../../src/lib/…). У регулярному виразі esquery не може бути «/», тому
// роздільник — «.».
const OWN_MODULE = String.raw`/^(@|.*src).(lib.(?!supabase([^A-Za-z0-9_-]|$))[A-Za-z0-9_-]|app([^A-Za-z0-9_-]|$))/`;
const NO_OWN_MOCK =
  "Не мокайте власні модулі (src/lib/**, src/app/**) — тестуйте справжній код: SQL/RLS на PGlite, " +
  "введення-виведення — через передані залежності. Мок клієнта Supabase (@/lib/supabase/*) дозволено.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Дані для тестів скриптів (навмисно «зламані» файли).
    "tests/fixtures/**",
    // WS8 · Звіти й тимчасові копії інструментів якості (ESLint не читає .gitignore): покриття, Stryker (звіт і
    // пісочниця), кеш і копії мутантів fallow, звіти, відео й траси Playwright, сесії тестових ролей.
    "coverage/**",
    "reports/**",
    ".stryker-tmp/**",
    ".fallow/**",
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
    "playwright/.auth/**",
  ]),
  // Дизайн-система (DESIGN.md, розділ 5): випадні списки, календарі й діалоги малює застосунок, а не ОС, щоб вони
  // слідували за темою. Нативні віджети заборонені поза src/components/ui (там — оболонки shadcn).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='select'], JSXOpeningElement[name.name='option'], JSXOpeningElement[name.name='datalist']",
          message: "Нативний <select>/<option>/<datalist> заборонено: використовуйте AppSelect (DESIGN.md, розділ 5).",
        },
        {
          selector:
            "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value=/^(date|datetime-local|time|month|week|color|range|file)$/]",
          message:
            "Нативні поля дати, часу, кольору, діапазону й файлу заборонені: використовуйте компоненти з DESIGN.md, розділ 5 (Calendar + Popover для дат).",
        },
        {
          // той самий тип, але як вираз: type={"date"} або type={`date`}
          selector:
            "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'] > JSXExpressionContainer > :matches(Literal[value=/^(date|datetime-local|time|month|week|color|range|file)$/], TemplateLiteral[quasis.0.value.cooked=/^(date|datetime-local|time|month|week|color|range|file)$/])",
          message:
            "Нативні поля дати, часу, кольору, діапазону й файлу заборонені: використовуйте компоненти з DESIGN.md, розділ 5 (Calendar + Popover для дат).",
        },
        {
          selector: "CallExpression[callee.name=/^(alert|confirm|prompt)$/], CallExpression[callee.object.name='window'][callee.property.name=/^(alert|confirm|prompt)$/]",
          message: "alert()/confirm()/prompt() заборонені: використовуйте Dialog або Alert (DESIGN.md, розділ 5).",
        },
      ],
    },
  },
  // buttonVariants не зливає класи: на посиланні лишаються разом border-transparent і border-input. Посилання-кнопка —
  // лише через linkButtonClass (src/lib/ui/link-button.ts), який зливає їх через cn.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**", "src/lib/ui/link-button.ts", "src/lib/ui/link-button.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/ui/button",
              importNames: ["buttonVariants"],
              message: "Для посилання-кнопки використовуйте linkButtonClass з @/lib/ui/link-button (DESIGN.md, розділ 5).",
            },
          ],
        },
      ],
    },
  },
  // WS8 · Тести Vitest: вимкнений, сфокусований, порожній чи умовний тест — помилка, а не попередження.
  // `npm run lint` має --max-warnings 0 в обов'язковому job app, тож «warn» тут теж валив би CI — пишемо чесно error.
  {
    files: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      // .skip / .todo ховають AC від перевірки (у recommended — warn).
      "vitest/no-disabled-tests": "error",
      // AC ID — лише на початку назви: «… AC-ROOM-04 …» посередині ac:coverage не порахує.
      "vitest/valid-title": [
        "error",
        { mustNotMatch: [String.raw`^(?!${AC}).*\b${AC}`, "AC ID — на самому початку назви тесту, інакше ac:coverage його не порахує."] },
      ],
      // Тест, що розгалужується, сам вирішує, чи щось перевіряти.
      "vitest/no-conditional-in-test": "error",
      "vitest/no-conditional-expect": "error",
      // expect(value, "пояснення") — коректний Vitest.
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      // Помічники на кшталт expectNoInvite() теж перевірки.
      "vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "expect*"] }],
      // rejects.toThrow() без тексту проходить на БУДЬ-ЯКІЙ помилці (одруківка в SQL, немає grant), а не на відмові з AC.
      "vitest/require-to-throw-message": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: `CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/][arguments.0.value=${OWN_MODULE}]`,
          message: NO_OWN_MOCK,
        },
        {
          // vi.mock(import("@/lib/…")) — та сама заборона для форми з import().
          selector: `CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/][arguments.0.source.value=${OWN_MODULE}]`,
          message: NO_OWN_MOCK,
        },
      ],
    },
  },
  // WS8 · E2E/UAT (Playwright) — лише tests/e2e/**. Правила recommended закривають те, чого Playwright не має сам:
  // тест без перевірки (expect-expect), пропущений чи сфокусований тест, waitForTimeout і networkidle.
  // lint іде з --max-warnings 0, тож і «warn» тут — червоний app.
  {
    ...playwright.configs["flat/recommended"],
    files: ["tests/e2e/**"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      // Перевірки AC живуть у thenStep(…) (tests/e2e/support/uat.ts): він і є expect для цього правила.
      "playwright/expect-expect": ["error", { assertFunctionNames: ["thenStep"] }],
    },
  },
  // WS8 · НЕОБОВ'ЯЗКОВО: правила з інформацією про типи для коду застосунку (забута await у server action, неповний
  // switch за роллю). У демо — 0 знахідок, але на вашому src/ можуть бути знахідки, і тоді обов'язковий app стане
  // червоним. Вмикайте окремим PR, коли готові виправити все, що вони знайдуть.
  // {
  //   files: ["src/**/*.{ts,tsx}"],
  //   languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  //   rules: {
  //     "@typescript-eslint/no-floating-promises": "error",
  //     "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
  //     "@typescript-eslint/switch-exhaustiveness-check": "error",
  //   },
  // },
]);

export default eslintConfig;
