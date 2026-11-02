import { describe, expect, it } from "vitest";
import {
  isMarkTaskErrorCode,
  MARK_TASK_ERRORS,
  MARK_TASK_FORBIDDEN_MESSAGE,
  markTaskErrorCode,
} from "./markTaskErrors";

describe("markTaskErrors", () => {
  it("AC-TASK-03: відмова за правами 42501 → код forbidden з дослівним повідомленням", () => {
    const code = markTaskErrorCode({ code: "42501", message: MARK_TASK_FORBIDDEN_MESSAGE });

    expect(code).toBe("forbidden");
    expect(MARK_TASK_ERRORS[code]).toBe(
      "Only the task's assignee, the run manager, or an administrator can mark a task as done",
    );
  });

  it("інша помилка 42501 (не відмова за правами задачі) — технічна відмова", () => {
    expect(markTaskErrorCode({ code: "42501", message: "Not authorized" })).toBe("failed");
  });

  it("невідома помилка — загальний текст", () => {
    const code = markTaskErrorCode({ code: "P0002", message: "Task not found" });

    expect(code).toBe("failed");
    expect(MARK_TASK_ERRORS[code]).toBe("Could not mark the task as done");
  });

  it("текст відмови без коду 42501 не вважаємо відмовою за правами", () => {
    expect(markTaskErrorCode({ message: MARK_TASK_FORBIDDEN_MESSAGE })).toBe("failed");
  });

  it("розпізнає лише відомі коди", () => {
    expect(isMarkTaskErrorCode("forbidden")).toBe(true);
    expect(isMarkTaskErrorCode("failed")).toBe(true);
    expect(isMarkTaskErrorCode("<script>")).toBe(false);
    expect(isMarkTaskErrorCode(undefined)).toBe(false);
  });
});
