import { describe, expect, it } from "vitest";
import { refusalLink } from "./refusal-link";

// Підказка інтерфейсу для відмови: куди повернути користувача, якому сторінка заборонена.
describe("refusalLink", () => {
  it("вендор повертається до списку запусків, а не на сторінку, що знову його відмовить", () => {
    expect(refusalLink("vendor")).toEqual({ href: "/runs", label: "Back to runs" });
  });

  it("менеджер, адміністратор і користувач без ролі повертаються на головну", () => {
    for (const role of ["manager", "admin", null] as const) {
      expect(refusalLink(role)).toEqual({ href: "/", label: "Back to home" });
    }
  });
});

describe("refusalLink: посилання сторінки для не-вендора", () => {
  it("AC-DSYS-02: менеджер на сторінці редактора й версій лишається з «Back to templates», а вендор іде на «Back to runs»", () => {
    const toTemplates = { href: "/templates", label: "Back to templates" };

    expect(refusalLink("manager", toTemplates)).toEqual(toTemplates);
    expect(refusalLink("vendor", toTemplates)).toEqual({ href: "/runs", label: "Back to runs" });
  });
});
