import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
]);

export default eslintConfig;
