# Proposal

## Why

Реалізуємо другий зріз (WS7) з вимог PM, знімок 2026-10-26 (`solomchaak/property-workflows-spec`): адміністратор редагує шаблон у застосунку (зміни зберігаються автоматично) і зберігає його як пронумеровану версію; менеджери бачать лише поточну збережену версію; запуск зберігає версію, з якої створений; усі сторінки йдуть за однією дизайн-системою. Специфікація зрізу вже в `openspec/specs/` (`template-editor`, `design-system`, дельти `run-launch` і `run-tracking`; зміна `add-templates-editor`, archive 2026-10-26); ця зміна — лише план реалізації (`design.md`, `tasks.md`), нових правил поведінки вона не додає.

## What Changes

Покриває 29 AC зрізу (нові й змінені):

- `template-editor`: AC-EDITOR-01, AC-EDITOR-02, AC-EDITOR-03, AC-EDITOR-04, AC-EDITOR-05, AC-EDITOR-06, AC-EDITOR-07, AC-EDITOR-08, AC-EDITOR-09.
- `design-system`: AC-DSYS-01, AC-DSYS-02, AC-DSYS-03, AC-DSYS-04.
- `run-launch`: AC-RUN-10, AC-RUN-11, AC-RUN-12.
- `run-tracking`: AC-TASK-01, AC-TASK-02, AC-TASK-04, AC-TASK-07 (змінені), AC-TASK-10, AC-TASK-11, AC-TASK-12, AC-TASK-13, AC-TASK-14, AC-TASK-15, AC-TASK-16, AC-TASK-17, AC-TASK-18.

Реалізація йде вертикальними задачами (кожна — окремий PR «Реалізація»): дизайн-система → версії шаблонів у базі з RLS і тестами на PGlite → редактор і сторінки шаблонів з авторизацією → доведення запусків (версія, підтвердження, список). Якщо часу не вистачає, остання група лишається «відкладено (чекає реалізації)» у матриці з конкретною причиною. Поведінку, яку вимоги лишають відкритою (питання solomchaak/property-workflows-spec#21–#36), реалізація не специфікує понад робочі рішення з `design.md`.
