import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button";
import { linkButtonClass } from "./link-button";

describe("linkButtonClass", () => {
  it("outline-посилання має видиму межу: border-input без border-transparent", () => {
    const classes = linkButtonClass({ variant: "outline" }).split(/\s+/);

    expect(classes).toContain("border-input");
    expect(classes).not.toContain("border-transparent");
  });

  it("голий buttonVariants лишає обидва класи межі, тому на посиланні його не вживаємо", () => {
    const classes = buttonVariants({ variant: "outline" }).split(/\s+/);

    expect(classes).toContain("border-transparent");
    expect(classes).toContain("border-input");
  });

  it("додатковий клас додається до результату", () => {
    expect(linkButtonClass({ variant: "link" }, "h-auto px-0")).toContain("h-auto px-0");
  });
});
