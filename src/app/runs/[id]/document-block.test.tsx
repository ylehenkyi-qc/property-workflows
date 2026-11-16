import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialBlock, type BlockState } from "@/lib/ai/block-state";
import { DocumentBlockView } from "./document-block";
import { DocumentRecords } from "./document-records";

const HANDLERS = { saving: false, onText: () => undefined, onPropose: () => undefined, onFile: () => undefined, onDiscard: () => undefined, onSave: () => undefined };
const render = (state: BlockState) => renderToStaticMarkup(<DocumentBlockView state={state} {...HANDLERS} />);

describe("блок «Parse a document»", () => {
  it("за замовчуванням: поле тексту, «Upload a text file» і «Propose values» (увімкнена), без «Discard»", () => {
    const markup = render(initialBlock);

    expect(markup).toContain("Parse a document");
    expect(markup).toContain('id="document-text"');
    expect(markup).toContain("Upload a text file");
    expect(markup).toMatch(/<button[^>]*>\s*Propose values/);
    expect(markup).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Propose values/);
    expect(markup).not.toContain("Discard");
    expect(markup).not.toContain("Reading the document");
  });

  it("AC-DOCAI-03: помічник працює — «Reading the document…», «Propose values» вимкнена, жодного значення", () => {
    const markup = render({ ...initialBlock, text: "Subject: Dripping tap", reading: true });

    expect(markup).toContain("Reading the document…");
    expect(markup).toMatch(/<button[^>]*\sdisabled=""[^>]*>Propose values/);
    expect(markup).not.toContain("Save values");
    expect(markup).not.toContain('id="doc-phone"');
  });

  it("AC-DOCAI-05: після «Discard» блок порожній — поле без тексту, без форми й «Discard»", () => {
    const markup = render(initialBlock);

    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("Discard");
  });

  it("AC-DOCAI-12: файл не .txt — повідомлення PM показано, значень немає", () => {
    const markup = render({ ...initialBlock, fileError: "Only plain text files (.txt) are accepted" });

    expect(markup).toContain("Only plain text files (.txt) are accepted");
    expect(markup).not.toContain("Save values");
  });

  it("є «Discard», коли показано пропозицію", () => {
    const markup = render({ ...initialBlock, proposal: { id: 1, value: { state: "refused", message: "m", notes: [] } } });

    expect(markup).toContain("Discard");
  });

  it("не використовує нативний input type=file поза компонентом ui: кнопку малює FileButton", () => {
    const markup = render(initialBlock);

    expect(markup).toContain("Upload a text file");
    expect(markup).toContain('type="file"');
    expect(markup).toContain("sr-only");
  });
});

describe("збережені записи на сторінці запуску", () => {
  const users = [{ id: "u-a", email: "manager-a@example.test" }];

  it("AC-DOCAI-04: один запис — тип документа, значення, email того, хто підтвердив, дата й час за Києвом", () => {
    const markup = renderToStaticMarkup(
      <DocumentRecords
        users={users}
        records={[
          {
            id: "r1",
            kind: "request",
            values: { phone: "555-0101", description: "Kitchen tap leaks", category: "plumbing", urgency: "urgent" },
            author_id: "u-a",
            created_at: "2026-11-12T08:15:00Z",
          },
        ]}
      />,
    );

    expect(markup.match(/data-testid="document-record"/g)).toHaveLength(1);
    expect(markup).toContain("Maintenance request");
    expect(markup).toContain("555-0101");
    expect(markup).toContain("plumbing");
    expect(markup).toContain(">urgent<");
    expect(markup).toContain("manager-a@example.test");
    expect(markup).toContain("12 Nov 2026, 10:15");
  });

  it("AC-DOCAI-05: без записів блок записів не показується", () => {
    expect(renderToStaticMarkup(<DocumentRecords users={users} records={[]} />)).toBe("");
  });

  it("запис кошторису: рядки й підсумок; порожнє значення заявки — «not found»; найновіший першим (порядок запиту)", () => {
    const markup = renderToStaticMarkup(
      <DocumentRecords
        users={users}
        records={[
          { id: "r2", kind: "estimate", values: { items: [{ name: "Labour", quantity: 2, unitPrice: 60 }], total: 120 }, author_id: "u-a", created_at: "2026-11-13T09:00:00Z" },
          { id: "r1", kind: "request", values: { phone: null, description: "x", category: "other", urgency: "urgent" }, author_id: "u-a", created_at: "2026-11-12T08:15:00Z" },
        ]}
      />,
    );

    expect(markup.indexOf("Estimate")).toBeLessThan(markup.indexOf("Maintenance request"));
    expect(markup).toContain("Labour: 2 x 60.00");
    expect(markup).toContain("Total: 120.00");
    expect(markup).toContain("not found");
  });
});
