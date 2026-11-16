"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { EstimateItem, Proposal, RequestValues } from "@/lib/ai/parse";
import { EstimateValuesForm } from "./estimate-values-form";
import { RequestValuesForm } from "./request-values-form";

// Що бачить людина після «Propose values» (design.md зрізу 4, «UI і компоненти»):
//  - refused — лише повідомлення, жодних значень (AC-DOCAI-06);
//  - unavailable — повідомлення й порожня ручна форма заявки (AC-DOCAI-09);
//  - ok — примітки й попередження над формою (AC-DOCAI-05, 07, 11, 12) і форма з пропозицією (AC-DOCAI-01…04, 10).
// Тексти приміток і попереджень задає код (src/lib/ai/parse.ts), тут вони показані дослівно.

export type SaveHandlers = {
  saving: boolean;
  onSaveRequest: (values: RequestValues) => void;
  onSaveEstimate: (values: { items: EstimateItem[]; total: number | null }) => void;
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

export function ProposalView({ proposal, saving, onSaveRequest, onSaveEstimate }: { proposal: Proposal } & SaveHandlers) {
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
        <RequestValuesForm saving={saving} onSave={onSaveRequest} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Messages title="Warning" messages={proposal.warnings} />
      <Messages title="Note" messages={proposal.notes} />
      {proposal.kind === "request" ? (
        <RequestValuesForm initial={proposal.request} notFound={proposal.notFound} saving={saving} onSave={onSaveRequest} />
      ) : (
        <EstimateValuesForm items={proposal.items} total={proposal.total} saving={saving} onSave={onSaveEstimate} />
      )}
    </div>
  );
}
