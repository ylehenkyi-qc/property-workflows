import { z } from "zod";
import { CATEGORIES, URGENCIES } from "./schema";

// Повторна валідація значень, які користувач підтвердив у формі (AC-DOCAI-08): сервер не довіряє ні пропозиції моделі,
// ні тілу запиту з браузера. Пишемо лише те, що пройшло ці схеми; зайві поля відхиляємо.

// Порожній рядок у формі — «значення немає» (null), а не порожній текст.
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());

const money = z.number().finite().nonnegative();

export const ConfirmedRequestSchema = z.strictObject({
  phone: optionalText(40),
  description: optionalText(300),
  category: z.enum(CATEGORIES).nullable(),
  urgency: z.enum(URGENCIES).nullable(),
});

export const ConfirmedEstimateSchema = z.strictObject({
  items: z
    .array(z.strictObject({ name: z.string().trim().min(1).max(120), quantity: money, unitPrice: money }))
    .min(1)
    .max(100),
  total: money.nullable(),
});

export type Confirmed =
  | { ok: true; kind: "request"; values: z.infer<typeof ConfirmedRequestSchema> }
  | { ok: true; kind: "estimate"; values: z.infer<typeof ConfirmedEstimateSchema> }
  | { ok: false };

export function parseConfirmed(kind: unknown, values: unknown): Confirmed {
  if (kind === "request") {
    const parsed = ConfirmedRequestSchema.safeParse(values);
    return parsed.success ? { ok: true, kind, values: parsed.data } : { ok: false };
  }
  if (kind === "estimate") {
    const parsed = ConfirmedEstimateSchema.safeParse(values);
    return parsed.success ? { ok: true, kind, values: parsed.data } : { ok: false };
  }
  return { ok: false };
}
