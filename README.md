# Booking net calculator

A single-screen web app that answers one question: given a nightly rate on
Booking.com or Airbnb, how much money is actually kept — or lost — in a
month, after platform commission, tax, per-stay costs, and recurring monthly
costs. Every figure recalculates as you type; there is no calculate button.
The app also prints the full trail of the calculation, line by line, so the
final number can be checked rather than trusted.

## Running it

```
pnpm install
pnpm dev      # start the dev server
pnpm test     # run the test suite
pnpm build    # type-check and build for production
pnpm lint     # oxlint
```

## Inputs

| Field | Unit | Default |
|---|---|---|
| Nightly rate | € | *(empty)* |
| Number of nights booked in month | nights | *(empty)* |
| Number of stays | count | *(empty)* |
| Platform commission | % | `15` |
| Tax rate | % | `19` |
| Fixed cost per stay | € | `75` |
| Monthly fixed costs | € | *(empty)* |

Nights booked is entered directly; the app makes no assumption about how
many days are in the month.

## Calculation

The tax base is gross income minus commission, and nothing else — per-stay
and monthly costs are paid out of already-taxed money and never reduce tax.
Net kept is gross income minus total costs (commission + tax + per-stay costs
+ monthly fixed costs). Percentages are not clamped to 100, and a negative net
is preserved and displayed rather than clamped to zero.

## Decimal separators

Both `.` and `,` are accepted as the decimal separator. What a lone separator
means depends on the field: for money and counts, a lone separator followed
by exactly three digits is grouping (`2,400` is 2400) and anything else is a
decimal point (`33,33` is 33.33); for percentages, a lone separator is always
a decimal point, so `19.375` is a 19.375% rate rather than 19375%. With two or
more separators, all but the last are grouping in both cases.

## Persistence

Input values are saved to `localStorage` under the key
`booking-calculator:inputs:v1` and restored on reload.

An earlier version of this app asked for *unfilled* days instead of nights
booked, and derived the nights-booked figure as 30 minus that value. Data
saved under that version is migrated automatically: a stored `unfilledDays`
value becomes `30 − unfilledDays` (clamped at 0) the first time it loads
under the current version.
