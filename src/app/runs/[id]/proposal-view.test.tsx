import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Proposal } from "@/lib/ai/parse";
import { ProposalView } from "./proposal-view";

const HANDLERS = { saving: false, onSave: () => undefined };
const render = (proposal: Proposal) => renderToStaticMarkup(<ProposalView proposal={proposal} {...HANDLERS} />);

const request = (over: Partial<Extract<Proposal, { kind: "request" }>> = {}): Proposal => ({
  state: "ok",
  kind: "request",
  request: { phone: "555-0101", description: "Kitchen tap in apartment 12 has been dripping for three days", category: "plumbing", urgency: "not urgent" },
  notFound: [],
  notes: [],
  warnings: [],
  ...over,
});

describe("ProposalView", () => {
  it("AC-DOCAI-01: заявка — тип документа «Maintenance request», телефон, опис, категорія й терміновість у формі", () => {
    const markup = render(request());

    expect(markup).toContain("Document type");
    expect(markup).toContain("Maintenance request");
    expect(markup).toContain('value="555-0101"');
    expect(markup).toContain("dripping for three days");
    expect(markup).toContain("plumbing");
    expect(markup).toContain("not urgent");
  });

  it("AC-DOCAI-02: кошторис — тип «Estimate», три рядки Item/Quantity/Unit price, підсумок 220, без попередження", () => {
    const markup = render({
      state: "ok",
      kind: "estimate",
      items: [
        { name: "Replace kitchen tap", quantity: 1, unitPrice: 85 },
        { name: "Labour", quantity: 2, unitPrice: 60 },
        { name: "Disposal fee", quantity: 1, unitPrice: 15 },
      ],
      total: 220,
      notes: [],
      warnings: [],
    });

    expect(markup).toContain("Estimate");
    for (const name of ["Replace kitchen tap", "Labour", "Disposal fee"]) expect(markup).toContain(`value="${name}"`);
    expect(markup).toContain("Quantity");
    expect(markup).toContain("Unit price");
    expect(markup).toContain('value="220"');
    expect(markup).not.toContain("items add up to");
  });

  it("AC-DOCAI-06: порожнє поле підписане словами «not found», а заповнене — ні", () => {
    const markup = render(request({ request: { phone: null, description: "Oven in apartment 5 does not heat up", category: "appliance", urgency: "not urgent" }, notFound: ["phone"] }));

    expect(markup).toMatch(/Phone[^<]*<span[^>]*>\s*— not found/);
    expect(markup).not.toMatch(/Description[^<]*<span[^>]*>\s*— not found/);
    expect(markup).toContain("Oven in apartment 5");
  });

  it("AC-DOCAI-07: примітка про дві проблеми показана дослівно над формою", () => {
    const markup = render(request({ notes: ["the email has two problems"] }));

    expect(markup).toContain("the email has two problems");
    expect(markup.indexOf("the email has two problems")).toBeLessThan(markup.indexOf("<form"));
  });

  it("AC-DOCAI-08: попередження про суму стоїть над формою, рядки й підсумок — як у документі", () => {
    const markup = render({
      state: "ok",
      kind: "estimate",
      items: [
        { name: "Inspection", quantity: 1, unitPrice: 90 },
        { name: "Replace valve", quantity: 1, unitPrice: 70 },
        { name: "Labour", quantity: 1, unitPrice: 60 },
      ],
      total: 200,
      notes: [],
      warnings: ["items add up to 220.00, the stated total is 200.00"],
    });

    expect(markup).toContain("items add up to 220.00, the stated total is 200.00");
    expect(markup.indexOf("items add up to 220.00")).toBeLessThan(markup.indexOf("<form"));
    expect(markup).toContain('value="200"');
  });

  it("AC-DOCAI-09: відмова — лише повідомлення, без форми, типу документа й значень", () => {
    const markup = render({ state: "refused", message: "This document is not a maintenance request or an estimate.", notes: [] });

    expect(markup).toContain("This document is not a maintenance request or an estimate.");
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("Save values");
    expect(markup).not.toContain("Document type");
  });

  it("AC-DOCAI-10: примітка про інструкцію в тексті показана дослівно, а форма лишається", () => {
    const markup = render(request({ notes: ["the text contains instructions to the AI that were ignored"] }));

    expect(markup).toContain("the text contains instructions to the AI that were ignored");
    expect(markup).toContain("Save values");
  });

  it("AC-DOCAI-11: порожній текст — «Paste the text of a document», без форми й значень", () => {
    const markup = render({ state: "empty", message: "Paste the text of a document" });

    expect(markup).toContain("Paste the text of a document");
    expect(markup).not.toContain("<form");
  });

  it("AC-DOCAI-13: помічник недоступний — повідомлення, тип документа й значення порожні та редаговані, «Save values» є", () => {
    const markup = render({ state: "unavailable", reason: "rate_limited", message: "The assistant is not available now. Fill in the values yourself." });

    expect(markup).toContain("The assistant is not available now. Fill in the values yourself.");
    expect(markup).toContain('id="doc-type"');
    expect(markup).toContain('id="doc-phone"');
    expect(markup).not.toMatch(/id="doc-phone"[^>]*value="[^"]/);
    expect(markup).not.toContain("Maintenance request");
    expect(markup).toContain("Save values");
  });

  it("не використовує нативний <select>: тип документа, категорію й терміновість малює AppSelect", () => {
    const markup = render({ state: "unavailable", reason: "no_key", message: "x" });

    expect(markup).not.toContain("<select");
    expect(markup).toContain('data-slot="select-trigger"');
  });
});
