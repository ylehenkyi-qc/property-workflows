import { describe, expect, it } from "vitest";
import { blockReducer, initialBlock, type BlockAction, type BlockState } from "./block-state";
import type { Proposal } from "./parse";

// Стан блоку «Parse a document»: те, що бачить менеджер, окрім форм (вимога PM solomchaak/property-workflows-spec#59).
const run = (actions: BlockAction[], from: BlockState = initialBlock) => actions.reduce(blockReducer, from);

const okProposal: Proposal = {
  state: "ok",
  kind: "request",
  request: { phone: "555-0101", description: "Kitchen tap leaks", category: "plumbing", urgency: "not urgent" },
  notFound: [],
  notes: [],
  warnings: [],
};

describe("стан блоку «Parse a document»", () => {
  it("AC-DOCAI-03: поки помічник працює — очікування, жодної пропозиції (навіть попередньої)", () => {
    const withOld = run([{ type: "text", text: "x" }, { type: "propose" }, { type: "proposed", proposal: okProposal }]);
    expect(withOld.proposal).not.toBeNull();

    const reading = run([{ type: "propose" }], withOld);

    expect(reading.reading).toBe(true);
    expect(reading.proposal).toBeNull();
  });

  it("AC-DOCAI-05: «Discard» — блок знову порожній: текст, пропозиція, повідомлення", () => {
    const state = run([{ type: "text", text: "Subject: Dripping tap" }, { type: "propose" }, { type: "proposed", proposal: okProposal }, { type: "discard" }]);

    expect(state).toEqual(initialBlock);
  });

  it("AC-DOCAI-11: порожній текст і самі пробіли — «Paste the text of a document», без очікування й значень", () => {
    for (const text of ["", "   \n  "]) {
      const state = run([{ type: "text", text }, { type: "propose" }]);

      expect(state.reading).toBe(false);
      expect(state.proposal?.value).toEqual({ state: "empty", message: "Paste the text of a document" });
    }
  });

  it("AC-DOCAI-12: файл не .txt — повідомлення PM і жодної пропозиції; .txt читається в поле тексту", () => {
    const rejected = run([{ type: "file", result: { ok: false, message: "Only plain text files (.txt) are accepted" } }], run([{ type: "propose" }]));
    expect(rejected.fileError).toBe("Only plain text files (.txt) are accepted");
    expect(rejected.proposal).toBeNull();

    const accepted = run([{ type: "file", result: { ok: true, text: "Estimate 2026-0012" } }], rejected);
    expect(accepted.text).toBe("Estimate 2026-0012");
    expect(accepted.fileError).toBeNull();
  });

  it("AC-DOCAI-16: відмова сервера («Not enough rights») знімає очікування й нічого не показує", () => {
    const state = run([{ type: "text", text: "x" }, { type: "propose" }, { type: "denied" }]);

    expect(state.reading).toBe(false);
    expect(state.status).toBe("denied");
    expect(state.proposal).toBeNull();
  });

  it("AC-DOCAI-13: виклик дії не вдався (мережа) — очікування знято й показано «assistant is not available», а не вічне «Reading…»", () => {
    const state = run([{ type: "text", text: "x" }, { type: "propose" }, { type: "failed" }]);

    expect(state.reading).toBe(false);
    expect(state.proposal?.value).toMatchObject({ state: "unavailable", message: "The assistant is not available now. Fill in the values yourself." });
  });

  it("AC-DOCAI-04: після збереження блок порожній, а повідомлення «Values saved» показано", () => {
    const state = run([{ type: "text", text: "x" }, { type: "propose" }, { type: "proposed", proposal: okProposal }, { type: "save_result", status: "saved" }]);

    expect(state).toEqual({ ...initialBlock, status: "saved" });
  });
});
