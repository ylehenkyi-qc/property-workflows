# Proposal

## Why

Менеджер агенції отримує вільний текст — лист орендаря чи кошторис вендора — і вручну переписує з нього телефон, опис, категорію, терміновість або рядки кошторису: це повільно й схильне до помилок. Після цієї вимоги менеджер вставляє текст (або завантажує текстовий файл) на сторінці запуску, AI пропонує значення, а менеджер перевіряє й підтверджує їх; AI ніколи не вирішує сам, і нічого не зберігається, доки людина не підтвердила (розділ «Навіщо» вимоги `requirements/59-parse-a-document-confirm-values.md`, джерело — https://github.com/solomchaak/property-workflows-spec/issues/59, оновлено 2026-11-16).

Раніше вимоги PM зрізу 4 не було, і специфікація `document-parsing` містила **тимчасові AC розробника** `AC-DOCAI-01…12` за golden cases https://github.com/solomchaak/property-workflows-spec/issues/40. PM опублікував вимогу з критеріями `AC-DOCAI-01…16` («the provisional AC-DOCAI-NN of the developers are replaced by the criteria of the requirement with the same prefix», https://github.com/solomchaak/property-workflows-spec/issues/55). Ця зміна переводить специфікацію на критерії PM: ID ті самі за префіксом, **зміст — з вимоги PM**, тож деякі ID тепер означають інший сценарій.

## What Changes

Кожен AC PM — рівно один сценарій із тим самим ID (16 сценаріїв). Відповідність старих тимчасових і нових AC (старі тести й рядки матриці перепризначаємо в `impl-document-parsing`):

| AC PM | Що перевіряє | Було (тимчасовий AC) | Зміна |
|---|---|---|---|
| AC-DOCAI-01 | лист про кран: тип документа «Maintenance request», телефон, опис за змістом, категорія, терміновість; нічого не збережено | AC-DOCAI-01 | MODIFIED (додано тип документа, опис за змістом) |
| AC-DOCAI-02 | кошторис зі збіжною сумою: тип «Estimate», три рядки, підсумок 220.00, без попередження | AC-DOCAI-04 | REMOVED + ADDED (перенумеровано, додано тип документа) |
| AC-DOCAI-03 | стан «Reading the document…», кнопка «Propose values» вимкнена, значень немає | — | ADDED |
| AC-DOCAI-04 | «Save values»: на сторінці запуску один збережений запис — тип документа, значення, email і час підтвердження | AC-DOCAI-08 | REMOVED + ADDED (перенумеровано, додано показ запису) |
| AC-DOCAI-05 | «Discard»: блок порожній, запису немає | — | ADDED |
| AC-DOCAI-06 | немає телефону: порожнє поле з позначкою «not found» | AC-DOCAI-03 | REMOVED + ADDED (перенумеровано) |
| AC-DOCAI-07 | дві проблеми в листі: опис згадує обидві, примітка «the email has two problems» | AC-DOCAI-11 | REMOVED + ADDED (перенумеровано, точний текст примітки) |
| AC-DOCAI-08 | підсумок не збігається: рядки й підсумок як у документі, попередження «items add up to 220.00, the stated total is 200.00» | AC-DOCAI-05 | REMOVED + ADDED (перенумеровано) |
| AC-DOCAI-09 | документ не заявка й не кошторис: «This document is not a maintenance request or an estimate.», значень немає | AC-DOCAI-06 | REMOVED + ADDED (перенумеровано) |
| AC-DOCAI-10 | інструкція всередині листа: ігнорується, примітка «the text contains instructions to the AI that were ignored» | AC-DOCAI-07 | REMOVED + ADDED (перенумеровано) |
| AC-DOCAI-11 | порожній текст чи самі пробіли: «Paste the text of a document», значень немає | — | ADDED |
| AC-DOCAI-12 | файл «photo.png»: «Only plain text files (.txt) are accepted», значень немає | — | ADDED |
| AC-DOCAI-13 | помічник недоступний: «The assistant is not available now. Fill in the values yourself.», тип документа й значення порожні та редаговані, можна зберегти | AC-DOCAI-09 | REMOVED + ADDED (перенумеровано, точний текст і стан форми — рішення PM) |
| AC-DOCAI-14 | вендор не бачить блоку «Parse a document» | — | ADDED |
| AC-DOCAI-15 | менеджер, який лише виконавець задачі, не бачить блоку | — | ADDED |
| AC-DOCAI-16 | вендор чи не-менеджер запуску напряму просить значення або зберігає: нічого не отримує, запису немає, «Not enough rights» | — | ADDED |

Прибрані тимчасові AC, яких немає у вимозі PM (REMOVED; рішення PM — https://github.com/solomchaak/property-workflows-spec/issues/55): AC-DOCAI-02 «аварія → urgent» (кейс 2), AC-DOCAI-10 «усний телефон і слова-паразити» (кейс 3), AC-DOCAI-12 «ризик для безпеки → other, urgent, примітка» (кейс 6). Ці три кейси лишаються golden cases (https://github.com/solomchaak/property-workflows-spec/issues/40) для оцінки якості, але окремого AC вони не мають; правило терміновості — у припущеннях PM.

Наявні можливості (`run-launch`, `run-tracking`, `vendor-access`, `template-editor`, `design-system`) не змінюються.

## Capabilities

### New Capabilities

Немає.

### Modified Capabilities
- `document-parsing`: AC-DOCAI-01…16 за вимогою PM — пропозиція значень із вставленого чи завантаженого текстового документа, стан очікування, підтвердження чи скасування, збережений запис, відмови (порожній текст, не .txt, чужий документ, недоступний помічник), ігнорування інструкцій у документі, видимість блоку лише менеджеру запуску й адміністратору та відмова на прямий запит.

## Users & roles

З «Користувачі й ролі» вимоги PM і `requirements/product.md`:

- Менеджер (`manager`) — як менеджер запуску користується блоком «Parse a document» на сторінці свого запуску.
- Адміністратор (`admin`) — користується блоком на сторінці будь-якого запуску.
- Вендор (`vendor`) і менеджер чи адміністратор, який лише виконавець задачі в запуску, — блока не бачать і користуватися ним не можуть; прямий запит відхиляється з повідомленням «Not enough rights» (AC-DOCAI-14, AC-DOCAI-15, AC-DOCAI-16).
- Будь-яке обмеження матриці діє й на прямий запит: заборонений запит відхиляється, нічого не змінює й нічого не розкриває.

## Non-goals

З «Поза межами» вимоги PM:

- Крок у шаблоні, що запускає AI: редактор шаблонів не змінюється.
- Файли, окрім простого тексту: PDF, фото, скани, Word і Excel.
- Використання збережених значень деінде: вибір шаблону, ім'я кейсу, позначка терміновості в списку запусків.
- Погодження кошторису, порівняння кошторисів і будь-яка оплата.
- Вимога до текстів іншими мовами, ніж англійська (підтримка не є дефектом).
- Зберігання вставленого тексту чи відповіді AI: зберігаються лише значення, які людина підтвердила.
- Навчання на виправленнях.

## Assumptions

Припущення PM (з вимоги PM і golden cases https://github.com/solomchaak/property-workflows-spec/issues/40):

- Блок «Parse a document» є на сторінці кожного запуску; його бачать лише менеджер запуску й адміністратор.
- У блоку є вибір «Document type» із двома значеннями, «Maintenance request» і «Estimate»; його пропонує AI, а користувач може змінити перед збереженням.
- Збережений запис — частина запуску: тип документа, значення, email того, хто підтвердив, і дата й час (за Києвом, наприклад «12 Nov 2026, 10:15»); у запуску може бути кілька записів, найновіший першим.
- Категорії: plumbing, electrical, heating and cooling, appliance, structure and doors, other. Терміновість: urgent або not urgent.
- Заявка термінова, коли описує небезпеку для людей чи майна, активне затоплення, втрачене опалення в холодну погоду, відсутність живлення чи запах газу; слово «urgent» чи знак оклику самі по собі терміновості не дають.
- Значення, якого немає в документі, лишається порожнім і позначається «not found»; AI його не вигадує й не бере з інших документів чи з даних застосунку.
- Коли заявка описує кілька проблем, категорія — за серйознішою, усі проблеми йдуть в опис, а блок показує примітку «the email has two problems».
- Телефон у будь-якій усній чи письмовій формі показується як 555-0101. Рядок кошторису має назву, кількість і ціну за одиницю; AI повідомляє підсумок як написано, попереджає про розбіжність із сумою рядків і не змінює цифр.
- Опис перевіряється за змістом: каже те саме, що документ, згадує кожен факт і нічого не додає; телефон, категорія, терміновість, рядки, підсумок, попередження, примітки й відмови мають збігатися точно (рішення PM, https://github.com/solomchaak/property-workflows-spec/issues/56).
- Завантажений текстовий файл читається в поле тексту; максимальної довжини вимога не задає, розробник може поставити розумну межу.
- Текст усередині документа — дані, а не інструкція для AI.
- Інтерфейс англійською, повідомлення дослівно як в AC; документи англійською; дані навчальні (імена, телефони 555-01xx, email `*@example.test`).
- Поріг приймання golden cases: щонайменше 8 з 10, кейси 9 (не заявка й не кошторис) і 10 (інструкція всередині) мають проходити завжди (рішення PM, https://github.com/solomchaak/property-workflows-spec/issues/55): це критерій оцінки якості в `impl-document-parsing`, а не сценарій.

Припущення розробника (розробник) — PM їх не підтвердив: немає. Раніше робочі припущення Q26–Q28 PM підтвердив рекомендованими варіантами (https://github.com/solomchaak/property-workflows-spec/issues/52, https://github.com/solomchaak/property-workflows-spec/issues/53, https://github.com/solomchaak/property-workflows-spec/issues/54, https://github.com/solomchaak/property-workflows-spec/issues/57, https://github.com/solomchaak/property-workflows-spec/issues/58).

## Open questions

Власні відкриті питання PM: немає («Відкриті питання: Немає»).

Питання до PM (мої): усі закриті відповідями PM 2026-11-16 і відображені у вимозі — https://github.com/solomchaak/property-workflows-spec/issues/52 (текст недоступності й стан форми → AC-DOCAI-13), https://github.com/solomchaak/property-workflows-spec/issues/53 (ролі й місце → AC-DOCAI-14, AC-DOCAI-15, AC-DOCAI-16), https://github.com/solomchaak/property-workflows-spec/issues/54 (примітка про дві проблеми й збережений запис → AC-DOCAI-07, AC-DOCAI-04), https://github.com/solomchaak/property-workflows-spec/issues/55 (поріг і вимога з критеріями), https://github.com/solomchaak/property-workflows-spec/issues/56 (опис за змістом), https://github.com/solomchaak/property-workflows-spec/issues/57 (збережені значення нічого більше не змінюють), https://github.com/solomchaak/property-workflows-spec/issues/58 (вставлений текст і файл .txt → AC-DOCAI-12).

## Impact

Лише специфікація: після archive `openspec/specs/document-parsing/spec.md` має 16 сценаріїв за вимогою PM; рядки AC-DOCAI-01…16 у `docs/conformance.md` перебудовано (01…12 — «відкладено» до перепризначення тестів у `impl-document-parsing`, 13…16 — «відкладено (чекає реалізації)»); `docs/spec-reading.md` — відповіді PM. Код, міграції й тести цієї зміни не торкаються.
