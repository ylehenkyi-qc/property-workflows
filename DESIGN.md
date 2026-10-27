# Дизайн-система: Property Workflows

- **Джерело:** AI-агент (Claude Code), PR «Реалізація» `task/design-system`; правила — з розділу «Вигляд і тон» PM, значення токенів — рішення розробника (PM задає тон і кольори за значенням, а не конкретні значення: «Which design system to use and how to build it: the developer decides»).
- **Вхід від PM:** розділ «Вигляд і тон» у `requirements/product.md` (знімок 2026-10-26, solomchaak/property-workflows-spec#1) і вимога `requirements/19-use-one-design-system.md` (AC-DSYS-01…04).
- **Код:** токени — `src/app/globals.css`; компоненти — `src/components/ui/` (shadcn/ui); перевірка — `npm run check:design`

## 1. Огляд

Інтерфейс для зайнятого менеджера агенції нерухомості, який переглядає довгий список випадків із ноутбука чи телефона; адміністратор користується тими самими сторінками. Тон — спокійний, діловий, точний; без жартів, знаків оклику, звинувачень («You made a mistake») і жаргону. Щільність важливіша за простір: таблиці щільні, але читаються на телефоні; назва випадку, статус і прогрес — першими, другорядні колонки на вузькому екрані переходять нижче. Тексти — простою англійською (мова інтерфейсу від PM), кнопки починаються з дієслова («Launch», «Save»).

## 2. Кольори

Семантичні токени з іменами shadcn/ui. Значення — OKLCH, мої (PM кольорів не задав; відтінок головного акценту — TODO: питання PM). У сторінках — лише утиліти з колонки «Клас», ніколи hex, `bg-[#…]` чи сирі палітри (`zinc-500`, `bg-white`). Темна тема — за системою (`prefers-color-scheme`); PM темну тему поза межами вимоги, тож вона лише побічний ефект токенів (TODO: питання PM — solomchaak/property-workflows-spec#34).

| Токен | Для чого | Світла | Темна | Клас |
|---|---|---|---|---|
| `background` / `foreground` | тло сторінки й основний текст | `oklch(0.985 0.002 255)` / `oklch(0.21 0.02 255)` | `oklch(0.18 0.01 255)` / `oklch(0.96 0.005 255)` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | картки, панелі, рядки списків | `oklch(1 0 0)` / `oklch(0.21 0.02 255)` | `oklch(0.22 0.012 255)` / `oklch(0.96 0.005 255)` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | діалоги, випадні списки | як `card` | як `card` | `bg-popover`, `text-popover-foreground` |
| `primary` / `primary-foreground` | **головна дія екрана** («Launch», «Save version») — один сильний акцент, не використовується ні для чого іншого | `oklch(0.45 0.15 295)` / `oklch(0.985 0 0)` | `oklch(0.72 0.14 295)` / `oklch(0.2 0.02 295)` | `bg-primary`, `text-primary-foreground` |
| `secondary` / `secondary-foreground` | другорядна дія | `oklch(0.96 0.006 255)` / `oklch(0.21 0.02 255)` | `oklch(0.26 0.012 255)` / `oklch(0.96 0.005 255)` | `bg-secondary`, `text-secondary-foreground` |
| `muted` / `muted-foreground` | приглушене тло, підписи, допоміжний текст | `oklch(0.96 0.006 255)` / `oklch(0.45 0.02 255)` | `oklch(0.26 0.012 255)` / `oklch(0.72 0.015 255)` | `bg-muted`, `text-muted-foreground` |
| `accent` / `accent-foreground` | наведення, вибраний рядок | `oklch(0.95 0.01 255)` / `oklch(0.21 0.02 255)` | `oklch(0.28 0.014 255)` / `oklch(0.96 0.005 255)` | `bg-accent`, `text-accent-foreground` |
| `destructive` / `destructive-foreground` | небезпечна дія (завжди з підтвердженням «This cannot be undone»), текст помилки — **червоний** | `oklch(0.5 0.2 27)` / `oklch(0.985 0 0)` | `oklch(0.72 0.17 25)` / `oklch(0.2 0.02 25)` | `bg-destructive`, `text-destructive` |
| `border` | розділювачі, межі карток | `oklch(0.9 0.005 255)` | `oklch(0.3 0.01 255)` | `border-border` |
| `input` | межа поля вводу | `oklch(0.6 0.01 255)` | `oklch(0.55 0.015 255)` | `border-input` |
| `ring` | кільце фокусу | `oklch(0.5 0.15 295)` | `oklch(0.72 0.14 295)` | `ring-ring` |
| `status-todo` / `-foreground` | статус «to do» — нейтральний сірий | `oklch(0.93 0.005 255)` / `oklch(0.35 0.02 255)` | `oklch(0.3 0.01 255)` / `oklch(0.9 0.01 255)` | `bg-status-todo`, `text-status-todo-foreground` |
| `status-progress` / `-foreground` | статус «in progress» — синій | `oklch(0.92 0.05 255)` / `oklch(0.35 0.12 255)` | `oklch(0.3 0.07 255)` / `oklch(0.9 0.05 255)` | `bg-status-progress`, `text-status-progress-foreground` |
| `status-done` / `-foreground` | статуси «done» і «completed» — зелений | `oklch(0.93 0.07 150)` / `oklch(0.35 0.09 150)` | `oklch(0.3 0.06 150)` / `oklch(0.9 0.07 150)` | `bg-status-done`, `text-status-done-foreground` |
| `status-unpublished` / `-foreground` | позначка «Unpublished changes» — теплий жовтий | `oklch(0.94 0.09 90)` / `oklch(0.38 0.07 70)` | `oklch(0.32 0.06 85)` / `oklch(0.92 0.09 90)` | `bg-status-unpublished`, `text-status-unpublished-foreground` |

Правила за значенням (з PM): головна дія — один акцент, не для іншого; небезпечні дії — інший, попереджувальний колір і завжди підтвердження; **статус ніколи не лише кольором** — слово статусу завжди поруч; помилки — червоні.

### Контраст

Порахований за WCAG (OKLCH → лінійний sRGB → відносна яскравість) тимчасовим скриптом; усі пари проходять норму в обох темах.

| Пара | Світла | Темна | Норма |
|---|---|---|---|
| `foreground` на `background` | 16.96 | 16.74 | ≥ 4.5 |
| `muted-foreground` на `background` | 7.12 | 7.59 | ≥ 4.5 |
| `muted-foreground` на `card` | 7.43 | 6.98 | ≥ 4.5 |
| `primary-foreground` на `primary` | 7.62 | 7.00 | ≥ 4.5 |
| `destructive` на `card` | 6.66 | 6.48 | ≥ 4.5 |
| `status-todo-foreground` на `status-todo` | 9.19 | 10.12 | ≥ 4.5 |
| `status-progress-foreground` на `status-progress` | 8.96 | 10.16 | ≥ 4.5 |
| `status-done-foreground` на `status-done` | 9.06 | 10.13 | ≥ 4.5 |
| `status-unpublished-foreground` на `status-unpublished` | 8.46 | 10.06 | ≥ 4.5 |
| `input` на `card` | 3.94 | 3.57 | ≥ 3 |
| `ring` на `background` | 6.13 | 7.25 | ≥ 3 |

## 3. Типографіка

Шрифт — Geist (`next/font`, `--font-sans`); `font-family: Arial` шаблону прибрано. Мова інтерфейсу — англійська. Числа прогресу («2 of 5 done») і дати — `tabular-nums`.

| Роль | Клас | Де |
|---|---|---|
| Заголовок сторінки | `text-2xl font-semibold` | один на сторінку |
| Заголовок розділу | `text-lg font-semibold` | назва секції (напр. «Before move-in») |
| Основний текст | `text-sm` | рядки таблиць, форми |
| Підпис, допоміжний текст | `text-sm text-muted-foreground` | прогрес, email виконавця, пояснення |

## 4. Відступи й радіуси

- Контент: `mx-auto w-full max-w-3xl px-4 py-8 sm:px-6`; вузькі форми — `max-w-xl`.
- Відступи між блоками — `gap-6`, всередині групи — `gap-2`/`gap-4`; щільні таблиці — `py-2`.
- Радіус `--radius: 0.625rem`; похідні `rounded-md` (поля, кнопки), `rounded-lg` (картки).
- Секондарні колонки таблиць на вузькому екрані переходять під головний рядок (`flex-col sm:flex-row`).

## 5. Компоненти й варіанти

Лише з `@/components/ui` і власні обгортки `StatusBadge`, `PageMessage` у `src/components/`. Нові компоненти — `npx shadcn@latest add <назва>`.

| Компонент | Варіанти | Правило |
|---|---|---|
| `Button` | `default`, `secondary`, `outline`, `ghost`, `destructive`, `link` | `default` — одна основна дія на екран («Launch», «Save version»); `destructive` — лише з діалогом і текстом «This cannot be undone»; текст кнопки починається з дієслова |
| `Input` + `Label` | — | у кожного поля `Label` з `htmlFor`; placeholder — не замість підпису |
| `Select` | — | вибір шаблону й виконавця; підпис через `Label` |
| `Card` | — | рядок списку й панель; без вкладених карток |
| `Table` | — | щільна; лише для порівнянних рядків; перші колонки — назва, статус, прогрес |
| `Badge` / `StatusBadge` | `to do`, `in progress`, `done`/`completed`, `Unpublished changes` | статус — завжди слово + колір із токенів `status-*`, ті самі в списку й на сторінці |
| `Dialog` | — | підтвердження небезпечних і незворотних дій: назва об'єкта + «This cannot be undone» + «Confirm»/«Cancel» |
| `Alert` | `default`, `destructive` | помилка дії над формою; текст — дослівно з AC |
| `PageMessage` | — | відмова в доступі, «Run not found», порожній стан: заголовок/текст + посилання на наступний крок, у тому самому макеті сторінки |

## 6. Стани

Тексти дослівно з AC PM, де вони є.

| Стан | Як виглядає | Приклад тексту |
|---|---|---|
| Порожній список | `PageMessage` + посилання на наступний крок, без порожньої таблиці | «No runs yet. Launch a template to start one.» і посилання «Launch a template» (AC-DSYS-04) |
| Помилка дії | `Alert` (destructive) над формою; введене лишається у формі | «Enter a case name», «Case name must be at most 100 characters», «A template needs at least one required task» |
| Відмова в доступі | `PageMessage` у загальному макеті, без даних, посилання назад | «Not enough rights» і «Back to templates» (AC-DSYS-02), «Run not found» (AC-TASK-10) |
| Не увійшов | сторінка входу в загальному макеті, без даних | сторінка входу (AC-DSYS-03) |
| Завантаження | TODO: питання PM (у вимогах не описано) | — |
| Успіх | коротке повідомлення в тому самому місці, без вспливаючих вікон | «Version 2 saved» (приклад PM із «Вигляд і тон») |
| Вимкнена дія | `disabled` + пояснення поруч | — |

## 7. Доступність — мінімум

- Label у кожного поля; помилка поля пов'язана з полем (`aria-describedby`).
- Видимий фокус: `ring` на кожному інтерактивному елементі; Tab проходить форму по порядку; усе працює з клавіатури.
- Контраст — таблиця в розділі 2 (текст ≥ 4.5:1, межі полів і фокус ≥ 3:1).
- Статус ніколи не лише кольором — поруч завжди текст.
- Спершу семантичний HTML (`<button>`, `<table>`, `<label>`); `aria-*` — там, де HTML бракує, а не замість нього.

## 8. Do / Don't

| ✅ Робимо | ❌ Не робимо |
|---|---|
| `bg-primary text-primary-foreground` для єдиної головної дії екрана | `bg-zinc-900 text-white`, `bg-[#0f6b6e]`, `style={{ color: "#…" }}` |
| компонент `Button` з потрібним варіантом | власний `<button className="…">` у сторінці |
| `StatusBadge` для кожного статусу, слово + колір | колір без слова статусу, сірий текст замість бейджа |
| новий токен через розділ 9 | новий колір «лише для цієї сторінки» |
| `PageMessage` для відмов і порожніх станів | вигадувати окремий макет для відмови чи порожнього списку |
| прості повідомлення англійською, без «!» | жарти, звинувачення («You made a mistake»), жаргон |
| щільні таблиці, що читаються на телефоні | яскраві градієнти, декоративна анімація, дрібний сірий текст, іконки без підпису, спливаючі вікна для рутинної інформації |

## 9. Як додати токен

1. Опишіть токен у таблиці розділу 2: для чого, значення в обох темах, контраст.
2. `src/app/globals.css`: `--<назва>` у `:root` і в `@media (prefers-color-scheme: dark)`.
3. `--color-<назва>: var(--<назва>);` у `@theme inline` → з'являються класи `bg-<назва>`, `text-<назва>`, `border-<назва>`.
4. `npm run check:design` і знімок сторінки у світлій і темній темі.

## 10. Перевірка

- `npm run check:design` — жодного hex, довільного кольору, сирої палітри чи кольору в inline style поза
  `src/components/ui` і `globals.css`. CI: `.github/workflows/architecture.yml`, job «Дизайн-система: лише токени».
- Виняток — коментар `design-ok: <причина>` у тому самому рядку; кожен виняток — з реальною причиною.
- Візуально: знімки ключових сторінок у світлій і темній темі (`docs/img/ws7-before-*`, `ws7-after-*`), Tab по формі, контраст.
