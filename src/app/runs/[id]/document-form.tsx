"use client";

import { useState } from "react";
import { AppSelect } from "@/components/app-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { DOCUMENT_TYPES, type DocumentKind } from "@/lib/ai/document-type";
import type { EstimateItem, Proposal, RequestField, RequestValues } from "@/lib/ai/parse";
import { EstimateValuesForm } from "./estimate-values-form";
import { RequestValuesForm } from "./request-values-form";

// Форма «Document type» + значення (AC-DOCAI-01, 02, 04, 13): тип пропонує AI, користувач може його змінити перед збереженням;
// без пропозиції (помічник недоступний, AC-DOCAI-13) тип і значення порожні та редаговані. Зберігається те, що людина бачить.
// Поки тип не вибрано, показано поля заявки (порожні); «Save values» без типу — підказка вибрати тип.

export type SavedValues =
  | { kind: "request"; values: RequestValues }
  | { kind: "estimate"; values: { items: EstimateItem[]; total: number | null } };

type Initial = {
  kind: DocumentKind | "";
  request?: RequestValues;
  notFound?: RequestField[];
  items?: EstimateItem[];
  total?: number | null;
};

export const CHOOSE_TYPE_MESSAGE = "Choose a document type";

// Початкові значення форми з пропозиції; порожня ручна форма — без пропозиції.
export function initialFrom(proposal: Proposal | null): Initial {
  if (proposal?.state !== "ok") return { kind: "" };
  if (proposal.kind === "request") return { kind: "request", request: proposal.request, notFound: proposal.notFound };
  return { kind: "estimate", items: proposal.items, total: proposal.total };
}

export function DocumentForm({
  initial,
  saving,
  onSave,
}: {
  initial: Initial;
  saving: boolean;
  onSave: (saved: SavedValues) => void;
}) {
  const [kind, setKind] = useState<DocumentKind | "">(initial.kind);
  const [missingType, setMissingType] = useState(false);

  const save = (saved: SavedValues) => {
    if (kind === "") return setMissingType(true);
    setMissingType(false);
    onSave(saved);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="doc-type">Document type</Label>
        <AppSelect
          id="doc-type"
          options={DOCUMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          value={kind}
          onValueChange={(value) => {
            setKind(value as DocumentKind);
            setMissingType(false);
          }}
          placeholder="not found"
        />
      </div>
      {missingType ? (
        <Alert variant="destructive">
          <AlertDescription>{CHOOSE_TYPE_MESSAGE}</AlertDescription>
        </Alert>
      ) : null}
      {kind === "estimate" ? (
        <EstimateValuesForm
          key="estimate"
          items={initial.kind === "estimate" ? (initial.items ?? []) : []}
          total={initial.kind === "estimate" ? (initial.total ?? null) : null}
          saving={saving}
          onSave={(values) => save({ kind: "estimate", values })}
        />
      ) : (
        <RequestValuesForm
          key="request"
          initial={initial.kind === "request" ? initial.request : undefined}
          notFound={initial.kind === "request" ? initial.notFound : undefined}
          saving={saving}
          onSave={(values) => save({ kind: "request", values })}
        />
      )}
    </div>
  );
}
