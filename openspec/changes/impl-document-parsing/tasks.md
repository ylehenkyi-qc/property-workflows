# Tasks

Кожна група — окремий PR «Реалізація» (`task/<коротко>`); галочки групи ставимо в її PR. Спершу має бути злитий PR «Специфікація» з `add-document-parsing` (інакше тести з AC-DOCAI дадуть ORPHAN). Перед кодом сторінок читаємо гайд у `node_modules/next/dist/docs/`. Міграції — лише новим файлом `npx supabase migration new`, мітка новіша за `origin/main` (`node scripts/check-migration-order.mjs`). Перед комітом і PR: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run ac:coverage`, `npm run spec:check`, `npm run spec:validate`, `npm run check:design`, `npm run check:boundary`. Server Action починається з `requireRole(...)`; ключ моделі — лише в `src/lib/ai/openrouter.ts`. Кожен AC — тест, назва починається з AC ID, очікування — значення з «Тоді». Рядки AC групи в `docs/conformance.md` — у тому самому PR («реалізовано» лише з непропущеним тестом). Дані лише синтетичні, значення ключів — ніколи в git.

## 1. Основа: ADR, залежності, обгортка моделі
- [x] 1.1 ADR `docs/decisions/0005-ai-document-parsing-openrouter.md` (шаблон набору курсу); точні залежності `ai@7.0.162`, `@openrouter/ai-sdk-provider@3.1.0`, `zod@4.6.7`, `server-only@0.0.1`; скрипти `eval`, `ai:models`, `ai:quota`; `OPENROUTER_API_KEY=` у `.env.example`.
- [x] 1.2 `src/lib/ai/{openrouter,models}.ts`, `tests/ai-key.test.ts`: ключ лише в одному файлі з `server-only`, жодного `NEXT_PUBLIC_`, `productModel()` без ключа (і з пробілами) повертає `null`.
Done when: AC-DOCAI-09 (частина «немає ключа»: `productModel()` без ключа чи з пробілами повертає `null`, функція недоступна, а не падає); `npm test` і `npm run lint` зелені без ключа, `tests/ai-key.test.ts` зелений (межа ключа).

## 2. Схема, промпт і пропозиція значень
- [x] 2.1 `src/lib/ai/schema.ts`, `prompts/parse.ts` (`PARSE_PROMPT_VERSION`, межі `<document>`), `parse.ts`, правила з коду (сума рядків, перелік категорій, тексти відмови й приміток); збої → стан unavailable.
- [x] 2.2 Тести з мок-моделлю: значення з «Тоді» кожного AC, відмова без значень, ін'єкція, збої (429, HTTP 5xx, мережева помилка, таймаут, не за схемою, немає ключа: будь-який збій → unavailable), `proposeValues` для чужого запуску не викликає модель.
Done when: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-03, AC-DOCAI-04, AC-DOCAI-05, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-09, AC-DOCAI-10, AC-DOCAI-11, AC-DOCAI-12.

## 3. Збереження після підтвердження
- [x] 3.1 Міграція `run_document_values` + `private.can_manage_run` + `public.can_manage_run` + `check (jsonb_typeof(values) = 'object')` + RLS; тести бази (PGlite): менеджер запуску й адмін пишуть і читають, інший менеджер, виконавець і вендор — ні.
- [x] 3.2 Server Actions `proposeValues` (нічого не пише) і `confirmValues` (повторна валідація, запис під сесією користувача); тест «пропозиція нічого не зберігає, зберігається виправлене значення».
Done when: AC-DOCAI-08.

## 4. Інтерфейс сторінки запуску
- [x] 4.1 `npx shadcn@latest add textarea`; блок «Parse a document» на `/runs/[id]` для менеджера запуску й адміністратора; стани й тексти з design.md; `npm run check:design`, `npm run lint`.
- [x] 4.2 Тест сторінки: відмова, попередження, примітка, «not found», недоступність із ручною формою.
Done when: AC-DOCAI-03, AC-DOCAI-05, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-09.

## 5. Офлайн golden cases
- [x] 5.1 `tests/fixtures/golden/cases.json` (10 кейсів #40, позначка «тимчасові, від розробника»), `tests/golden.test.ts` з реплеєм `recorded.json`.
Done when: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-03, AC-DOCAI-04, AC-DOCAI-05, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-10, AC-DOCAI-11, AC-DOCAI-12.

## 6. Живий eval
- [ ] 6.1 `RECORD=1 npm run eval` (запускає користувач), справжні відповіді в `recorded.json`, звіт `evals/reports/…md`, пояснення кожного FAIL.
Done when: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-03, AC-DOCAI-04, AC-DOCAI-05, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-10, AC-DOCAI-11, AC-DOCAI-12 (звіт eval; чесний pass rate).

## 7. Прод, UAT і здача
- [ ] 7.1 `OPENROUTER_API_KEY` у Vercel Production; `/api/health` із SHA `main`; UAT на проді на 2 AC (AC-DOCAI-08 і AC-DOCAI-06 чи AC-DOCAI-09), звіт у `docs/qa/uat/<дата>/`; `docs/conformance.md` на кожен AC.
- [ ] 7.2 Archive `npx openspec archive impl-document-parsing -y`; файл здачі `submissions/property-workflows/ylehenkyi-qc.md` у репо домашки WS10.
Done when: AC-DOCAI-08, AC-DOCAI-06.
