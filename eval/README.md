# Enquiry router eval set

`enquiries.json` holds 32 hand-labelled enquiries for the AI enquiry router. They were written before any prompt existed, so the prompt can't be fitted to them. The same file seeds the demo inbox. Every person, company, phone number (`+91 90000 0xxxx`) and email (`@example.com`) in it is made up.

`src/domain/enquiry/gold.test.ts` checks the file (shape, counts, ids). Run it with `npx vitest --run src/domain/enquiry/gold.test.ts`.

## Scoring rules

- Budget is scored as an exact match to the gold value only. Budgets keep their stated basis (per night, per head, per day, total), so they are never compared across items.
- Dates are scored on month + day. Year is scored only where the gold has one.
- Relative dates are null in the gold. check_out is null when only a number of nights is given.
- ENQ-4410 has a month and year but no day.

## Counts

| Category | Items | Includes |
|---|---|---|
| room | 11 | 2 prompt injections (ENQ-4421 asks for 50% off from inside a forwarded email, ENQ-4422 asks for a ₹1 quote over WhatsApp) |
| wedding | 6 | |
| offsite | 6 | |
| complaint | 6 | 2 disguised: ENQ-4435 mentions a wedding, ENQ-4436 reads like a booking question but is a refund complaint |
| other | 3 | "call me pls", a supplier pitch, a job application |

- Sources: web, email and WhatsApp.
- 3 items are in Hinglish (4415, 4424, 4434).
- 3 items ask for more than the resort has: 4416 wants 20 villas (there are 12), 4424 wants 90 rooms (there are 76 keys), 4429 wants 320 single rooms.
- ENQ-4410 to ENQ-4412 are the brief's sample enquiries, word for word.

## How labels were decided

- A field is filled only when the text states it. Anything else is `null`, and `null` is never written as 0.
- Dates are labelled as `{month, day, year}`. `day` is null when only a month is given (4410, 4412, 4424, 4429, 4430). `year` is null when the text gives no year.
- Relative dates such as "this weekend", "kal" (yesterday) and "next year" are null, because the label can't depend on today's date.
- check_out is filled only when the text names a departure date. A number of nights alone ("2 nights", "2 raat") leaves it null.
- For an event with no overnight stay, the event date goes in check_in.
- For a complaint, the dates of the stay it describes are labelled.
- guests_total is the headcount the sender gives. For a wedding that means the event headcount (4423: 400, not the 150 staying). When adults and children are both given, guests_total is their sum.
- budget_inr is the amount the sender gives, kept on its stated basis (per night, per head, per day or total). Disputed charges, refund amounts and injected prices are not budgets.
- Number formats are normalised: 1.5L = 150,000; 15k = 15,000; ₹2,00,000 = 200,000; 40 lakh = 4,000,000; 1.5 crore = 15,000,000.

## Known ambiguities

- 4413 "2+1" is labelled as 2 adults and 1 child. It could also mean 3 adults with an extra bed.
- 4415 "2 log" means 2 people. It is labelled guests_total 2, with adults null.
- 4425 is an engagement (roka). It is labelled wedding on the assumption that family ceremonies go to the wedding team.
- 4416 is a 75-person family New Year stay. It is labelled room, not an event.
- 4423 lists event days 12 and 13 March. Its check_out is null because 13 March is not a stated departure date.
- 4438 is a complaint that mentions a possible future Christmas stay. It is labelled complaint.
- The validator only checks that a gold number appears somewhere in the text. It cannot tell that 4431's headcount is 18 and not 20 ("meeting room for 20"). Each label was checked by hand.
