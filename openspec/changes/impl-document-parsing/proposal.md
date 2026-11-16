# Proposal

## Why

Реалізуємо зріз 4 (WS10): AI-функція «розбір документа» — помічник читає вставлений текст листа-заявки чи кошторису вендора й пропонує значення, а користувач підтверджує або виправляє їх перед збереженням. Специфікація — `openspec/specs/document-parsing/` (тимчасові AC розробника `AC-DOCAI-01…12`: вимоги PM зрізу 4 на 2026-11-15 немає, джерело — golden cases PM solomchaak/property-workflows-spec#40).

## What Changes

Зміна покриває всі AC зі `specs/document-parsing`: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-03, AC-DOCAI-04, AC-DOCAI-05, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-08, AC-DOCAI-09, AC-DOCAI-10, AC-DOCAI-11, AC-DOCAI-12. Нова таблиця `run_document_values` з RLS, Server Actions `proposeValues` і `confirmValues`, блок «Parse a document» на сторінці запуску, обгортка моделі з ключем лише на сервері, 10 golden cases PM офлайн у CI і один живий eval. Наявні можливості не змінюються.
