import { describe, expect, it } from "vitest";
import { canMarkDone, isLastRequiredTask } from "./permissions";

const RUN = { manager_id: "a" };
const todo = { assignee_id: "b", status: "to_do" };

describe("canMarkDone", () => {
  it("AC-TASK-18: кнопка лише виконавцю задачі, менеджеру запуску й адміністратору", () => {
    expect(canMarkDone(todo, RUN, { userId: "b", role: "manager" })).toBe(true);
    expect(canMarkDone(todo, RUN, { userId: "a", role: "manager" })).toBe(true);
    expect(canMarkDone(todo, RUN, { userId: "x", role: "admin" })).toBe(true);
    expect(canMarkDone(todo, RUN, { userId: "c", role: "manager" })).toBe(false);
  });

  it("виконану задачу позначати нема що", () => {
    expect(canMarkDone({ ...todo, status: "done" }, RUN, { userId: "a", role: "manager" })).toBe(false);
  });
});

describe("isLastRequiredTask", () => {
  const task = (id: string, required: boolean, status: string) => ({ id, required, status });

  it("AC-TASK-04: третя обов'язкова задача (2 інші «done», решта «to do») — остання, потрібне підтвердження", () => {
    const tasks = [
      task("1", true, "done"),
      task("2", true, "done"),
      task("3", true, "to_do"),
      task("4", false, "to_do"),
      task("5", false, "to_do"),
    ];

    expect(isLastRequiredTask(tasks, "3")).toBe(true);
  });

  it("AC-TASK-16: поки є інша обов'язкова «to do», задача не остання; необов'язкова чи виконана — ніколи", () => {
    const tasks = [task("1", true, "done"), task("2", true, "to_do"), task("3", true, "to_do"), task("4", false, "to_do")];

    expect(isLastRequiredTask(tasks, "2")).toBe(false);
    expect(isLastRequiredTask(tasks, "4")).toBe(false);
    expect(isLastRequiredTask(tasks, "1")).toBe(false);
    expect(isLastRequiredTask(tasks, "nope")).toBe(false);
  });
});
