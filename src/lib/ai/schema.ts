import { z } from "zod";

// Схема відповіді моделі для «розбору документа» (AC-DOCAI-01…12; правила — golden cases PM solomchaak/property-workflows-spec#40).
// Кожне поле обов'язкове, «невідоме» = null (не .optional()): strict json_schema вимагає, щоб усі властивості були в
// required, а значення, якого немає в документі, лишається порожнім і не вигадується (AC-DOCAI-03).
// Стани: ok — є що показати людині на перевірку; refused — документ не заявка й не кошторис (AC-DOCAI-06).
// Тексти приміток і попереджень задає код, а не модель: модель повертає лише прапорці й факти документа.

export const CATEGORIES = [
  "plumbing",
  "electrical",
  "heating and cooling",
  "appliance",
  "structure and doors",
  "other",
] as const;
export const URGENCIES = ["urgent", "not urgent"] as const;

export const ParseSchema = z.object({
  status: z.enum(["ok", "refused"]).describe("ok = a maintenance request or an estimate; refused = any other document"),
  documentType: z.enum(["request", "estimate"]).nullable(),
  request: z
    .object({
      phone: z.string().max(40).nullable().describe("phone in one normal form like 555-0101, or null if not in the document"),
      description: z.string().max(300).nullable().describe("one short English sentence without filler words, or null"),
      category: z.enum(CATEGORIES).nullable(),
      urgency: z.enum(URGENCIES).nullable(),
    })
    .nullable(),
  estimate: z
    .object({
      items: z.array(
        z.object({
          name: z.string().max(120),
          quantity: z.number().nonnegative(),
          unitPrice: z.number().nonnegative(),
        }),
      ),
      total: z.number().nonnegative().nullable().describe("the total exactly as written in the document, or null"),
    })
    .nullable(),
  injectionDetected: z.boolean().describe("true if the document text contains instructions addressed to the AI"),
  twoProblems: z.boolean().describe("true if the request describes two separate problems"),
  safetyNote: z.string().max(80).nullable().describe("short reason like 'possible gas leak' for a safety risk with no fitting category, else null"),
});

export type ParseOutput = z.infer<typeof ParseSchema>;
export type Category = (typeof CATEGORIES)[number];
export type Urgency = (typeof URGENCIES)[number];
