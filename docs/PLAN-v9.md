# Amygo: a log you can keep and trust (v9)

v8 put Amygo on a public link, made it work with no signal, and let it install on a phone. v9 makes the workout log
worth years of use: you can **back it up and restore it** (and move it from one address to another), every strength
set can carry a **weight in kg**, and a wrong set can be **fixed instead of only removed**. Still no backend, no new
packages, no 3D work, and the app still sends nothing anywhere.

It builds on:

- **v7** (`src/log/`): sets with a stable `id`, `kind`, `endedAt`, `seconds`, and `reps` or `meters` (plus `strokes` on
  the rower). Every saved entry is checked on its own before it's trusted (`logStorage.ts`). v9 adds one optional field,
  `kg`, and reuses the same checks for a backup file.
- **v8 Block 1** (`src/lib/storage.ts`, the https link): a backup downloads as a file, and on https Chrome no longer warns
  about the download. Restore reads a file the person picks, which works on any address.
- **The Exercises list** (`src/shell/ExercisesPage.tsx`): each row has History and Start. The weight picker goes on that
  row, before Start, so the gym itself doesn't change.

## How this plan works

Same rules as before:

- **3 features per version, one feature per block.**
- **Each block has a test phase** (Vitest, each test checked to fail when the thing it guards is broken) that must pass
  before the next block starts. The Android check stays **optional** and is never marked passed unless done on the phone.
- **Each block ends with a 1–3 sentence summary.**
- **We stop after every block** and wait for your yes. A yes to this plan is not a yes to start building.
- v9 gets its own branch off `master` (`v9-log-you-keep`). As in v8, each finished block is fast-forwarded into `master`
  and pushed with your OK at that moment (the v8 D8 order: show branch and clean tree, fast-forward, re-run the tests in
  the `master` folder, push), so the link updates block by block.

## Where it sits

After v8 Block 3 (install) is on the link. Block 1 is the first thing to build then, because it's the only way to carry
your phone's sets from the laptop's Wi-Fi address to amygo.vercel.app (v8 D4), and the longer that waits the more sets
stay behind.

## The starting point (measured 2026-10-07, `master` at `06a4bf2`)

| Measure | Now |
| --- | --- |
| Tests | 129 passing, in 31 files (see the note under this table) |
| Shell code (compressed), budget 60 KB | 14.9 KB |
| Saved log | `gym3d.log`, version 1, up to 5,000 sets; fields `id`, `kind`, `endedAt`, `seconds`, `reps` / `meters` / `strokes`; **no weight** (v7 D2) |
| Corrections | **Remove** only, per set; **Clear history** for everything (asks first) |
| Getting the log out | No way: it lives in one browser's storage and nothing reads it but the app |
| Live link | amygo.vercel.app, serving `master` (v8 Block 1); v8 Blocks 2 and 3 still to come |

