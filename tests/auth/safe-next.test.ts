import { describe, expect, it } from "vitest";
import { loginPath, safeNextPath } from "@/lib/auth/safe-next";

describe("safeNextPath", () => {
  it("лишає відносний шлях цього сайту разом із запитом", () => {
    expect(safeNextPath("/templates/abc/edit")).toBe("/templates/abc/edit");
    expect(safeNextPath("/runs?error=forbidden")).toBe("/runs?error=forbidden");
  });

  it("відкидає чужі сайти, протокол-відносні адреси й зворотні скісні риски", () => {
    for (const value of [
      "https://evil.example/templates",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "templates",
      "",
    ]) {
      expect(safeNextPath(value)).toBe("/");
    }
  });

  it("відкидає керівні символи й не веде назад на сторінку входу", () => {
    expect(safeNextPath("/templates\n/x")).toBe("/");
    expect(safeNextPath("/login?next=/runs")).toBe("/");
  });

  it("не-рядок дає «/»", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(["/runs"])).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("loginPath", () => {
  it("кодує безпечний next і пропускає його, коли це «/»", () => {
    expect(loginPath("/templates/abc/edit")).toBe("/login?next=%2Ftemplates%2Fabc%2Fedit");
    expect(loginPath("/")).toBe("/login");
    expect(loginPath("https://evil.example")).toBe("/login");
  });

  it("додає код помилки поруч із next", () => {
    expect(loginPath("/runs", "invalid")).toBe("/login?next=%2Fruns&error=invalid");
    expect(loginPath(undefined, "missing")).toBe("/login?error=missing");
  });
});
