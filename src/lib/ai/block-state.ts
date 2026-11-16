import { EMPTY_MESSAGE, UNAVAILABLE_MESSAGE, type Proposal } from "./parse";
import type { TextFileResult } from "./text-file";

// Стан блоку «Parse a document» як чиста функція (вимога PM solomchaak/property-workflows-spec#59): так його перевіряють без
// браузера. Тут усе, що бачить менеджер, окрім самих форм: текст, очікування, пропозиція, повідомлення.

export const STATUS_MESSAGES = {
  denied: "Not enough rights", // AC-DOCAI-16
  invalid: "The values are not valid. Check them and try again.",
  error: "The values could not be saved. Try again.",
  saved: "Values saved",
} as const;

export type BlockStatus = keyof typeof STATUS_MESSAGES | null;

export type BlockState = {
  text: string;
  reading: boolean; // AC-DOCAI-03
  proposal: { id: number; value: Proposal } | null;
  status: BlockStatus;
  fileError: string | null; // AC-DOCAI-12
};

export const initialBlock: BlockState = { text: "", reading: false, proposal: null, status: null, fileError: null };

export type BlockAction =
  | { type: "text"; text: string }
  | { type: "propose" }
  | { type: "proposed"; proposal: Proposal }
  | { type: "denied" }
  | { type: "failed" } // виклик дії не вдався (мережа): те саме, що «помічник недоступний» (AC-DOCAI-13)
  | { type: "discard" }
  | { type: "file"; result: TextFileResult }
  | { type: "save_result"; status: Exclude<BlockStatus, null> };

const shown = (state: BlockState, value: Proposal) => ({ id: (state.proposal?.id ?? 0) + 1, value });

export function blockReducer(state: BlockState, action: BlockAction): BlockState {
  switch (action.type) {
    case "text":
      return { ...state, text: action.text };
    case "propose":
      // AC-DOCAI-11: порожній текст чи самі пробіли — повідомлення, без очікування й значень.
      if (state.text.trim() === "") {
        return { ...state, reading: false, status: null, fileError: null, proposal: shown(state, { state: "empty", message: EMPTY_MESSAGE }) };
      }
      // AC-DOCAI-03: поки помічник працює — «Reading the document…», жодного значення.
      return { ...state, reading: true, status: null, fileError: null, proposal: null };
    case "proposed":
      return { ...state, reading: false, proposal: shown(state, action.proposal) };
    case "failed":
      return { ...state, reading: false, proposal: shown(state, { state: "unavailable", reason: "provider_error", message: UNAVAILABLE_MESSAGE }) };
    case "denied":
      return { ...state, reading: false, status: "denied" };
    case "discard":
      // AC-DOCAI-05: блок знову порожній, нічого не збережено.
      return initialBlock;
    case "file":
      // AC-DOCAI-12: не .txt — повідомлення й жодного значення; .txt читається в поле тексту.
      return action.result.ok
        ? { ...state, text: action.result.text, proposal: null, status: null, fileError: null }
        : { ...state, proposal: null, status: null, fileError: action.result.message };
    case "save_result":
      return action.status === "saved"
        ? { ...initialBlock, status: "saved" }
        : { ...state, status: action.status };
  }
}
