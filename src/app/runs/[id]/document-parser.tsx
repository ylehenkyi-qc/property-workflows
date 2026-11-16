"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Proposal } from "@/lib/ai/parse";
import { MAX_DOCUMENT_CHARS } from "@/lib/ai/prompts/parse";
import { confirmDocumentValues, proposeDocumentValues } from "./document-actions";
import { ProposalView } from "./proposal-view";

// Блок «Parse a document» на сторінці запуску (AC-DOCAI-01…12): менеджер запуску й адміністратор вставляють текст,
// «Propose values» лише ПРОПОНУЄ (нічого не пишемо), «Save values» зберігає те, що людина бачить у формі (AC-DOCAI-08).
// Сервер усе одно перевіряє роль і право на запуск; цей блок лише не показують іншим ролям.

const MESSAGES = {
  denied: "Not enough rights",
  invalid: "The values are not valid. Check them and try again.",
  error: "The values could not be saved. Try again.",
  saved: "Values saved",
} as const;

type Status = keyof typeof MESSAGES | null;

const SAVE_STATUS = { saved: "saved", invalid: "invalid", error: "error", forbidden: "denied", unauthenticated: "denied" } as const;

export function DocumentParser({ runId }: { runId: string }) {
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<{ id: number; value: Proposal } | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [pending, startTransition] = useTransition();

  const propose = () =>
    startTransition(async () => {
      const result = await proposeDocumentValues(runId, text);
      setStatus(result.status === "ok" ? null : "denied");
      if (result.status === "ok") setProposal((prev) => ({ id: (prev?.id ?? 0) + 1, value: result.proposal }));
    });

  const save = (kind: "request" | "estimate", values: unknown) =>
    startTransition(async () => {
      const result = await confirmDocumentValues(runId, kind, values);
      setStatus(SAVE_STATUS[result.status]);
    });

  return (
    <section className="flex flex-col gap-4" aria-labelledby="parse-document-heading">
      <h2 id="parse-document-heading" className="text-lg font-semibold">
        Parse a document
      </h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="document-text">Email, call transcript or estimate</Label>
        <Textarea id="document-text" value={text} maxLength={MAX_DOCUMENT_CHARS} rows={6} onChange={(e) => setText(e.target.value)} />
        <p className="text-sm text-muted-foreground">Paste the text. Up to {MAX_DOCUMENT_CHARS} characters. Nothing is saved until you save the values.</p>
      </div>
      <Button type="button" className="self-start" disabled={pending || text.trim() === ""} onClick={propose}>
        Propose values
      </Button>
      {status ? (
        <Alert variant={status === "saved" ? "default" : "destructive"} role="status">
          <AlertDescription>{MESSAGES[status]}</AlertDescription>
        </Alert>
      ) : null}
      {proposal ? (
        <ProposalView
          key={proposal.id}
          proposal={proposal.value}
          saving={pending}
          onSaveRequest={(values) => save("request", values)}
          onSaveEstimate={(values) => save("estimate", values)}
        />
      ) : null}
    </section>
  );
}
