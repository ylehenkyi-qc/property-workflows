"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileButton } from "@/components/ui/file-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_MESSAGES, type BlockState } from "@/lib/ai/block-state";
import { MAX_DOCUMENT_CHARS } from "@/lib/ai/prompts/parse";
import type { SavedValues } from "./document-form";
import { ProposalView } from "./proposal-view";

// Вигляд блоку «Parse a document» за станом (src/lib/ai/block-state.ts): без власного стану, тож його видно в статичній розмітці.
export function DocumentBlockView({
  state,
  saving,
  onText,
  onPropose,
  onFile,
  onDiscard,
  onSave,
}: {
  state: BlockState;
  saving: boolean;
  onText: (text: string) => void;
  onPropose: () => void;
  onFile: (file: File) => void;
  onDiscard: () => void;
  onSave: (saved: SavedValues) => void;
}) {
  const { text, reading, proposal, status, fileError } = state;
  return (
    <section className="flex flex-col gap-4" aria-labelledby="parse-document-heading">
      <h2 id="parse-document-heading" className="text-lg font-semibold">
        Parse a document
      </h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="document-text">Email, call transcript or estimate</Label>
        <Textarea id="document-text" value={text} maxLength={MAX_DOCUMENT_CHARS} rows={6} onChange={(e) => onText(e.target.value)} />
        <p className="text-sm text-muted-foreground">Paste the text. Up to {MAX_DOCUMENT_CHARS} characters. Nothing is saved until you save the values.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={reading} onClick={onPropose}>
          Propose values
        </Button>
        <FileButton accept=".txt,text/plain" disabled={reading} onFile={onFile}>
          Upload a text file
        </FileButton>
        {proposal ? (
          <Button type="button" variant="ghost" disabled={reading || saving} onClick={onDiscard}>
            Discard
          </Button>
        ) : null}
      </div>
      {reading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Reading the document…
        </p>
      ) : null}
      {fileError ? (
        <Alert variant="destructive">
          <AlertDescription>{fileError}</AlertDescription>
        </Alert>
      ) : null}
      {status ? (
        <Alert variant={status === "saved" ? "default" : "destructive"} role="status">
          <AlertDescription>{STATUS_MESSAGES[status]}</AlertDescription>
        </Alert>
      ) : null}
      {proposal && !reading ? <ProposalView key={proposal.id} proposal={proposal.value} saving={saving} onSave={onSave} /> : null}
    </section>
  );
}
