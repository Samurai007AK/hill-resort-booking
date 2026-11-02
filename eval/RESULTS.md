# Enquiry evaluation

Run with `npm run eval` (or `npx tsx scripts/eval.ts`). No credentials or network are used. Dataset: 32 independently labelled enquiries recovered from the original pre-prompt dataset.

## Scope and limits

This is a development set, not a held-out test set. Baseline rules were developed with visibility of these messages, so the perfect category score is not evidence of generalisation to unseen enquiries.

These numbers measure the deterministic keyword/extraction baseline and synthetic routing fixtures. They are **not live-model accuracy**. The live primary and fallback adapters are exercised by tests with fake HTTP responses; a provider-backed held-out evaluation remains outstanding. Seed fixture confidence values deliberately exercise review states and are not calibrated probabilities.

Keyword category accuracy: **100.0% (32/32)**. Keyword complaint recall: **100.0% (6/6)**. Combined GM-alert recall on synthetic fixtures: **100.0% (6/6)**. Live-model complaint recall: not measured.

## Category accuracy

| Category | Exact category accuracy |
|---|---|
| room | 100.0% (11/11) |
| wedding | 100.0% (6/6) |
| offsite | 100.0% (6/6) |
| complaint | 100.0% (6/6) |
| other | 100.0% (3/3) |

## Extraction exact matches

Nulls are scored too. Date month/day must match; year is scored only when the label states it. Budgets retain the sender's stated basis.

| Field | Exact matches |
|---|---|
| check_in | 93.8% (30/32) |
| check_out | 100.0% (32/32) |
| adults | 100.0% (32/32) |
| children | 100.0% (32/32) |
| guests_total | 100.0% (32/32) |
| budget_inr | 100.0% (32/32) |

## Synthetic confidence threshold sweep

The lane policy additionally requires AI/rule agreement, complete required fields, availability of the model, and no injection. This table is an interface exercise, not evidence for a production confidence cutoff. Current cutoff 0.85 is a conservative assumption and must be recalibrated with independently recorded live-model outputs.

| Minimum confidence | Auto-routed fixtures | Category accuracy |
|---|---|---|
| 0.50 | 26 | 100.0% (26/26) |
| 0.55 | 26 | 100.0% (26/26) |
| 0.60 | 26 | 100.0% (26/26) |
| 0.65 | 26 | 100.0% (26/26) |
| 0.70 | 25 | 100.0% (25/25) |
| 0.75 | 25 | 100.0% (25/25) |
| 0.80 | 25 | 100.0% (25/25) |
| 0.85 | 25 | 100.0% (25/25) |
| 0.90 | 25 | 100.0% (25/25) |
| 0.95 | 25 | 100.0% (25/25) |

## Prompt injection checks

- ENQ-4421: unsorted; instruction-like input flagged. Direct currency, number words, invented extracted numbers and unknown slots are rejected by pipeline tests. Server slots alone supply numeric quotes.
- ENQ-4422: unsorted; instruction-like input flagged. Direct currency, number words, invented extracted numbers and unknown slots are rejected by pipeline tests. Server slots alone supply numeric quotes.

## Known limits

The keyword extractor is intentionally small. Ambiguous dates, unfamiliar phrasing, relative dates, and incomplete party details require staff confirmation. Government-ID and contact redaction uses patterns and cannot guarantee detection of every identifier or name. Model failure and AI-off requests remain Unsorted, with an explicit status and GM alert. Drafts are never delivered automatically. Event and buyout pricing requires a staff proposal.
