"use client";

import { useReducer, useTransition } from "react";
import { blockReducer, initialBlock } from "@/lib/ai/block-state";
import { readTextFile } from "@/lib/ai/text-file";
import { confirmDocumentValues, proposeDocumentValues } from "./document-actions";
import { DocumentBlockView } from "./document-block";
import type { SavedValues } from "./document-form";

// Блок «Parse a document» на сторінці запуску (вимога PM solomchaak/property-workflows-spec#59): менеджер запуску й
// адміністратор вставляють текст або завантажують .txt, «Propose values» лише ПРОПОНУЄ (нічого не пишемо), «Save values»
// зберігає те, що людина бачить у формі, «Discard» очищає блок. Стан — чиста функція blockReducer; сервер усе одно
// перевіряє роль і право на запуск (AC-DOCAI-16).

const SAVE_STATUS = { saved: "saved", invalid: "invalid", error: "error", forbidden: "denied", unauthenticated: "denied" } as const;

export function DocumentParser({ runId }: { runId: string }) {
  const [state, dispatch] = useReducer(blockReducer, initialBlock);
  const [saving, startSaving] = useTransition();

  const propose = async () => {
    dispatch({ type: "propose" });
    if (state.text.trim() === "") return; // AC-DOCAI-11: до моделі не звертаємось
    const result = await proposeDocumentValues(runId, state.text);
    dispatch(result.status === "ok" ? { type: "proposed", proposal: result.proposal } : { type: "denied" });
  };

  const save = (saved: SavedValues) =>
    startSaving(async () => {
      const result = await confirmDocumentValues(runId, saved.kind, saved.values);
      dispatch({ type: "save_result", status: SAVE_STATUS[result.status] });
    });

  return (
    <DocumentBlockView
      state={state}
      saving={saving}
      onText={(text) => dispatch({ type: "text", text })}
      onPropose={propose}
      onFile={async (file) => dispatch({ type: "file", result: await readTextFile(file) })}
      onDiscard={() => dispatch({ type: "discard" })}
      onSave={save}
    />
  );
}
