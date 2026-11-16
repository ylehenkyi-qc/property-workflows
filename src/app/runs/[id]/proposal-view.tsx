"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Proposal } from "@/lib/ai/parse";
import { DocumentForm, initialFrom, type SavedValues } from "./document-form";

// Що бачить людина після «Propose values» (вимога PM solomchaak/property-workflows-spec#59):
//  - empty — «Paste the text of a document», значень немає (AC-DOCAI-11);
//  - refused — лише повідомлення, жодних значень (AC-DOCAI-09);
//  - unavailable — повідомлення й порожня ручна форма: тип документа й значення порожні та редаговані (AC-DOCAI-13);
//  - ok — попередження й примітки над формою (AC-DOCAI-07, 08, 10) і форма з пропозицією (AC-DOCAI-01, 02, 06).
// Тексти приміток і попереджень задає код (src/lib/ai/parse.ts), тут вони показані дослівно.

export type SaveHandlers = {
  saving: boolean;
  onSave: (saved: SavedValues) => void;
};

function Messages({ title, messages }: { title: string; messages: string[] }) {
  return (
    <>
      {messages.map((message) => (
        <Alert key={message}>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ))}
    </>
  );
}

export function ProposalView({ proposal, saving, onSave }: { proposal: Proposal } & SaveHandlers) {
  if (proposal.state === "empty") {
    return (
      <Alert variant="destructive">
        <AlertDescription>{proposal.message}</AlertDescription>
      </Alert>
    );
  }

  if (proposal.state === "refused") {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertDescription>{proposal.message}</AlertDescription>
        </Alert>
        <Messages title="Note" messages={proposal.notes} />
      </div>
    );
  }

  if (proposal.state === "unavailable") {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertDescription>{proposal.message}</AlertDescription>
        </Alert>
        <DocumentForm initial={initialFrom(null)} saving={saving} onSave={onSave} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Messages title="Warning" messages={proposal.warnings} />
      <Messages title="Note" messages={proposal.notes} />
      <DocumentForm initial={initialFrom(proposal)} saving={saving} onSave={onSave} />
    </div>
  );
}
