import { describe, expect, it } from "vitest";
import {
  addSection,
  addTask,
  buildDraft,
  moveSection,
  moveTask,
  moveTaskToSection,
  removeSection,
  removeTask,
  renameSection,
  renameTask,
  sectionKeyOfTask,
  setTaskRequired,
  toContent,
} from "./draft";
import { formatVersionDate } from "./format-date";
import { NEEDS_REQUIRED_TASK, NOT_ENOUGH_RIGHTS, publishErrorMessage, VERSION_NOT_SAVED } from "./messages";
import { buildVersionRows } from "./versions";

const SECTIONS = [
  { id: "s2", name: "Move-in day", position: 2 },
  { id: "s1", name: "Before move-in", position: 1 },
];
const TASKS = [
  { id: "t3", name: "Hand over keys", required: true, position: 1, section_id: "s2" },
  { id: "t2", name: "Send welcome pack", required: false, position: 2, section_id: "s1" },
  { id: "t1", name: "Sign lease", required: true, position: 1, section_id: "s1" },
];

describe("formatVersionDate / buildVersionRows", () => {
  it("AC-EDITOR-05: дата й час за київським часом у форматі DD.MM.YYYY HH:MM", () => {
    // 2026-10-05 і 2026-10-12 — літній час (UTC+3), 2026-12-01 — зимовий (UTC+2)
    expect(formatVersionDate("2026-10-05T06:30:00Z")).toBe("05.10.2026 09:30");
    expect(formatVersionDate("2026-10-12T11:05:00Z")).toBe("12.10.2026 14:05");
    expect(formatVersionDate("2026-12-01T10:00:00Z")).toBe("01.12.2026 12:00");
    expect(formatVersionDate("not a date")).toBe("—");
  });

  it("AC-EDITOR-05: список версій — новіші першими, з номером, датою й email автора", () => {
    const rows = buildVersionRows(
      [
        { version: 1, created_at: "2026-10-05T06:30:00Z", created_by: "a" },
        { version: 2, created_at: "2026-10-12T11:05:00Z", created_by: "c" },
      ],
      [
        { id: "a", email: "admin-a@example.test" },
        { id: "c", email: "admin-c@example.test" },
      ],
    );

    expect(rows).toEqual([
      { version: 2, savedAt: "12.10.2026 14:05", authorEmail: "admin-c@example.test" },
      { version: 1, savedAt: "05.10.2026 09:30", authorEmail: "admin-a@example.test" },
    ]);
  });

  it("автор без профілю підписується «—»", () => {
    const [row] = buildVersionRows([{ version: 1, created_at: "2026-10-05T06:30:00Z", created_by: null }], []);

    expect(row.authorEmail).toBe("—");
  });
});

describe("чернетка шаблону", () => {
  it("AC-EDITOR-01: додана задача потрапляє в повний вміст автозбереження, а повторне відкриття показує її", () => {
    const draft = buildDraft(SECTIONS, TASKS);
    const withNew = addTask(draft, "s2", "t4", "Sign handover act");

    const content = toContent(withNew);
    expect(content.flatMap((section) => section.tasks)).toHaveLength(4);
    expect(content[1]).toEqual({
      name: "Move-in day",
      tasks: [
        { name: "Hand over keys", required: true },
        { name: "Sign handover act", required: false },
      ],
    });

    // Що збережено — те й відкриється: ті самі рядки бази дають ті самі задачі
    const reopened = buildDraft(
      [
        { id: "n1", name: "Before move-in", position: 1 },
        { id: "n2", name: "Move-in day", position: 2 },
      ],
      content.flatMap((section, s) =>
        section.tasks.map((task, i) => ({ id: `${s}-${i}`, ...task, position: i + 1, section_id: `n${s + 1}` })),
      ),
    );
    expect(reopened.flatMap((section) => section.tasks).map((task) => task.name)).toContain("Sign handover act");
    expect(reopened.flatMap((section) => section.tasks)).toHaveLength(4);
  });

  it("buildDraft упорядковує секції й задачі за position", () => {
    const draft = buildDraft(SECTIONS, TASKS);

    expect(draft.map((section) => section.name)).toEqual(["Before move-in", "Move-in day"]);
    expect(draft[0].tasks.map((task) => task.name)).toEqual(["Sign lease", "Send welcome pack"]);
  });

  it("операції над секціями: додати, перейменувати, змістити, видалити; вхідний список не змінюється", () => {
    const draft = buildDraft(SECTIONS, TASKS);
    const snapshot = JSON.stringify(draft);

    const added = addSection(draft, "s3");
    expect(added.map((section) => section.key)).toEqual(["s1", "s2", "s3"]);
    expect(renameSection(added, "s3", "Closing").at(-1)?.name).toBe("Closing");
    expect(moveSection(added, "s3", -1).map((section) => section.key)).toEqual(["s1", "s3", "s2"]);
    expect(moveSection(added, "s1", -1).map((section) => section.key)).toEqual(["s1", "s2", "s3"]);
    expect(removeSection(added, "s2").map((section) => section.key)).toEqual(["s1", "s3"]);
    expect(JSON.stringify(draft)).toBe(snapshot);
  });

  it("операції над задачами: назва, обов'язковість, порядок, видалення", () => {
    const draft = buildDraft(SECTIONS, TASKS);

    expect(renameTask(draft, "t2", "Send pack").at(0)?.tasks[1].name).toBe("Send pack");
    expect(setTaskRequired(draft, "t2", true).at(0)?.tasks[1].required).toBe(true);
    expect(moveTask(draft, "t2", -1)[0].tasks.map((task) => task.key)).toEqual(["t2", "t1"]);
    expect(moveTask(draft, "t1", -1)[0].tasks.map((task) => task.key)).toEqual(["t1", "t2"]);
    expect(removeTask(draft, "t1")[0].tasks.map((task) => task.key)).toEqual(["t2"]);
  });

  it("перенесення задачі в іншу секцію ставить її в кінець цільової секції", () => {
    const moved = moveTaskToSection(buildDraft(SECTIONS, TASKS), "t1", "s2");

    expect(moved[0].tasks.map((task) => task.key)).toEqual(["t2"]);
    expect(moved[1].tasks.map((task) => task.key)).toEqual(["t3", "t1"]);
    expect(sectionKeyOfTask(moved, "t1")).toBe("s2");
    // Невідома секція чи задача — без змін
    expect(moveTaskToSection(moved, "t1", "nope")).toBe(moved);
    expect(moveTaskToSection(moved, "nope", "s1")).toBe(moved);
  });
});

describe("тексти помилок збереження версії", () => {
  it("AC-EDITOR-04: відмова «немає обов'язкової задачі» показується дослівно", () => {
    expect(publishErrorMessage({ code: "22023", message: "A template needs at least one required task" })).toBe(
      NEEDS_REQUIRED_TASK,
    );
    expect(NEEDS_REQUIRED_TASK).toBe("A template needs at least one required task");
  });

  it("відмова за правами — «Not enough rights», інша помилка — загальний текст", () => {
    expect(publishErrorMessage({ code: "42501", message: "FORBIDDEN" })).toBe(NOT_ENOUGH_RIGHTS);
    expect(publishErrorMessage({ code: "XX000", message: "boom" })).toBe(VERSION_NOT_SAVED);
    expect(publishErrorMessage({})).toBe(VERSION_NOT_SAVED);
  });
});
