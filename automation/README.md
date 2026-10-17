# SAL data automation

This folder contains the pre-publish validation layer for dashboard data.

## AMOS trial

`amos_pipeline.py` reads the approved `Amos file` worksheet, validates every
record, calculates the dashboard KPIs, and produces a JSON audit report. It
builds the operational date from `YearID`, `MonthID`, and `Day ID`; `Issue Date`
is not required. Performance is calculated from `Flag`, which is the final
reviewed result after accepted operational justifications; `Prio` is retained
only as the original source classification. It never edits the source workbook. Live data must only be replaced when
`safe_to_replace_live_data` is `true`.

Repeated AMOS Picking List IDs and exact duplicate rows are retained and reported
as warnings. They are not removed unless SAL confirms the business rule later.

The next production stage will run the same rules after a SharePoint workbook
change and store the approved dataset as a new version. A rejected import must
leave the current dashboard version unchanged.

## AOG Delivery trial

`aog_pipeline.py` reads only the current `Automated ` worksheet. It recalculates
elapsed minutes and on-time status from the booked and received times instead
of trusting cached formulas. It also normalizes duplicate station spellings,
including `SHOP`, `Shops`, and `SHOPS`, into one `Shops` category.

## FAK trial

`fak_pipeline.py` reads the current `FAK AutomatedNew ` worksheet and validates
each movement. It normalizes Arrival/Departure labels, status and shift casing,
standardizes Saudi flight numbers with redundant leading zeros, and applies the
approved aircraft rule: destination `CARGO` is Cargo Aircraft; all mapped airport
destinations are Passenger Aircraft.

## Acceptance tests

`run_acceptance_tests.py` compares every calculated KPI with the approved sample
baseline. Any mismatch returns a failing exit code, so an update cannot be
promoted silently when a formula, column mapping, or cleaning rule changes.

## Last-known-good protection

`snapshot_store.py` promotes validated reports atomically and retains versioned
history. `test_snapshot_protection.py` first saves each valid dashboard snapshot,
then submits an intentionally rejected update and verifies byte-for-byte that
the current snapshot did not change.

`test_realistic_failures.py` mutates copies of the real workbooks by removing a
required header and inserting an invalid date. Every failed update must be
rejected without changing the last-known-good snapshot.

`test_valid_append.py` appends one valid, uniquely identified row to a temporary
copy of each workbook. The resulting dashboard total must increase by exactly
one and the validated snapshot must be promoted.
