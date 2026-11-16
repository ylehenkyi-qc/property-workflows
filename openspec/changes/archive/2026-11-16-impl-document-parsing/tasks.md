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
- [x] 6.1 `RECORD=1 npm run eval` (запускає користувач), справжні відповіді в `recorded.json`, звіт `evals/reports/…md`, пояснення кожного FAIL.
Done when: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-03, AC-DOCAI-04, AC-DOCAI-05, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-10, AC-DOCAI-11, AC-DOCAI-12 (звіт eval; чесний pass rate).

## 8. Перехід на вимогу PM (AC-DOCAI-01…16; PR після злитого «Специфікація» update-document-parsing)
Групи 1–6 зроблено за тимчасовими AC: після оновлення специфікації (вимога PM solomchaak/property-workflows-spec#59) ті самі ID мають інший зміст. Відповідність старих і нових AC — у proposal архівної зміни `update-document-parsing`.
- [x] 8.1 Перепризначити AC у тестах і golden cases: `cases.json` (поле `ac`: GC-01→01, GC-07→02, GC-04→06, GC-05→07, GC-08→08, GC-09→09, GC-10→10; GC-02, GC-03, GC-06 — golden cases без окремого AC, лише для оцінки якості), `tests/golden.test.ts`, `parse.test.ts`, `document-flow.test.ts`, `tests/document-actions.test.ts`, `proposal-view.test.tsx`, `tests/eval-support.test.ts`; назви тестів починаються з нового AC ID за змістом критерію PM. Тести з ID, чий зміст не збігається з новим, — перейменувати чи прибрати.
Done when: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-08, AC-DOCAI-09, AC-DOCAI-10.
- [x] 8.2 «Document type» (`AppSelect`: «Maintenance request» / «Estimate») у блоці: пропонує AI (`documentType`), користувач може змінити перед збереженням; ручна форма без пропозиції — тип і значення порожні та редаговані (AC-DOCAI-13); «Save values» зберігає тип і значення; збережені записи на сторінці запуску: тип, значення, email того, хто підтвердив, дата й час за Києвом («12 Nov 2026, 10:15»), найновіший першим (AC-DOCAI-04).
Done when: AC-DOCAI-01, AC-DOCAI-04, AC-DOCAI-13.
- [x] 8.3 Стан очікування «Reading the document…» і вимкнена «Propose values» (AC-DOCAI-03); «Discard» очищає блок і нічого не зберігає (AC-DOCAI-05); порожній текст чи самі пробіли — «Paste the text of a document» без звернення до моделі (AC-DOCAI-11); «Upload a text file»: .txt читається в поле, інший файл — «Only plain text files (.txt) are accepted» (AC-DOCAI-12); поле файлу — наш компонент у `src/components/ui` (нативний `input type=file` дозволено лише там), перевірка розширення й типу.
Done when: AC-DOCAI-03, AC-DOCAI-05, AC-DOCAI-11, AC-DOCAI-12.
- [x] 8.4 Права: блок на сторінці запуску лише менеджеру цього запуску й адміністратору (вендор і менеджер-виконавець не бачать — AC-DOCAI-14, AC-DOCAI-15, тест сторінки); прямий виклик `proposeDocumentValues` чи `confirmDocumentValues` вендором або не-менеджером запуску — «Not enough rights», значень і запису немає (AC-DOCAI-16, тест Server Actions і бази).
Done when: AC-DOCAI-14, AC-DOCAI-15, AC-DOCAI-16.
- [x] 8.5 Eval за порогом PM: у звіті — частка успіху з порогом 8 з 10 і окремо «кейси 9 і 10: пройшли чи ні» (вони обов'язкові); опис — за змістом (суддя); за потреби оновити промпт (`PARSE_PROMPT_VERSION`) і перезаписати записи.
Done when: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-08, AC-DOCAI-09, AC-DOCAI-10.

## 7. Прод, UAT і здача
- [x] 7.1 `OPENROUTER_API_KEY` у Vercel Production; `/api/health` із SHA `main`; UAT на проді на 2 AC за вимогою PM (AC-DOCAI-04 — збереження підтверджених значень і AC-DOCAI-09 — відмова на сторонній текст), звіт у `docs/qa/uat/2026-11-16/` (AC-DOCAI-04, 09, 14, 16 — PASS, R6; прогін на проді, SHA main — `/api/health`); `docs/conformance.md` на кожен AC.
- [x] 7.2 Archive `npx openspec archive impl-document-parsing -y` (в останньому PR зрізу).
- [ ] 7.3 Файл здачі `submissions/property-workflows/ylehenkyi-qc.md` у репо домашки WS10 (PR у koldovsky/2026-quitcode-10-ai-features-hw; після merge цього PR: SHA main має містити звіт UAT).
Done when: AC-DOCAI-04, AC-DOCAI-09.
