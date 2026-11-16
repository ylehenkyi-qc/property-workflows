import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Proposal } from "@/lib/ai/parse";
import { ProposalView } from "./proposal-view";

const HANDLERS = { saving: false, onSaveRequest: () => undefined, onSaveEstimate: () => undefined };
const render = (proposal: Proposal) => renderToStaticMarkup(<ProposalView proposal={proposal} {...HANDLERS} />);

describe("ProposalView", () => {
  it("AC-DOCAI-06: відмова — лише повідомлення, без форми й значень", () => {
    const markup = render({ state: "refused", message: "This document is not a maintenance request or an estimate.", notes: [] });

    expect(markup).toContain("This document is not a maintenance request or an estimate.");
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("Save values");
  });

  it("AC-DOCAI-03: порожнє поле підписане словами «not found», а заповнене — ні", () => {
    const markup = render({
      state: "ok",
      kind: "request",
      request: { phone: null, description: "Kitchen tap leaks", category: "plumbing", urgency: null },
      notFound: ["phone", "urgency"],
      notes: [],
      warnings: [],
    });

    expect(markup).toMatch(/Phone[^<]*<span[^>]*>\s*— not found/);
    expect(markup).toMatch(/Urgency[^<]*<span[^>]*>\s*— not found/);
    expect(markup).not.toMatch(/Description[^<]*<span[^>]*>\s*— not found/);
    expect(markup).toContain("Kitchen tap leaks");
  });

  it("AC-DOCAI-05: попередження про суму стоїть над формою, рядки показані як у документі", () => {
    const markup = render({
      state: "ok",
      kind: "estimate",
      items: [
        { name: "Pipe", quantity: 2, unitPrice: 50 },
        { name: "Labor", quantity: 1, unitPrice: 120 },
      ],
      total: 200,
      notes: [],
      warnings: ["items add up to 220.00, the stated total is 200.00"],
    });

    expect(markup).toContain("items add up to 220.00, the stated total is 200.00");
    expect(markup.indexOf("items add up to 220.00")).toBeLessThan(markup.indexOf("<form"));
    expect(markup).toContain('value="Pipe"');
    expect(markup).toContain('value="200"');
  });

  it("AC-DOCAI-07: примітка про інструкцію в тексті показана дослівно, а форма лишається", () => {
    const markup = render({
      state: "ok",
      kind: "request",
      request: { phone: "555-0101", description: "Heater is broken", category: "heating and cooling", urgency: "urgent" },
      notFound: [],
      notes: ["the text contains instructions to the AI that were ignored"],
      warnings: [],
    });

    expect(markup).toContain("the text contains instructions to the AI that were ignored");
    expect(markup).toContain('value="555-0101"');
    expect(markup).toContain("Save values");
  });

  it("AC-DOCAI-09: помічник недоступний — повідомлення і порожня ручна форма, без пропозиції", () => {
    const markup = render({
      state: "unavailable",
      reason: "rate_limited",
      message: "The assistant is not available now. Fill in the values yourself.",
    });

    expect(markup).toContain("The assistant is not available now. Fill in the values yourself.");
    expect(markup).toContain("<form");
    expect(markup).toContain('id="doc-phone"');
    expect(markup).toContain("Save values");
  });

  it("не використовує нативний <select>: категорію й терміновість малює AppSelect", () => {
    const markup = render({ state: "unavailable", reason: "no_key", message: "x" });

    expect(markup).not.toContain("<select");
    expect(markup).toContain('data-slot="select-trigger"');
  });
});
