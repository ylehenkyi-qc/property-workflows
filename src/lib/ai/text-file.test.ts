import { describe, expect, it } from "vitest";
import { formatConfirmedAt } from "./document-type";
import { FILE_ERROR, readTextFile } from "./text-file";

describe("readTextFile", () => {
  it("AC-DOCAI-12: «photo.png» відхилено повідомленням PM, вміст не читається", async () => {
    const result = await readTextFile(new File(["binary"], "photo.png", { type: "image/png" }));

    expect(result).toEqual({ ok: false, message: "Only plain text files (.txt) are accepted" });
    expect(FILE_ERROR).toBe("Only plain text files (.txt) are accepted");
  });

  it("AC-DOCAI-12: .txt з типом text/plain читається в текст; .txt без типу теж; .txt з типом image — ні", async () => {
    expect(await readTextFile(new File(["Estimate 2026-0012"], "estimate.TXT", { type: "text/plain" }))).toEqual({ ok: true, text: "Estimate 2026-0012" });
    expect(await readTextFile(new File(["hello"], "note.txt"))).toEqual({ ok: true, text: "hello" });
    expect(await readTextFile(new File(["x"], "fake.txt", { type: "image/png" }))).toMatchObject({ ok: false });
  });

  it("довгий текстовий файл обрізається до межі довжини документа", async () => {
    const result = await readTextFile(new File(["a".repeat(5000)], "long.txt", { type: "text/plain" }));

    expect(result.ok && result.text.length).toBe(4000);
  });
});

describe("formatConfirmedAt", () => {
  it("AC-DOCAI-04: дата й час підтвердження за Києвом у вигляді «12 Nov 2026, 10:15»", () => {
    expect(formatConfirmedAt("2026-11-12T08:15:00Z")).toBe("12 Nov 2026, 10:15");
    expect(formatConfirmedAt("2026-07-01T21:30:00Z")).toBe("2 Jul 2026, 00:30");
    expect(formatConfirmedAt("not a date")).toBe("—");
  });
});
