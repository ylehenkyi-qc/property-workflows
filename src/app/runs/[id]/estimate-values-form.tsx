"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { EstimateItem } from "@/lib/ai/parse";

// Форма кошторису: рядки як у документі й підсумок (AC-DOCAI-04, AC-DOCAI-05). Цифри документа не виправляємо: розбіжність
// сум показує попередження над формою, а зберігається те, що людина підтвердила (AC-DOCAI-08).

type Row = { name: string; quantity: string; unitPrice: string };

const NUMBER_ERROR = "Enter numbers for quantity, unit price and total.";

const toNumber = (text: string): number | null => {
  const value = text.trim() === "" ? NaN : Number(text);
  return Number.isFinite(value) ? value : null;
};

function parseRows(rows: Row[]): EstimateItem[] | null {
  const items = rows.map((row) => ({ name: row.name, quantity: toNumber(row.quantity), unitPrice: toNumber(row.unitPrice) }));
  return items.every((i) => i.quantity !== null && i.unitPrice !== null) ? (items as EstimateItem[]) : null;
}

export function EstimateValuesForm({
  items,
  total,
  saving,
  onSave,
}: {
  items: EstimateItem[];
  total: number | null;
  saving: boolean;
  onSave: (values: { items: EstimateItem[]; total: number | null }) => void;
}) {
  const [rows, setRows] = useState<Row[]>(
    items.map((i) => ({ name: i.name, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })),
  );
  const [totalText, setTotalText] = useState(total === null ? "" : String(total));
  const [error, setError] = useState(false);

  const setCell = (index: number, field: keyof Row, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseRows(rows);
        const parsedTotal = totalText.trim() === "" ? null : toNumber(totalText);
        if (!parsed || (totalText.trim() !== "" && parsedTotal === null)) return setError(true);
        setError(false);
        onSave({ items: parsed, total: parsedTotal });
      }}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{NUMBER_ERROR}</AlertDescription>
        </Alert>
      ) : null}
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`item-name-${index}`}>Item {index + 1}</Label>
            <Input id={`item-name-${index}`} value={row.name} onChange={(e) => setCell(index, "name", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`item-quantity-${index}`}>Quantity</Label>
            <Input id={`item-quantity-${index}`} inputMode="decimal" value={row.quantity} onChange={(e) => setCell(index, "quantity", e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`item-price-${index}`}>Unit price</Label>
            <Input id={`item-price-${index}`} inputMode="decimal" value={row.unitPrice} onChange={(e) => setCell(index, "unitPrice", e.target.value)} />
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <Label htmlFor="estimate-total">
          Total
          {total === null && totalText === "" ? <span className="font-normal text-muted-foreground"> — not found</span> : null}
        </Label>
        <Input id="estimate-total" inputMode="decimal" value={totalText} onChange={(e) => setTotalText(e.target.value)} />
      </div>
      <Button type="submit" disabled={saving} className="self-start">
        Save values
      </Button>
    </form>
  );
}
