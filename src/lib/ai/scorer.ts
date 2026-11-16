import { Output, generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { JUDGE_INSTRUCTIONS, judgePrompt } from "./prompts/judge";
import type { EstimateItem, Proposal } from "./parse";

// Оцінювач golden cases (AC-DOCAI-01…07, 10…12): точні поля порівнює код; вільний текст опису за rubric оцінює LLM-суддя
// (лише в живому прогоні `npm run eval`). Кейси — 10 golden cases PM (solomchaak/property-workflows-spec#40), тимчасові:
// вимоги PM зрізу 4 немає (на 2026-11-15), тож AC-DOCAI-NN — від розробника.

type RequestExpected = {
  kind: "request";
  phone: string | null;
  category: string;
  urgency: string;
  notFound: string[];
  notes: string[];
};
type EstimateExpected = { kind: "estimate"; items: EstimateItem[]; total: number; warnings: string[]; notes: string[] };
type RefusedExpected = { kind: "refused"; message: string };

export type GoldenExpected = RequestExpected | EstimateExpected | RefusedExpected;
export type GoldenCase = { id: string; ac: string; source: string; input: string; expected: GoldenExpected; rubric?: string };
export type Score = { pass: boolean; mismatches: string[] };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function check(mismatches: string[], label: string, got: unknown, want: unknown) {
  if (!same(got, want)) mismatches.push(`${label}: очікувалось ${JSON.stringify(want)}, отримано ${JSON.stringify(got)}`);
}

// Примітка очікуваного тексту має бути в одній з приміток відповіді (без урахування регістру); зайвих приміток бути не має.
function checkNotes(mismatches: string[], got: string[], want: string[]) {
  const lower = got.map((n) => n.toLowerCase());
  for (const note of want) {
    if (!lower.some((n) => n.includes(note.toLowerCase()))) mismatches.push(`примітка «${note}» не знайдена серед ${JSON.stringify(got)}`);
  }
  if (want.length === 0 && got.length > 0) mismatches.push(`зайві примітки: ${JSON.stringify(got)}`);
}

function scoreRequest(want: RequestExpected, proposal: Proposal): string[] {
  if (proposal.state !== "ok" || proposal.kind !== "request") return [`очікувалась заявка, отримано стан ${proposal.state}`];
  const mismatches: string[] = [];
  check(mismatches, "phone", proposal.request.phone, want.phone);
  check(mismatches, "category", proposal.request.category, want.category);
  check(mismatches, "urgency", proposal.request.urgency, want.urgency);
  check(mismatches, "notFound", [...proposal.notFound].sort(), [...want.notFound].sort());
  checkNotes(mismatches, proposal.notes, want.notes);
  return mismatches;
}

const norm = (items: EstimateItem[]) => items.map((i) => ({ name: i.name.trim().toLowerCase(), quantity: i.quantity, unitPrice: i.unitPrice }));

function scoreEstimate(want: EstimateExpected, proposal: Proposal): string[] {
  if (proposal.state !== "ok" || proposal.kind !== "estimate") return [`очікувався кошторис, отримано стан ${proposal.state}`];
  const mismatches: string[] = [];
  check(mismatches, "items", norm(proposal.items), norm(want.items));
  check(mismatches, "total", proposal.total, want.total);
  check(mismatches, "warnings", proposal.warnings, want.warnings);
  checkNotes(mismatches, proposal.notes, want.notes);
  return mismatches;
}

function scoreRefused(want: RefusedExpected, proposal: Proposal): string[] {
  if (proposal.state !== "refused") return [`очікувалась відмова, отримано стан ${proposal.state}`];
  return proposal.message === want.message ? [] : [`message: очікувалось «${want.message}», отримано «${proposal.message}»`];
}

export function scoreProposal(expected: GoldenExpected, proposal: Proposal): Score {
  const mismatches =
    expected.kind === "request"
      ? scoreRequest(expected, proposal)
      : expected.kind === "estimate"
        ? scoreEstimate(expected, proposal)
        : scoreRefused(expected, proposal);
  return { pass: mismatches.length === 0, mismatches };
}

export function passRate(rows: { pass: boolean }[]) {
  const passed = rows.filter((r) => r.pass).length;
  return { passed, total: rows.length, rate: rows.length === 0 ? 0 : passed / rows.length };
}

const VerdictSchema = z.object({ pass: z.boolean(), reason: z.string() });

// Суддя оцінює лише вільний текст опису за rubric PM; вердикт двійковий + причина. Користуються лише в живому eval.
export async function judgeDescription(model: LanguageModel, rubric: string, description: string | null) {
  const { output } = await generateText({
    model,
    instructions: JUDGE_INSTRUCTIONS,
    messages: [{ role: "user", content: [{ type: "text", text: judgePrompt(rubric, description ?? "") }] }],
    output: Output.object({ name: "verdict", schema: VerdictSchema }),
    temperature: 0,
    maxRetries: 0,
    timeout: 90_000,
  });
  return output;
}