Note on the tests: `src/shell/loading.test.ts` rebuilds `dist/` before its checks, so **two test runs started at the
same time in one folder make each other fail** (one reads the other's half-written build). It showed up while measuring
for this plan; run alone, the file passes. One `npm test` at a time per folder.

**Facts from the code that shape this plan:**
- **Set ids are already unique and travel with the set** (`newId()` in `logStore.ts`: time, a counter, and a random
  part). So a restore can tell "already here" from "new" without a server and without ever doubling a set.
- **Every exercise's speed is fixed** (`speed` in `catalog.ts`). A cardio set's distance is speed × time, so editing a
  cardio set only needs a new time: the distance (and the rower's strokes) follow from it, the same way `finishedPart()`
  works them out today.
- **One check guards every saved entry** (`isSet()` in `logStorage.ts`). A backup file is checked entry by entry with
  the same function, so a damaged line costs one set, not the file.
- **What the popup and the log say comes from one place** (`activityText.ts`, `logText.ts`). Adding "· 10 kg" there puts
  it on the popup, the Today page, the day summaries and the history page at once.
- **`weights: 'across' | 'forward'` in the catalog** already marks the dumbbell exercises. The weight picker uses that
  plus a short list of machine exercises to know which rows get one.

## The order, and why

| Block | Feature | What it gives you |
| --- | --- | --- |
| 1 | Back up and restore | A file of your log; restore merges it into any browser, never doubling a set |
| 2 | Weights in kg | A weight on each strength row before Start, saved with the set, shown everywhere |
| 3 | Fix a set | Edit a saved set's numbers; Undo after Remove |

- **Backup first** because it's needed now (moving the phone's log to the link) and it protects everything the next two
  blocks add. It also fixes the backup file's shape before weights arrive, and the file carries `kg` with no change once
  Block 2 adds it (the entry check passes unknown optional numbers through).
- **Weights second** because they're the biggest gap in the log for real training. They change what a "best set" means,
  so they come before editing, which has to edit them.
- **Fixing a set last** because it edits everything the first two blocks defined.

## Decisions (decided 2026-10-07, all as recommended)

| # | Question | Decision |
| --- | --- | --- |
| D1 | Start v9 **right after v8 Block 3** is on the link, or **now**, alongside v8? | **After v8.** Both touch `TodayPage.tsx` and the log store; two branches editing them at once means merge fixes for no gain. |
| D2 | **The backup file:** a JSON file named `amygo-log-2026-10-07.json` (the day it was made), holding the app name, a version number, the time, and the sets. OK? | **Yes.** JSON is what the log already is; the name sorts by date in a Downloads folder; the app name and version let Restore refuse a file that isn't ours. |
| D3 | **Restore always merges** by set id (new sets added, sets already here kept as they are) and reports "Added 42 · 8 already here". There is **no Replace**. OK? | **Yes.** Merge can't lose anything, so it never needs an "are you sure". Someone who wants a clean slate has Clear history, then Restore. |
| D4 | **How the file leaves the phone:** the browser's own download (lands in Downloads, then share it from there). No share sheet, no cloud. OK? | **Yes.** The share sheet (Web Share with files) isn't on every Android browser, and a download works everywhere, including the laptop's Wi-Fi address where your old sets are. |
| D5 | **Weights are in kg only**, no pounds. OK? | **Yes.** The gym's plates are kg, and a unit switch doubles every piece of text and every test. |
| D6 | **Which rows get a weight, and the steps:** dumbbell exercises **per dumbbell**, 1 kg steps, 1–50 kg; machine exercises (leg press, chest fly, pushdowns, cable rows) **the stack**, 5 kg steps, 5–200 kg; back squat **the bar with plates**, 2.5 kg steps, 20–300 kg; **pull-ups and cardio: none**. OK? | **Yes.** Those are the real increments on each piece of kit. Pull-ups are bodyweight; added weight can come later. |
| D7 | **The weight is picked on the Exercises row before Start** (a − / + stepper that remembers your last weight for that exercise), not changed mid-set. OK? | **Yes.** Mid-set, your hands are busy. The stepper means no typing on a phone, and remembering the last weight makes the usual case one tap: Start. |
| D8 | **Fixing a set:** Edit changes the numbers (reps and kg for strength; minutes and seconds for cardio, with the distance recalculated), never the time of day or the day. **Undo** appears for 6 seconds after Remove. OK? | **Yes.** Changing when a set happened would move it between days and make "best set" lie about the date. Undo covers the common mistake (wrong row) without a confirm box on every Remove. |

---

## v9: A log you can keep and trust

### Block 1: Back up and restore

**What you'll see:** at the bottom of the Today page, next to Clear history, two buttons: **Back up** and **Restore**.
Back up downloads `amygo-log-2026-10-07.json`. Restore opens the phone's file picker; pick a backup and a line appears:
"Added 42 sets · 8 already here". Pick a file that isn't an Amygo backup and it says so, and nothing changes. Nothing is
sent anywhere: the file goes from the app to your Downloads folder and back.

**How:**
- **The file** (per D2): `{ app: "amygo", version: 1, exportedAt, sets }`, in a new `src/log/backup.ts` with no React in
  it: `backupText(sets, now)` makes the text, `readBackup(text)` checks it. The sets inside are checked one by one with the
  same `isSet()` the saved log uses (moved to a shared spot so both read it).
- **Download:** the text becomes a Blob and an `<a download>` link is clicked, then the link's address is released. No
  library.
- **Restore** (per D3): `mergeSets(here, incoming)` in `sets.ts` adds the sets whose id isn't here, keeps the rest, and
  returns what it added and what it skipped. Then the 5,000 cap applies as it does for new sets (oldest go first). The
  file is read with `FileReader`; the result line is plain text under the buttons, also read out by screen readers.
- **Refusing a file:** not JSON, no `app: "amygo"`, or a version newer than this app's: a message, the log untouched.
  A file with some damaged entries keeps the good ones and says how many were skipped.
- **A restore that can't be saved** (storage blocked or full) still shows the merged log for this visit, as saving
  already works today.

**Tests:**

| ID | Checks |
| --- | --- |
| V9B1-T1 | Back up then restore into an empty log gives back the same sets, same ids, same numbers |
| V9B1-T2 | Restoring into a log that already has some of the sets adds only the new ones; the ones already here are unchanged, even if the file's copy differs |
| V9B1-T3 | A file with damaged entries keeps the good ones, skips the bad, and the counts say so |
| V9B1-T4 | Not JSON, another app's file, or a newer version: refused with a message, and the log is exactly as before |
| V9B1-T5 | Restoring past 5,000 sets keeps the newest 5,000 |
| V9B1-T6 | The file name carries the date it was made; `exportedAt` is the time of day |

**Visual check:** on the phone, Back up at the laptop's Wi-Fi address, then Restore the file at amygo.vercel.app: the
Today page shows the old days under Earlier. Restore the same file again: "Added 0 · N already here".

**Summary:** The log can leave the browser as a file and come back into any browser without doubling a set, which also
moves your phone's sets to the public link.

### Block 2: Weights in kg

**What you'll see:** on the Exercises list, every strength row (per D6) has a small **− 10 kg +** stepper next to Start.
It remembers your last weight for that exercise. Start, and the popup in the gym says "Doing bicep curls · 10 kg". The
saved set reads "12 reps · 10 kg", the day summary "Bicep curls 3 × 12 @ 10 kg", and an exercise's History marks the
heaviest set as best. Old sets without a weight still show as they do today.

**How:**
- **The catalog says which rows get a weight** (per D6): a `load` entry per exercise, `{ of: 'dumbbell' | 'stack' | 'bar',
  step, min, max }`, in `src/exercises/catalog.ts`; cardio and pull-ups have none. The stepper reads only this table.
- **The chosen weight** lives in a small `src/exercises/weights.ts` store: `kgFor(kind)` and `setKg(kind, kg)`, clamped
  to the row's range. The last weight per exercise is saved in the browser (`gym3d.weights`, through the same careful
  `storage()` helper). A row with no saved weight starts at its minimum.
