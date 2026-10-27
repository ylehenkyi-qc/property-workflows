import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppSelect } from "./app-select";

const OPTIONS = [
  { value: "me", label: "Me" },
  { value: "b", label: "manager2@example.test" },
];

describe("AppSelect", () => {
  it("не використовує нативний <select>: список малює застосунок, а не ОС", () => {
    const markup = renderToStaticMarkup(<AppSelect name="assignee" options={OPTIONS} defaultValue="me" />);

    expect(markup).not.toContain("<select");
    expect(markup).not.toContain("<option");
    expect(markup).toContain('data-slot="select-trigger"');
  });

  it("показує підпис вибраного варіанта й передає значення у форму під своїм name", () => {
    const markup = renderToStaticMarkup(<AppSelect id="assignee" name="assignee" options={OPTIONS} defaultValue="b" />);

    expect(markup).toContain("manager2@example.test");
    expect(markup).toMatch(/<input[^>]*name="assignee"[^>]*value="b"|<input[^>]*value="b"[^>]*name="assignee"/);
  });

  it("без вибраного значення показує підказку", () => {
    const markup = renderToStaticMarkup(<AppSelect name="template" options={OPTIONS} placeholder="Choose a template" />);

    expect(markup).toContain("Choose a template");
  });
});
