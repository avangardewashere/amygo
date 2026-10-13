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

**What you'll see** (as built; the first draft had just two buttons next to Clear history): at the bottom of the Today
page, a **Your log** section: one line saying the log is saved in this browser only, then **Back up** and **Restore**, a
result line under them, and Clear history on its own below. Back up downloads `amygo-log-2026-10-07.json` (it shows once
there are sets); Restore is always there, because a new browser with no sets is exactly where a backup arrives. Restore
opens the phone's file picker; pick a backup and the line reads "Added 42 sets · 8 already here · backup made Yesterday,
21:10". Pick a file that isn't an Amygo backup and it says so, and nothing changes. Nothing is sent anywhere: the file
goes from the app to your Downloads folder and back.

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

**Status: done** (built 2026-10-08 on branch `v9-log-you-keep`; committed 2026-10-11). 150 tests passing (8 new: V9B1-T1..T8;
V7B2-T2 fixed, see below). **Built:** `src/log/backup.ts` (the file: its name, its text with one set per line, the check
on the way back in, and the words after Back up and Restore); `checkedSet`/`checkedSets`, `mergeSets` and `keepNewest`
in `sets.ts` (the entry check moved there from `logStorage.ts`, so the saved log and a backup are checked by the same
code; numbers that don't belong to an exercise are left behind, and numbers a newer Amygo adds, like Block 2's `kg`,
travel untouched); `restoreBackup`, `restoreFile`, `backUpLog` and `followOtherWindows` in `logStore.ts`;
`src/lib/files.ts` (the download, and emptying the picker so the same file can be picked twice); the **Your log**
section on the Today page. `saveLog` now says whether it saved, so a restore in a browser that won't keep it says so.
Shell: 14.7 → 16.3 KB (budget 60).

**A review** (3 angles, one skeptic per finding; 9 of 12 findings checked, the 3 left over were acted on anyway) confirmed
5, all low once checked, and the build changed for each:
- **Two windows of Amygo** (the installed app and a Chrome tab share one storage) could write over each other: a stale
  tab finishing one set would have wiped a restore made in the other. Each window now takes the other's saves as they
  happen (`followOtherWindows`, started by `startApp`); V9B1-T8 covers it. The gap was there since v7; restore made it
  costlier.
- **Back up said "Saved"** before the browser had saved anything (and a second backup the same day lands as
  "… (1).json"). It now says "Backing up 48 sets as amygo-log-2026-10-08.json. Look in your downloads; a second backup the
  same day may end in (1)." **Restore now names the backup it read** ("backup made Yesterday, 21:10"), so picking an
  older file by mistake shows.
- **At the 5,000 cap** the counts were taken before the cut, so "Added 30" could mean nothing arrived. They're now taken
  after: "too old to keep" (the file's) and "of the oldest here let go" (this browser's own) are told apart, and a restore
  that changes nothing saves nothing.
- **After a big restore the result line ended up far below the new days**, out of sight; it now scrolls into view, and
  the same result twice is announced again (cleared, then shown a moment later).
- **A test left the time zone broken** for the tests after it (putting back an unset zone wrote the text "undefined",
  which is UTC). Both V9B1-T6 and the older V7B2-T2, which had the same slip, now put the zone back by its name (on
  Windows, removing the setting doesn't bring the old zone back either). T6 borrows Pacific/Auckland, not the laptop's
  own zone, so its last check can tell whether the zone really was put back.
- Left over, acted on: the Back up button's work is now tested with a log of several days, the picker reset is tested,
  and storage that throws on being read at all (Chrome with site data blocked) is covered.

**A second check, of the fixes** (2 reviewers, one skeptic per finding): 2 of 5 findings held, both in the tests. The
Block 1 tests reload the app's code several times each and could pass Vitest's 5-second limit when the laptop is busy
(it happened once in a full run while other work was going on), so they now allow 30 seconds, as the repo's other slow
tests do, and a test backup file is made without loading an app at all. And T6's zone check couldn't fail on this
laptop (see the time zone point above).

**Red-checks:** 42 deliberate breaks, one at a time (39, then 3 more for the reworked T6); every one made a test fail.
(One run also failed the older V7B3-T1 once; run alone, twice, it passed: the first test in that file loads the whole
app and timed out under the load of the run, not because of the break.)

**Checked in the browser** (dev server, 360 px wide): Back up made `amygo-log-2026-10-08.json` with every set; after Clear
history, Restore brought 60 sets back onto 30 days and scrolled the result into view; the same file again said "Added 0
sets · 60 already here"; a file that isn't a backup was refused with nothing changed; a second tab, never reloaded,
followed the first tab's Clear history and restore, and its own Remove kept the restored sets. No console errors.

**Your phone check (optional):** at the laptop's Wi-Fi address (this branch's dev server running), Back up; Chrome may
warn about a download on a plain http address, so choose Download or Keep. Then at amygo.vercel.app (once this block is
pushed), Today → Restore → pick the file: the old days appear under Earlier.

### Block 2: Weights in kg

**What you'll see** (as built): on the Exercises list, every strength row (per D6) has a small **− 10 kg +** stepper
beside Start, and a line under the title says what the number means (each dumbbell, the stack on a machine, the bar with
its plates). On a phone such a row takes two lines: the name with History, then the weight and Start together. It
remembers your last weight for that exercise; where you haven't picked one in this browser it starts from the weight of
that exercise's last logged set (so a restored log brings its weights along), and only the very first time from the
minimum. Start, and the popup in the gym says "Doing bicep curls · 10 kg". The saved set reads "12 reps · 10 kg", the
day summary "Bicep curls 3 × 12 @ 10 kg", and an exercise's History marks the heaviest set as best and has the same
picker by its own Start. Old sets without a weight still show as they do today.

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