- **From the row to the set:** `startFromList(kind)` passes the weight into the activity (`kg` on `Activity`), and
  `finishedPart()` copies it onto the saved set. A set started from the in-gym menu (E at the machine) uses the same
  remembered weight, so both ways agree. Cardio sets never carry `kg`.
- **Everywhere it's shown:** `headline()` adds "· 10 kg" on the popup, `setNumbers()` on the Today page and history,
  `daySummary()` writes "3 × 12 @ 10 kg" (or lists them when they differ: "12 @ 10 kg, 10 @ 12 kg").
- **Best set** (`bestSet()`): heavier wins; same weight, more reps wins; sets with no weight count as 0 kg, so an old
  12-rep set loses to a new 8-rep set at 10 kg. On a tie the earlier set stays best, as today.
- **Saved log:** `kg` is optional, a number ≥ 0, checked in `isSet()`. The log version stays 1: old saves load unchanged,
  and a Block 1 backup made before this block restores fine.

**Tests:**

| ID | Checks |
| --- | --- |
| V9B2-T1 | Every row's steps and range match D6; − and + never go below the minimum or above the maximum |
| V9B2-T2 | A set finished with a weight chosen carries that `kg`; cardio and pull-up sets never do |
| V9B2-T3 | The last weight per exercise is remembered across a reload, and a row never seen starts at its minimum |
| V9B2-T4 | Texts: popup "Doing bicep curls · 10 kg", set "12 reps · 10 kg", summary "3 × 12 @ 10 kg" and the mixed form |
| V9B2-T5 | Best set: heavier beats more reps; equal weight, more reps wins; old sets without a weight rank as 0 kg |
| V9B2-T6 | An old saved log (no `kg`) and a Block 1 backup both load with every set intact |

