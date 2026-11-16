"use client";

import { useState, type ReactNode } from "react";
import { AppSelect } from "@/components/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, URGENCIES } from "@/lib/ai/schema";
import type { RequestField, RequestValues } from "@/lib/ai/parse";

// Форма значень заявки: пропозиція моделі (AC-DOCAI-01…12) або порожня ручна форма, коли помічник недоступний
// (AC-DOCAI-09). Порожнє поле, якого немає в документі, підписане словами «not found», а не лише кольором (AC-DOCAI-03).
// Зберігається те, що людина бачить у формі, а не пропозиція моделі (AC-DOCAI-08).

type FormValues = Record<RequestField, string>;

const EMPTY: RequestValues = { phone: null, description: null, category: null, urgency: null };

const toOptions = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

function FieldLabel({ htmlFor, text, missing }: { htmlFor: string; text: string; missing: boolean }) {
  return (
    <Label htmlFor={htmlFor}>
      {text}
      {missing ? <span className="font-normal text-muted-foreground"> — not found</span> : null}
    </Label>
  );
}

function Field({ children, id, text, missing }: { children: ReactNode; id: string; text: string; missing: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id} text={text} missing={missing} />
      {children}
    </div>
  );
}

export function RequestValuesForm({
  initial = EMPTY,
  notFound = [],
  saving,
  onSave,
}: {
  initial?: RequestValues;
  notFound?: RequestField[];
  saving: boolean;
  onSave: (values: RequestValues) => void;
}) {
  const [values, setValues] = useState<FormValues>({
    phone: initial.phone ?? "",
    description: initial.description ?? "",
    category: initial.category ?? "",
    urgency: initial.urgency ?? "",
  });
  const set = (field: RequestField) => (value: string) => setValues((prev) => ({ ...prev, [field]: value }));
  const missing = (field: RequestField) => notFound.includes(field) && values[field] === "";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          phone: values.phone,
          description: values.description,
          category: (values.category || null) as RequestValues["category"],
          urgency: (values.urgency || null) as RequestValues["urgency"],
        });
      }}
    >
      <Field id="doc-phone" text="Phone" missing={missing("phone")}>
        <Input id="doc-phone" value={values.phone} onChange={(e) => set("phone")(e.target.value)} />
      </Field>
      <Field id="doc-description" text="Description" missing={missing("description")}>
        <Input id="doc-description" value={values.description} onChange={(e) => set("description")(e.target.value)} />
      </Field>
      <Field id="doc-category" text="Category" missing={missing("category")}>
        <AppSelect id="doc-category" options={toOptions(CATEGORIES)} value={values.category} onValueChange={set("category")} placeholder="not found" />
      </Field>
      <Field id="doc-urgency" text="Urgency" missing={missing("urgency")}>
        <AppSelect id="doc-urgency" options={toOptions(URGENCIES)} value={values.urgency} onValueChange={set("urgency")} placeholder="not found" />
      </Field>
      <Button type="submit" disabled={saving} className="self-start">
        Save values
      </Button>
    </form>
  );
}
