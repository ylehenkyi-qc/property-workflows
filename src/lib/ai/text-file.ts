import { MAX_DOCUMENT_CHARS } from "./prompts/parse";

// «Upload a text file» (AC-DOCAI-12): приймаємо лише простий текст (.txt); вміст читається в поле тексту, а решта файлів
// відхиляється повідомленням PM, і жодного значення не пропонується. Чиста функція: браузер дає File, тест — new File(...).
export const FILE_ERROR = "Only plain text files (.txt) are accepted";

export type TextFileResult = { ok: true; text: string } | { ok: false; message: string };

const isPlainText = (file: { name: string; type: string }) =>
  /\.txt$/i.test(file.name) && (file.type === "" || file.type === "text/plain");

export async function readTextFile(file: File): Promise<TextFileResult> {
  if (!isPlainText(file)) return { ok: false, message: FILE_ERROR };
  try {
    return { ok: true, text: (await file.text()).slice(0, MAX_DOCUMENT_CHARS) };
  } catch {
    return { ok: false, message: FILE_ERROR };
  }
}