**Visual check:** set 12 kg on Bicep curls, Start, finish 10 reps; Today shows "10 reps · 12 kg", History marks it best,
and the row still says 12 kg after a reload. The shell stays well under budget (expected under 17 KB).

**Summary:** Strength sets now carry a weight in kg, picked on the row before Start and remembered per exercise, and
History knows the heaviest set is the best one.

### Block 3: Fix a set

**What you'll see:** every saved set on the Today page (today's and under Earlier) has **Edit** beside Remove. Edit turns
the row into a small form: reps and kg for strength, minutes and seconds for cardio, with **Save** and **Cancel**. Save
updates the row, the day's totals and summary, and the exercise's History on the spot. Tap Remove and the row becomes
"Removed · **Undo**" for six seconds (per D8), then goes.

**How:**
- **`editSet(id, changes)`** in `logStore.ts` keeps `id`, `kind` and `endedAt` and replaces the numbers. For cardio the
  new `seconds` gives `meters` (speed × seconds) and, on the rower, `strokes`, using the same maths as `finishedPart()`,
  so an edited row can't disagree with a freshly saved one.
- **Checks before Save** (`checkEdit()` in `sets.ts`, no React): reps a whole number ≥ 1, kg a number in the row's range
  (or none for rows without one), cardio at least 10 seconds (the same minimum as saving, v7 D3). A bad value keeps Save
  off and says why, in text under the field.
- **The form** is plain inputs with `inputmode="numeric"`, so phones show the number pad. Escape or Cancel restores the
  row unchanged. Focus goes to the first field on Edit and back to the Edit button on Save or Cancel.
- **Undo:** Remove keeps the set aside for six seconds with its position; Undo puts it back with the same id. The timer
  is per set, so removing two rows gives two Undo lines. Leaving the page or letting the time run out drops it for good.
- **Backups and edits:** a restore keeps this device's copy of a set that's already here (Block 1, D3), so a set edited
  here stays as edited even if an older backup is restored.

**Tests:**

| ID | Checks |
| --- | --- |
| V9B3-T1 | Editing reps and kg changes only that set; `id`, `kind` and `endedAt` are kept and the change is saved |
| V9B3-T2 | Editing a cardio set's time recalculates its distance (and strokes on the rower) at the exercise's speed |
| V9B3-T3 | 0 reps, 5 seconds, a weight outside the range, or letters are refused with a reason, and the set stays as it was |
| V9B3-T4 | Undo within six seconds puts the set back with the same id and in its place; after six seconds it's gone |
| V9B3-T5 | After an edit, the day's totals and summary and the exercise's best set reflect the new numbers |
| V9B3-T6 | Cancel and Escape leave the set unchanged |

**Visual check:** edit a set's reps and weight on the phone (the number pad appears), Save, and History's best line
updates; Remove a set, tap Undo, it's back where it was.

**Summary:** A wrong set can be fixed in place, and a wrong Remove can be undone, so the log can be trusted without ever
clearing it. That finishes v9.

---

## Not in this plan

- **A rest timer** between sets, and **routines** (a planned list of exercises for the day). The strongest candidates
  for v10.
- **Charts, goals, streaks, reminders.** Still text and numbers.
- **Pounds**, or a unit switch (D5). **Added weight on pull-ups**, and bodyweight.
- **Dumbbells in the gym that change size with the chosen weight.** The 3D stays as it is.
- **Changing a set's time of day or its day** (D8), or **editing what exercise it was** (remove and redo instead).
- **A Replace option on Restore** (D3), **CSV export**, or sending a backup anywhere by itself.
- **Accounts, sync between devices, or any backend.** A backup file is the no-server answer to "my log on two devices".
- **Keeping an exercise in progress across a reload.**
- Anything left from v8's own list (custom domain, Play listing, analytics, link preview picture).
