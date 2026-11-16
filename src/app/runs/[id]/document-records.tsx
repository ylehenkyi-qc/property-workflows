import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmedEstimateSchema, ConfirmedRequestSchema } from "@/lib/ai/confirm";
import { documentTypeLabel, formatConfirmedAt } from "@/lib/ai/document-type";
import { assigneeLabel } from "@/lib/runs/labels";

// Збережені записи AI-розбору на сторінці запуску (AC-DOCAI-04): тип документа, значення, email того, хто підтвердив, дата й
// час за Києвом; найновіший першим (порядок дає запит). Це лише показ: збережені значення нічого більше не змінюють.

type DocumentRecord = { id: string; kind: string; values: unknown; author_id: string; created_at: string };
type User = { id: string; email: string | null };

const NOT_FOUND = "not found";
const show = (value: string | null) => (value && value.trim() !== "" ? value : NOT_FOUND);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-2">
      <dt className="text-muted-foreground sm:w-28">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Values({ kind, values }: { kind: string; values: unknown }) {
  if (kind === "request") {
    const parsed = ConfirmedRequestSchema.safeParse(values);
    if (!parsed.success) return null;
    const v = parsed.data;
    return (
      <dl className="flex flex-col gap-1">
        <Row label="Phone" value={show(v.phone)} />
        <Row label="Description" value={show(v.description)} />
        <Row label="Category" value={show(v.category)} />
        <Row label="Urgency" value={show(v.urgency)} />
      </dl>
    );
  }
  const parsed = ConfirmedEstimateSchema.safeParse(values);
  if (!parsed.success) return null;
  const { items, total } = parsed.data;
  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-1">
        {items.map((item, index) => (
          <li key={index} className="tabular-nums">
            {item.name}: {item.quantity} x {item.unitPrice.toFixed(2)}
          </li>
        ))}
      </ul>
      <p className="tabular-nums">Total: {total === null ? NOT_FOUND : total.toFixed(2)}</p>
    </div>
  );
}

export function DocumentRecords({ records, users }: { records: readonly DocumentRecord[]; users: readonly User[] }) {
  if (records.length === 0) return null;
  return (
    <section className="flex flex-col gap-4" aria-labelledby="saved-records-heading" data-testid="document-records">
      <h2 id="saved-records-heading" className="text-lg font-semibold">
        Saved records
      </h2>
      {records.map((record) => (
        <Card key={record.id} data-testid="document-record">
          <CardHeader>
            <CardTitle>{documentTypeLabel(record.kind)}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Confirmed by {assigneeLabel(record.author_id, users)} · {formatConfirmedAt(record.created_at)}
            </p>
          </CardHeader>
          <CardContent>
            <Values kind={record.kind} values={record.values} />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