**Status: done** (built and committed 2026-10-14 on branch `v9-log-you-keep`). 158 tests passing (8 new: V9B2-T1..T8;
V9B1-T1 and V7B3-T5 updated, see below). **Built:** the `load` table in `catalog.ts` (11 exercises; none for cardio or
pull-ups); `src/exercises/load.ts` (steps, range, "10 kg"); `src/exercises/weights.ts` (the picks, saved as
`gym3d.weights` and checked on the way back in); `kg` on `Activity`, set where every start goes through, so the list
and the menu at the machine agree, and copied onto the saved set; the weight in the popup, the header, each set and the
day summary; `bestSet` by weight, then reps; `src/shell/WeightStepper.tsx` on the Exercises rows and by Start on an
exercise's own page. The log version is still 1, and old logs and Block 1 backups load unchanged. Shell: 16.3 → 17.3 KB
(budget 60; this plan's guess of "under 17" was a little low, mostly because Block 1 came out bigger than guessed).

**Changed from this plan:**
- **A row with no weight picked starts from its last logged set's weight, and only then from its minimum.** The plan
  said "starts at its minimum". But after a restore into another browser (Block 1's whole point) the row read "Last: 10
  reps · 12 kg" beside "− 1 kg +", and one tap on Start would have saved 1 kg. The log now tells the picker each
  exercise's latest weight (at the start and on every change); it isn't saved as a pick, it's read from the log each
  time. A weight you pick here still wins.
- **On a phone the row takes two lines** (the name with History; the weight and Start together beneath), and **an
  exercise's own page has the picker too**, since its Start uses the same weight.
- **A line says what the number means**, on the list and by the picker on an exercise's page ("Weight: each dumbbell").
- **V7B3-T5's expected text changed** from "12 reps" to "12 reps · 1 kg": a dumbbell row nobody has touched is at its
  1 kg minimum, and the set says so.

**Kept as the plan says, for you to confirm:** an exercise never done and never picked still saves its minimum (1 kg
dumbbells, 5 kg stack, 20 kg bar) as the set's weight, as D7 has it; the stepper shows that number before Start, but
from the menu at the machine you only see it once the set is running. And reaching a working weight the first time is
one tap per step (20 → 60 kg on the bar is 16 taps); press-and-hold would be a small addition if you want it.

**A review** (3 angles, one skeptic per finding; 18 findings, the 10 most serious checked): 4 held; 6 were turned down,
mostly as "what the plan says" (some acted on anyway: the last logged weight above, a redraw test, the exercise page's
layout); and the 8 unchecked were read and acted on where they named a real gap:
- **The phone row fitted at 360 px by a tenth of a pixel** (so on some fonts Start dropped alone onto a third line), and
  the wrapping had also loosened rows without a picker. Now it's a deliberate layout (above), checked at 320, 360 and
  412 px with heavier fonts forced; rows without a picker are laid out exactly as before.
- **Weights weren't shared between two windows of Amygo**, and a stale window's next pick wrote over the other's. Each
  window now takes the other's picks as they happen (`followWeights`, started by `startApp`), as Block 1 did for the log.
- **"12, 10 @ 12 kg" read the same whether one set or both had the weight.** A set with no weight beside ones that have
  one now says so: "12 (no weight), 10 @ 12 kg".
- **Eleven numbers would likely have been read out when the page opens** (each was a status line). The numbers are plain
  text now, and one line reads a change out by name: "Bicep curls 11 kg".
- Test gaps closed: a pick must tell the stepper to redraw; the weight must survive stepping onto a machine (9 of the 11
  exercises start that way in the gym); the exercise page's picker and caption are checked exactly; and Block 1's
  "numbers a newer Amygo adds travel untouched" test uses a number no version knows, now that `kg` is a known one.

**A second check, of the fixes** (2 reviewers, one skeptic per finding): 3 of 7 held. Two were one gap (a line in T8
claimed to check an unpicked row after Clear history but couldn't fail; T8 now follows such a row through Remove, Clear
history and a restore made in another window). The third: the locked stepper on a row being done could show a number
the set wasn't using, if the log or another window changed meanwhile. It now shows the weight the set started with.

**Red-checks:** 69 deliberate breaks, one at a time; every one made a test fail. (The first run caught 64 of 66. One
miss was a real gap: saved weights for exercises that take none were kept and written back, and T3 now checks only
valid picks are saved. The other break turned out to change nothing, so it was replaced by one that does.)

**Checked in the browser** (dev server): at 360 px each strength row is two lines and nothing runs off the side; 11 taps
took Bicep curls from 1 to 12 kg; Start showed "Doing bicep curls · 12 kg" on the card and in the header, with the row
locked; the set read "2 reps · 12 kg", and 12 kg was still there after a reload; one rep at 14 kg became Best over two
at 12; with a log holding weights and nothing picked, the rows started from the log; a second tab followed the first
tab's pick without a reload, and its own pick was saved on top. The popup over the person in the gym couldn't be seen in
the test pane (it draws no frames while hidden); it uses the same words as the header, and a test renders it directly.

**Found on the way, not part of this block:** finishing an exercise from the Exercises list logs an uncaught
`removeChild` error from the popup's own removal. It happens on the live site too (it predates v9) and the app carries
on; proposed as its own piece of work.

**Your phone check (optional):** on Exercises, tap + on Bicep curls up to your weight, Start, do a few reps, Finish:
Today shows "N reps · your kg", the row still shows it after closing and reopening the app, and Back squat's History
marks your heaviest set as Best.

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
