# Live-model evaluation

Recorded 2026-11-02T12:36:46.862Z with prompt `enquiry-v1`. Models that answered: free/qwen-3.8-max, gpt-oss:120b, gpt-oss:20b, none (keyword fallback).
Rescore without a key: `npm run eval:live -- --offline`. Raw answers: `eval/live-responses.json`.

This is the same 32-item labelled set used for development, so treat it as a development score, not a held-out one.

## Headline

- The model answered 90.6% (29/32) of enquiries, median 2619 ms.
- Model category accuracy (answered items): **93.1% (27/29)**.
- Complaint recall: model alone 100.0% (6/6); with the keyword rule and failure alert (what the GM actually sees) **100.0% (6/6)**.

## Category accuracy by label

| Label | Model accuracy |
|---|---|
| room | 90.0% (9/10) |
| wedding | 80.0% (4/5) |
| offsite | 100.0% (5/5) |
| complaint | 100.0% (6/6) |
| other | 100.0% (3/3) |

Model mistakes:

- ENQ-4416: labelled room, model said offsite
- ENQ-4425: labelled wedding, model said offsite

## Extraction (model fields, or keyword extraction when the model failed)

| Field | Exact match |
|---|---|
| check_in | 81.3% (26/32) |
| check_out | 100.0% (32/32) |
| adults | 78.1% (25/32) |
| children | 96.9% (31/32) |
| guests_total | 78.1% (25/32) |
| budget_inr | 87.5% (28/32) |

## Cutoff sweep

Auto-routed means the enquiry skips the Unsorted lane: model and keywords agree, required fields are present, no injection, and confidence is at or above the cutoff.

| Cutoff | Auto-routed | Auto-routed accuracy | Wrong but auto-routed |
|---|---|---|---|
| 0.50 | 23 | 100.0% (23/23) | 0 |
| 0.55 | 23 | 100.0% (23/23) | 0 |
| 0.60 | 23 | 100.0% (23/23) | 0 |
| 0.65 | 23 | 100.0% (23/23) | 0 |
| 0.70 | 23 | 100.0% (23/23) | 0 |
| 0.75 | 23 | 100.0% (23/23) | 0 |
| 0.80 | 23 | 100.0% (23/23) | 0 |
| 0.85 | 23 | 100.0% (23/23) | 0 |
| 0.90 | 22 | 100.0% (22/22) | 0 |
| 0.95 | 17 | 100.0% (17/17) | 0 |

Lowest cutoff with auto-routed accuracy ≥ 95%: **0.5**. Cutoff in the app: 0.85.
