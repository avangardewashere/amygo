# Amygo: going public plan (v8)

Amygo leaves the laptop. Today the phone can open it only over home Wi-Fi, and only while the laptop is serving it
(`npm run phone`). After v8 it lives at a **public https link** (amygo.vercel.app, like Habibit and Sipat). It says
**Amygo** everywhere a person looks, and it greets someone who arrives for the first time. Once it has loaded on a phone it
**keeps working with no signal**, and it **installs** as an Amygo icon on your Android home screen. v8 adds no new machines,
no backend and no new packages, and the app still sends nothing anywhere.

It builds on three things that already exist:

- **v6 Block 3** (`scripts/check-budget.mjs`): the size check at the end of every `npm run build`. Vercel runs the same
  build, so a version that's too heavy or has type errors is refused before it goes live. v8 adds an offline check to it.
- **v7** (`src/log/`): the workout log, kept in this browser. It's what makes Amygo worth carrying into a real gym. It
  never needed a server, so working offline only means keeping a copy of the app's own files.
- **The GitHub repo you pushed today** (github.com/avangardewashere/amygo, public, `master` at `64707a5`). Vercel builds
  straight from it, so the link is one import away.

## How this plan works

Same rules as before:

- **3 features per version, one feature per block.**
- **Each block has a test phase** (Vitest, each test checked to fail when the thing it guards is broken) that must pass
  before the next block starts. The Android check stays **optional** and is never marked passed unless done on the phone.
- **Each block ends with a 1–3 sentence summary.**
- **We stop after every block** and wait for your yes. A yes to this plan is not a yes to start building.
- v8 gets its own branch off `master` (`v8-go-public`). Unlike v7, each finished block is merged when you say so,
  because the phone checks need it on the public link (D8).

Some rules are new in v8, because it's the first version that reaches beyond the laptop:

- **Nothing outward-facing happens by itself.** Each of these steps needs your OK at the moment it happens, even after
  you've said yes to the plan and to the block:
  - **Importing the repo into Vercel.** Vercel is the host that builds the app from GitHub and serves it at the link.
    The import is your own step on vercel.com, with your own account (D2).
  - **Every push to GitHub.** Each push to `master` updates the public link within a minute or two (D8).
- **No downloads.** There are no new npm packages (D6), and the icons are drawn by our own script (D9).
- **The Android checks stay yours and optional:** the link over mobile data (Block 1), airplane mode (Block 2), and
  installing (Block 3). The desktop checks can all be done on the laptop, including DevTools' offline switch.

## Where it sits

v8 comes after v7, which is done, on `master` since 2026-10-07, and checked on your Android phone. The same commit
(`64707a5`) records v5 as complete. v8 adds no 3D work. It touches only two 3D files: the wall's painted name, which will
read the shared name, and the model loader, which gets one "no Draco" flag in Block 2. Everything else is shell code,
build settings and files in `public/`, so the gym runs exactly as fast as before. v8 also closes the oldest backlog
item: a public link has been waiting since v5 (`PLAN-v4-v5.md`, D3: "going online can be its own step later").

## The starting point (measured 2026-10-07)

| Measure | Now |
| --- | --- |
| Tests | 122 passing, in 30 files |
| Shell code (compressed), budget 60 KB | 13.3 KB (end of v7) |
| What a first visit downloads | About 2.1 MB as stored, about 0.65 MB compressed over the network: three.js 1.28 MB, React 219 KB, the gym's code 71 KB, the shell 38 KB, styles 9 KB, the model `man.glb` 493 KB (170 KB compressed) |
| Deployed but never downloaded | `public/models/fitness-character.glb`, 233 KB (the player uses `man.glb`) |
| Name a person sees | "Gym 3D" (the `<title>` in `index.html`, the `<h1>` in `Header.tsx`); AMYGO only on the painted wall (`GYM_NAME` in `src/scene/wallDesign.ts`) |
| Tab icon | `public/favicon.svg`, still Vite's default purple bolt (`#863bff`), 9.5 KB |
| GitHub | `avangardewashere/amygo`, public, `master` = `64707a5`, no deployments when measured (you're importing it into Vercel now, D2) |
| Deploy settings | None: no `vercel.json`, no manifest, no service worker |
| Saved in the browser | `gym3d.layout` (version 2) and `gym3d.log` (version 1), each file with its own copy of the careful `storage()` helper |
| Laptop tools | Node 24.12.0, gh 2.91.0 |

Where the numbers come from:

- **Download sizes:** the last build in the folder (`dist/`, made during v7; the three.js and React files don't change
  between builds) and the files in `public/`.
- **GitHub row:** a read-only `gh api` call.

**Facts from the code that shape this plan:**
- **The phone reaches the laptop over plain http.** `npm run phone` runs `vite preview --host`, which serves an http
  address on your Wi-Fi. Browsers allow installing, and keeping an offline copy (a service worker), only on **https**.
  The one exception is `localhost`, which browsers trust. v7 hit the same wall with `crypto.randomUUID`, so the https
  link has to come first.
- **Each address keeps its own storage.** The browser files saved data under the site's address. The sets your phone
  saved at the laptop's Wi-Fi address stay there, and the public link starts empty (D4).
- **One gate covers every key.** `onHome()` in `src/shell/tabStore.ts` is the only check used by:
  - `src/player/input.ts` (WASD and the arrows)
  - `src/interaction/gymStore.ts` (E, 1–9 and Esc)
  - `src/build/actions.ts` (B and R)

  Teaching `onHome()` about the welcome card switches all of these keys off at once.
- **`npm run build` is already a gate:** it runs `tsc -b && vite build && node scripts/check-budget.mjs`. Because Vercel
  runs it too, a type error or a heavy shell never goes live.
- **Nothing comes from other sites.** There are no web fonts and no CDNs. `man.glb` uses no Draco compression (its header
  lists no extensions), so drei never asks gstatic.com for a decoder. That makes a complete offline copy possible.
- **Vite copies `public/` next to the bundle rather than through it.** So a list of every file in the build can only be
  made after everything is written, by reading `dist/` (Block 2).
- **Windows ignores capital letters in file names; Linux doesn't.** On the laptop, `Header.tsx` and `header.tsx` are the
  same file; on Vercel's Linux machines they are two different files. The lockfile already has the Linux build tools
  Vercel needs: `@rolldown/binding-linux-x64-gnu` 1.2.12 and `lightningcss-linux-x64-gnu` 1.33.0.

## The order, and why

| Block | Feature | What it gives you |
| --- | --- | --- |
| 1 | Amygo online | The app wears its name, greets first-time visitors and goes up at a public https link |
| 2 | Works with no signal | After one visit, the whole app, gym included, opens and saves sets in airplane mode |
| 3 | Install Amygo | An Amygo icon on your Android home screen that opens full screen, offline too |

- **The link first.** Installing and working offline both need https, and the phone can only reach the laptop over plain
  http. Without a public link, Blocks 2 and 3 could never be checked on the Android phone. Once there's a link, strangers
  can arrive, so the name and the welcome go up with it.
- **Offline second.** An installed app that shows "no internet" in a gym basement would be worse than no app. Block 2
  builds on Block 1's link (for the phone check) and on its `vercel.json`, where the fingerprinted files are cached for a
  year. Block 2's file list is made from whatever the build writes, so Block 3's manifest and icons join it by
  themselves, and Block 2's build check proves they did.
- **Install last.** It's the payoff, and it builds on both earlier blocks:
  - the button lives in Block 1's welcome card;
  - the PNG icons come from Block 1's mark;
  - the installed app opens offline thanks to Block 2.

  It also asks the browser to keep Amygo's data, which Chrome only grants once the app is installed.

## Decisions (decided 2026-10-07, all as recommended)

| # | Question | Decision |
| --- | --- | --- |
| D1 | Start v8 **now**? v5, v6 and v7 are complete and checked on your phone (`64707a5`). Nothing earlier is still open. | **Now.** v8 adds no 3D work and stays inside the shell budget. The repo is already public, so the link is one Vercel import away, and v8 makes what it shows worth sharing. |
| D2 | **The Vercel import** is your own step, and you're doing it now (2026-10-07), before v8. Until Block 1 is pushed, the link shows today's app: titled "Gym 3D", with Vite's icon and no welcome. OK? | **Yes.** Use the account Habibit and Sipat use, name the project `amygo` (D3), keep the Vite preset and add no environment variables. Block 1's push then simply updates the link. The website is simpler than Vercel's command-line tool, which would mean a download and a login. |
| D3 | **The address:** a Vercel project named `amygo`, which gives amygo.vercel.app if that name is free. No custom domain. OK? | **Yes.** If `amygo` is taken, use `amygo-gym`. Vercel shows the final address before anyone can open it. A custom domain costs money and would be a purchase needing its own OK, so it's left out. |
| D4 | **Names and saved data.** Everything a person sees says Amygo. The folders (`gym3d`, `gym3d-v6`), the branch names and the storage keys (`gym3d.layout`, `gym3d.log`) stay. Your phone's sets were saved at the laptop's Wi-Fi address, so they stay there, and the public link starts empty. OK? | **Yes.** Renaming the keys would throw away saved data for no visible gain, and renaming a folder would break the second worktree and the other session that works there. Moving the phone's log needs a backup file (export and import), which is the natural next version. |
| D5 | **The welcome:** shown once, on a first visit with nothing saved, with **Pick an exercise** or **Look around**. A **?** in the header reopens it. OK? | **Yes.** A stranger arriving from a link needs about four lines: what this is, how to walk, how to start an exercise, and where their data goes. Returning visitors (anything saved) skip it. A step-by-step tour would weigh more and get skipped anyway. |
| D6 | **Offline:** write **our own** service worker (about 100 lines, plus a small plugin in `vite.config.ts`), or add **vite-plugin-pwa** (Workbox)? | **Our own.** No new packages means no download. Every line can be explained and tested in Vitest, and the tests already cover what Workbox would hide. If it ever needs more than simple caching, switching later is easy. |
| D7 | **Updates:** show **"A new version of Amygo is ready · Reload"** (never during an exercise, never reloading by itself), or update **silently** the next time the app is fully closed? | **The note.** An installed app on Android is rarely fully closed, so a silent update could wait for days. Hiding the note mid-set protects the set, since a reload loses it. |
| D8 | **How blocks reach the link.** After its test phase and your yes, each block is fast-forwarded into `master` and pushed, with your OK at that moment. Vercel deploys `master` to the link. A branch can also be pushed for a private preview link, which asks for your Vercel login. Vercel runs the build (types, size budget, offline list) but not the tests. OK? | **Yes.** The tests run on the laptop before every push, as each test phase already requires; running them on Vercel too would double every deploy's time. **Fast-forward** means `master` simply moves up to the branch's last commit, with no merge commit and no chance to mix in someone else's work. Another session sometimes runs git in the `gym3d` folder, where `master` is checked out, so the merge goes in this order:<br>1. One command shows the current branch, that the folder is clean, and the last reflog lines.<br>2. Fast-forward `master`.<br>3. Run the tests again in that folder (its files have Windows line endings, which tripped a v7 test).<br>4. Push.<br>Push Block 2, the riskiest block, only after its desktop offline check. |
| D9 | **The icon:** an A whose crossbar is a dumbbell, in Amygo orange (`#e4572e`, the colour of the wall stripe, the painted name, the header's "Doing…" line and the open tab) on the app's dark `#111214`. It is built only from straight-edged shapes and circles, so our own script can draw it at every size. OK? | **Yes.** It reads at 16 px in a browser tab and fits Android's icon shapes. Keeping to simple shapes means no design tool or image converter to download. |
| D10 | **Visitor counting** (Vercel Analytics or similar)? | **None.** "Nothing is sent anywhere" stays true, and the welcome card says so. Vercel's own hosting logs exist regardless, but the app itself sends nothing. |

---

## v8: Amygo goes public

### Block 1: Amygo online (its name, a welcome, and a public link)

**What you'll see:** the header and the browser tab both say **Amygo**. The tab icon is Amygo's own mark (D9) instead of
Vite's purple lightning bolt. On a first visit, a welcome card sits over the gym. It tells you:
- what Amygo is;
- how to walk;
- how to start an exercise;
- that your sets stay on this device and nothing is sent anywhere.

It has two buttons: **Pick an exercise** opens Exercises, and **Look around** closes the card. A **?** in the header
brings the card back. People who already have saved sets or a moved piece of furniture never see it unless they ask, so
your own browser won't show it. Once you OK the push, the link from your Vercel import (D2), e.g. https://amygo.vercel.app,
shows this version on any phone, on mobile data, anywhere.

**How:**
- **One name, kept in one place.** A new `src/shell/brand.ts` holds `APP_NAME = 'Amygo'` and a one-line
  `APP_DESCRIPTION`. Everything else reads from it:
  - `Header.tsx` uses it in place of the hard-coded "Gym 3D" in its `<h1>`.
  - `GYM_NAME` in `src/scene/wallDesign.ts` becomes `APP_NAME.toUpperCase()`, so the painted wall and the header can't
    disagree.
  - `index.html` gets `<title>Amygo</title>` and a `<meta name="description">`; a test keeps both equal to `brand.ts`.
  - The `name` in `package.json` becomes `amygo`. The two matching lines at the top of `package-lock.json` are changed
    by hand, so no install is needed.
  - The README's heading becomes Amygo, with the link under it.
- **What stays "gym3d" (D4):** the folder names, the branch names, and the storage keys `gym3d.layout` and `gym3d.log`,
  which hold saved data.
- **One storage helper instead of three copies.** The careful `storage()` function is currently copied in
  `src/build/layoutStorage.ts` and `src/log/logStorage.ts`. Before the welcome adds a third user, it moves to
  `src/lib/storage.ts` and both files import it. The existing v5 and v7 storage tests guard the move.
- **The mark.** `scripts/brand-mark.mjs` describes it as a short list of shapes: straight-edged polygons and circles
  (D9). `scripts/make-icons.mjs` turns those shapes into `public/favicon.svg`. You run it by hand and the output is
  committed. In Block 3 the same script also draws the PNG icons.
- **The welcome card.** A new `src/shell/Welcome.tsx` is a `role="dialog"` card with a heading, four short lines and the
  two buttons.
  - The card sits on a dim layer over the gym, so taps and drags can't reach the gym; it keeps drawing behind. Tab
    can't reach the gym either: the gym is made `inert` behind the card, the same way the Exercises list is behind a
    History page.
  - Whether the card is open lives in `src/shell/tabStore.ts`. `onHome()` becomes "Home is in front **and** the welcome
    is closed", which switches off every key at once (see the facts above).
  - `App.tsx` also hides the Joystick and the build bar while the card is open.
  - Escape closes it and puts focus back on **?**. Switching tabs also closes it, and that counts as seen.
- **Who sees it.** A new `src/shell/firstVisit.ts` holds the rule. It isn't named `welcome.ts`: imports leave out the
  extension, and Windows ignores capital letters, so `import … from './welcome'` could pick up `Welcome.tsx` on the
  laptop but not on Vercel's Linux machines.
  - A first visit means there's no `gym3d.welcomed` flag and nothing saved under `LAYOUT_KEY` or `LOG_KEY`.
  - `startApp()` in `src/shell/startup.ts` opens the card before the first draw, and closing it saves the flag.
  - If storage is blocked, the card shows on every visit and still closes.
- **Deploy settings.** A new `vercel.json` sets the framework to `vite`, the build command to `npm run build` and the
  output folder to `dist`. Because the build ends with the budget check, Vercel refuses a deploy with type errors or an
  over-budget shell.
  - A **cache header** is an instruction sent with each file that says how long the browser may reuse its copy.
  - The files in `/assets/` have a fingerprint of their contents in their names (`three-DuL8FNxD.js`), so a changed file
    always gets a new name. These get `Cache-Control: public, max-age=31536000, immutable`: keep for a year, never
    re-check.
  - `index.html` keeps Vercel's default (check every time), so a new version is seen straight away.
- **Node version and secrets.** `package.json` gains `"engines": { "node": "24.x" }`, matching the laptop's Node 24.12,
  so Vercel builds with the same major version. There are no environment variables and nothing secret, so the
  environment-variable trouble Habibit v3 had on Vercel can't happen here.
- **Going live.** Each of these steps needs your OK at that moment. After the test phase and your yes, `v8-go-public` is
  fast-forwarded into `master`, and `git push origin master` sends it to GitHub (D8). Once the repo is imported into
  Vercel (D2), that push is what puts Block 1 on the link. Vercel shows the build log and the final address.

**Tests:**

| ID | Checks |
| --- | --- |
| V8B1-T1 | The header, the page title and the wall's painted name all come from `APP_NAME` (Amygo, and AMYGO on the wall). No page a person sees (`index.html`, the files in `src/shell/`) still says "Gym 3D". The storage keys are still `gym3d.layout` and `gym3d.log` |
| V8B1-T2 | The welcome opens on a first visit. It doesn't open when a log or a layout is already saved; a frozen v7-shaped log and layout are used here, and they still load unchanged. Once closed, it doesn't come back, even after a reload. With blocked storage it still opens and closes, and nothing throws |
| V8B1-T3 | While the welcome is open, W doesn't walk, E opens no menu, B doesn't start build mode, and the joystick and build bar aren't rendered. After closing, all of them work again |
| V8B1-T4 | Pick an exercise closes the welcome and opens Exercises. The header's **?** reopens it on Home. Escape closes it and puts focus back on **?**. Switching tabs closes it |
| V8B1-T5 | `vercel.json` builds with `npm run build` (which ends with `check-budget.mjs`) into `dist`, the folder Vite writes. Only `/assets/` files are cached for a year; `index.html` isn't |
| V8B1-T6 | The Linux traps: every relative import and every public file the code asks for (`models/man.glb`, `favicon.svg`) exists with exactly that spelling, capitals included. `package-lock.json` includes `@rolldown/binding-linux-x64-gnu` and `lightningcss-linux-x64-gnu` |
| V8B1-T7 | `favicon.svg` is exactly what `brand-mark.mjs` makes, contains nothing of Vite's default logo (`#863bff`) and is under 2 KB. The shell stays under its 60 KB budget |

**Visual check:**
1. On the laptop, open the app in a private window, which starts with empty storage. The header and tab say Amygo with
   the new icon, and the welcome shows.
2. Pick an exercise goes to Exercises. A reload doesn't bring the welcome back, and **?** does.
3. Your normal browser, which has saved sets, never shows the welcome unless you ask.
4. At phone width (360 px) the card fits without scrolling sideways.
5. After the push (with your OK) and the Vercel import (D2), Vercel's build log ends with "Size budget: OK", and the link
   opens on the desktop.
6. Optional, on Android over mobile data: the welcome shows (a new address counts as a first visit, D4), and a set of
   curls lands in Today. If you like, add `?perf` to the address and note the frames per second and draws, since v5's
   phone check took no numbers.

**What could go wrong:**
- **The address may be taken.** Vercel then uses the D3 fallback, and shows it before anything is public.
- **Laptop vs Linux.** T6 guards the two known traps, but Vercel's first real build is the true test. If it fails,
  nothing breaks: Vercel only switches the link to a build that succeeded, and its log says why.
- **Your phone's sets stay behind** at the laptop's Wi-Fi address (D4) until a backup file exists.
- **Public means public.** The repo already is: its code, plans, and commit author names and emails. Nothing in it is
  secret (no keys, no `.env`). The link adds the running app.

**Status: done** (2026-10-07, on branch `v8-go-public`; not yet pushed). 129 tests passing (7 new: V8B1-T1..T7), each
checked to fail when the behaviour it guards is broken (25 breaks tried, all caught). **The link:** you imported the repo
into Vercel before this block, and https://amygo.vercel.app went live serving `master` at `64707a5`. I opened it: https,
the gym and all three tabs load, no console errors, and its files carry the same fingerprints as the laptop's build (so
Vercel's Linux build matched). It still says "Gym 3D" until this block is pushed. **Built:** `src/shell/brand.ts` (the
name), `src/lib/storage.ts` (the one storage helper), `src/shell/firstVisit.ts`, `src/shell/Welcome.tsx`, the welcome's
open/close/Escape in `src/shell/tabs.ts`, `vercel.json`, `"engines": { "node": "24.x" }`, the name `amygo` in both
package files, `scripts/brand-mark.mjs` + `scripts/make-icons.mjs` (the new `favicon.svg` is 628 bytes, down from Vite's
9.5 KB; `--check` mode is what T7 runs), and the README's links. Shell: 13.3 → 13.9 KB compressed (budget 60).

**A multi-agent review** (5 angles, each finding checked by 2 skeptics trying to disprove it; 31 agents) confirmed 9
findings and split on 1. All acted on:
- **Escape that closed the card also stopped your exercise** (found from 4 angles, reproduced by a skeptic): the card's
  listener closed it first, so the gym's own Escape listener saw "nothing over the gym" and took the same key press as
  "stop". The card's Escape now runs first and goes no further; T4 starts a set, opens "?", presses Escape and checks the
  set is still running (and the same with an item's menu open).
- **A key held while the card opened** came back on the next key release, so the person walked behind the card. Opening
  the card (or leaving Home) now lets go of the held keys themselves (`releaseKeys()` in `src/player/input.ts`).
- **The lockfile lacked the new Node-version entry,** so the next `npm install` would quietly have changed it. Added
  exactly what npm writes (checked by running npm in a scratch copy); T5 keeps the two files in step.
- **"Tap a machine" was wrong on phones**: you walk up to a machine and tap its label. The card and the header's phone
  hint now say so.
- **In landscape the card opened scrolled past its own title.** Focus now goes to the title without scrolling.
- **Test gaps:** T3 now presses B after the card closes; T6 checks the files the app asks for folder by folder (a
  skeptic showed `Models/man.glb` would pass on Windows and fail as a 404 on Vercel).

**Changed from this plan:** focus on opening goes to the card's title (not "Pick an exercise"), for the landscape fix
above and so screen readers read the card from the top. The README links both the live app and the code. **Found
while red-checking:** an import spelt with the wrong capitals (`TabStore` for `tabStore`) still works on Windows, but
Vite then loads two separate copies of that file, so the app quietly gets two tab stores; T6 is what catches it.
**Checked in the browser:** a first visit at 360 px (the card fits, no sideways scroll, the gym inert and its joystick and
Build button gone); Pick an exercise opened Exercises and was remembered after a reload; "?" reopened the card and
Escape closed it with focus back on "?"; at 740 × 360 the card opened at its top; mid-curl, "?" then Escape kept the
curls counting. The icon reads at 16 px (an orange A) and shows its dumbbell from 32 px, on light and dark tab bars. No
console errors. The optional Android check waits for the push.

**Summary:** Amygo now says its own name everywhere, with its own icon, greets a first-time visitor with a short card, and
carries the settings Vercel needs; once pushed, the public link shows all of it.

### Block 2: Works with no signal

**What you'll see:** nothing changes while you have signal. Once Amygo has loaded on a device, turn on airplane mode (or
walk into a gym basement) and reload. The header, the tabs, Today, the History pages and the 3D gym all still open, and
sets save and list as usual, because the log always lived in this browser. When a new version has been deployed, a small
bar above the tabs says **"A new version of Amygo is ready · Reload"**. It never shows while you're mid-exercise, and Amygo
never reloads by itself.

**How:**
- **What a service worker is:** a small script the browser keeps alongside a site. Once installed, it sees every request
  the page makes and can answer it from a copy it saved earlier, with or without a network. Browsers allow one only on
  https or `localhost`.
- **Ours** is `src/offline/sw.js`, about 100 lines of plain JavaScript with no imports. It has three jobs:
  - *install:* copy every file on the list into a cache named `amygo-<version>`, all or nothing;
  - *activate:* delete older `amygo-` caches and take charge of the open page;
  - *fetch:* handle only same-site GET requests:
    - The page (`/`, with or without `?perf`) comes from the copy, so it opens at once even on weak signal.
    - The `assets/` files, `models/man.glb` and the icon also come from the copy first.
    - Everything else goes to the network untouched.
- **The list.** A small plugin, `offline()`, in `vite.config.ts`:
  - It waits until every file is written (Vite's `writeBundle` step), then reads `dist`. It can't do this earlier,
    because Vite copies `public/` next to the bundle rather than through it.
  - A pure function in `src/offline/precache.ts` chooses the files: `index.html` (as `/`), every `assets/` file,
    `models/man.glb` and the icon. It leaves out `models/fitness-character.glb` (unused) and `sw.js` itself.
  - The version is a short fingerprint of the contents of every listed file (Node's own `crypto`). Any change, a new
    `man.glb` included, makes a new version.
  - The plugin writes `dist/sw.js`: the list, the version, then the worker. No new packages (D6).
- **The build checks the list.** `scripts/check-budget.mjs` gains an "Offline list" section: every listed file must exist
  in `dist`, and every file the app can ask for must be listed. So `npm run build`, on the laptop and on Vercel, refuses
  a deploy whose offline copy would have holes.
- **Registering.** A new `src/offline/register.ts` is called from `startApp()`.
  - It registers the worker only in a production build, only when `window.isSecureContext` is true (https or
    localhost), and only where `navigator.serviceWorker` exists.
  - It runs inside try/catch. The decision is a pure function the tests call with each case.
  - It waits until the gym has arrived (the lazy `GymScene` import in `App.tsx`). The copy can then come from the
    browser's own cache, thanks to Block 1's year-long header, instead of downloading three.js a second time over
    mobile data.
  - `man.glb` has no fingerprint, so it keeps Vercel's check-first caching. A second request for it costs a short "not
    changed" reply, not the whole file.
- **Updates (D7).** Any deploy that changes a file also changes `sw.js`. The browser then installs the new worker next to
  the old one, where it waits.
  - `register.ts` notices and sets a flag. A new `src/shell/UpdateNote.tsx`, above the TabBar, shows the note only when
    `useGym` has no activity, because a reload mid-set loses that set (v7's known limit).
  - Reload posts `SKIP_WAITING` to the new worker, which takes over, and the page reloads once on `controllerchange`.
  - The very first install also takes charge, so offline works from the first visit, and that fires the same event. The
    page reloads only if you pressed Reload.
  - `vercel.json` gives `/sw.js` `Cache-Control: no-cache`, so phones notice a deploy.
- **Nothing from other sites.** Every `useGLTF` call says "no Draco" (`useGLTF(url, false)`): `HumanPerson.tsx`, the
  two `useGLTF.preload` lines in `Player.tsx`, and the unused `FitnessCharacter.tsx`, all in `src/player/`. Then a future
  model can't quietly add a download from gstatic.com that the offline copy can't hold.
- **An escape hatch, ready before it's needed.** `src/offline/sw-remove.js` is a worker that deletes Amygo's caches and
  unregisters itself. It's never deployed unless a phone gets stuck on an old version. If that happens, one line in
  `vite.config.ts` makes the plugin send it out as `sw.js` for one deploy (with your OK for that push).
- **The tests.**
  - They build into their own git-ignored folder (`--outDir dist-offline`, added to `.gitignore`), so they never collide
    with `src/shell/loading.test.ts` building `dist` at the same moment.
  - They run `sw.js` in `node:vm` (Node's sealed-off box for running a script) with pretend `caches`, `fetch` and `self`.

**Tests:**

| ID | Checks |
| --- | --- |
| V8B2-T1 | After a build, `sw.js`'s list holds every file the app can ask for (`/`, every `assets/` file, `models/man.glb`, `favicon.svg`) and only files that exist. `sw.js` and `fitness-character.glb` are not on it |
| V8B2-T2 | Installing (`sw.js` in `node:vm` with a pretend cache) stores every listed file under `amygo-<version>`. If one download fails, the whole install fails, so a half-filled copy never goes live |
| V8B2-T3 | With the network down, `/`, `/?perf`, a fingerprinted `assets/` file and `man.glb` are answered from the cache. A request to another site, and a POST, pass through untouched |
| V8B2-T4 | The version changes when any listed file's contents change, and stays the same otherwise. Activating deletes older `amygo-` caches and leaves the current one and any other caches alone. The escape-hatch worker deletes only `amygo-` caches and unregisters itself |
| V8B2-T5 | The worker is registered only in a built app, on https or localhost, where it's supported, and only after the gym has arrived. It is never registered in `npm run dev` or over plain http (`npm run phone`), and registering never throws |
| V8B2-T6 | The update note appears when a new version is waiting, and stays hidden while an exercise is on. Reload sends `SKIP_WAITING` and reloads exactly once, and the first install never reloads the page. `vercel.json` gives `sw.js` `no-cache`. A frozen v7-shaped log and layout are exactly the same after an update |
| V8B2-T7 | `check-budget.mjs` fails when the offline list misses a file or names one that doesn't exist. `man.glb` uses no Draco compression, and every `useGLTF` call asks for none. The shell stays under 60 KB |

**Visual check:**
1. On the desktop, run `npm run build` and then `npm run preview`, and open http://localhost:4173 in Chrome. `localhost`
   counts as secure.
2. Wait for the gym. DevTools → Application → Service workers lists Amygo's worker, and Cache storage holds about 2 MB
   under `amygo-…`.
3. Tick Network → Offline and reload. The gym, Exercises, Today and a History page all open. Do a set of curls, and
   Today lists it.
4. Untick Offline. Change one word, build again and reload. The update note appears (but not while curling), and Reload
   brings in the new word.
5. After the merge and push, with your OK at that moment: optionally, on Android at the public link, load once, turn on
   airplane mode and reload.

**What could go wrong:**
- **A stuck old version.** This is the classic service-worker trap: a phone keeps showing an old version. The guards are
  caches named by version, `sw.js` never cached, the update note, and the ready-made escape hatch.
- **The first visit stores about 2.1 MB on the phone,** about 0.65 MB over the network when compressed. Block 1's
  year-long header means it isn't downloaded twice.
- **No worker in `npm run dev` or over plain http.** Offline can only be tried on a build, and `npm run phone` never gets
  the worker at all. That's why Block 1 comes first.
- **The tests are a simulation** with pretend caches. The real proof is the DevTools offline check and the phone.

**Status: done** (2026-10-07, on branch `v8-go-public`; not yet pushed). 136 tests passing (7 new: V8B2-T1..T7). **Built:**
`src/offline/sw.js` (the worker), `src/offline/sw-remove.js` (the escape hatch), `src/offline/precache.ts` (what's kept,
and the version), `src/offline/register.ts` (registering, and noticing updates), `src/shell/UpdateNote.tsx`, the
`offline()` plugin in `vite.config.ts`, the "Offline list" section of `scripts/check-budget.mjs`, `/sw.js` no-cache in
`vercel.json`, and "no Draco" on every `useGLTF`. **Changed from this plan:** the kept list is "every file the build
writes, except the worker and the unused model" (not a named list), so Block 3's manifest and icons join by themselves;
the plugin runs at `writeBundle`, so a failed build shows its own error.

**The real desktop check passed.** The production build served on `localhost`; the worker registered once the gym had
arrived, took charge of the page, and kept all 9 files. Then **the server was stopped entirely** (stricter than DevTools'
offline switch): reload, the whole app opened with the gym, a set of curls counted, and Finish saved it to Today. Then an
update: one word changed and rebuilt; the open app showed "A new version of Amygo is ready · Reload", hid it during a
set, and Reload switched versions once, deleted the old copy and kept the saved set.

**Found on the way: the tests' builds were development builds.** Vitest sets `NODE_ENV=test`, and the builds the tests
start (the size check's and the offline tests') inherited it, so they weren't what Vercel ships (where the worker,
rightly, never registers). They now build with `NODE_ENV=production`, and a test checks the result is a production build.
A timing check (V7B2-T6) now takes the best of five runs: the code takes 3–10 ms; one run had caught a 96 ms pause.

**A multi-agent review** (5 angles, 2 skeptics per finding) was cut short by the account's monthly spending limit: the
worker, update-lifecycle and build reviewers finished; the test-strength and plan/UX reviewers did not run, and most
skeptics did not run either. Acted on:
- **Confirmed, reproduced in real Chromium: a newer version could go live with an empty offline copy.** If an older
  waiting version took over while a newer one was still storing its files, it deleted the newer one's copy; the newer
  one then went live with nothing kept (offline: Chrome's error page). The install now checks its copy still exists and
  fails otherwise, so the browser installs it again later. T2 reproduces the race.
- **Confirmed: the install downloaded three.js and the model a second time.** The app's fingerprinted files now come from
  the browser's own cache; the page, the model and the icon are checked with the site (a short reply when unchanged).
- **Confirmed: with two Amygo windows, the second one's Reload did nothing, and a reload could come later by itself,
  mid-exercise.** Reload now just reloads when the new version has already taken over. T6 covers it.
- **Unverified, fixed anyway:** the plugin ran even after a failed build, hiding Vercel's real error (now
  `writeBundle`: a broken import shows "Could not resolve…"); the test's temporary build copies weren't ignored by git.
- **Unverified, not acted on:** "after a broken deploy, a plain reload doesn't pick up the fix until every Amygo window is
  closed". True of service workers generally; the update note and the escape hatch are the plan's answer, and changing
  how navigations are answered is a bigger, riskier change than this block should make without a full review.

The optional Android check (airplane mode on the public link) waits for the push.

**Summary:** After one visit, Amygo opens and saves sets with no signal, and a new version announces itself with a note
that never interrupts a set; every build refuses to finish if the offline copy would have holes.

### Block 3: Install Amygo

**What you'll see:** at the public link, in Chrome on Android (and on desktop Chrome), the welcome card gains an
**Install Amygo** button; it's the same card **?** opens. Tap it and Android's own install sheet appears, and then the
Amygo icon is on your home screen. Opening it shows a dark splash with the icon and the name, then Amygo full screen with
no address bar. Thanks to Block 2, it opens in airplane mode too. Some browsers don't offer installing (Firefox, iOS
Safari, or Chrome before it's ready). There the card says "Add Amygo to your home screen from your browser's menu"
instead. Once installed, Amygo quietly asks the browser to keep its data, so Android won't clear your log when the phone
runs low on space.

**How:**
- **The manifest.** A **web app manifest** is a small file that tells the phone an app's name, icons and colours; it's
  what makes a site installable. A new `public/manifest.webmanifest` holds:
  - `id` and `start_url` set to `/`, and `scope` set to `/`;
  - `name` and `short_name` set to Amygo, and the description from `brand.ts` (a test keeps them equal);
  - `display: standalone`, meaning its own window with no address bar;
  - `background_color` and `theme_color` set to `#111214`. That's the same dark as `:root` in `src/index.css` and as
    `<meta name="theme-color">` in `index.html`, so the splash matches the app.

  `index.html` gains `<link rel="manifest">` and `<link rel="apple-touch-icon">`.
- **Icons.** `scripts/make-icons.mjs` (Block 1) also draws the mark from `scripts/brand-mark.mjs` into pixels:
  - It writes `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png` and `apple-touch-icon-180.png`.
  - **Maskable** means Android may cut the icon into a circle or a rounded square, so the mark stays inside the middle
    80%.
  - A PNG is a header, compressed rows of pixels and checksums. Node's built-in `zlib` does both the compressing and the
    checksums, so there are no image tools to download.
  - The PNGs are committed. Block 2's list picks them and the manifest up by itself, and its build check proves it.
- **The Install button.** A new `src/shell/install.ts` is started from `startApp()`. It starts there because Chrome can
  announce "this can be installed" (`beforeinstallprompt`) before React has drawn anything.
  - It keeps that announcement (`preventDefault()`) in a tiny store, and `installApp()` calls its `prompt()`, which
    opens Android's sheet.
  - The button disappears on `appinstalled`. It never shows when `matchMedia('(display-mode: standalone)')` says this is
    already the installed app.
  - `src/shell/Welcome.tsx` shows the button, or the menu line where no announcement came.
- **Keeping data.** When running installed, Amygo calls `navigator.storage.persist()` once, and only if `persisted()`
  says it isn't kept yet. Chrome grants this to installed apps without asking you. Where the call is missing or refused,
  nothing changes.
- **The installed app on the phone.** It has no address bar. The existing `env(safe-area-inset-*)` paddings in
  `src/index.css` already clear the notch and the gesture bar. Android's back gesture still closes a History page (v7's
  `listenToBack()` in `src/shell/tabs.ts`). Away from History pages, it leaves the app like any other app.

**Tests:**

| ID | Checks |
| --- | --- |
| V8B3-T1 | The manifest has what Chrome needs to install. Name and short name are Amygo, `start_url` and `scope` are `/`, display is `standalone`, and there are 192 px and 512 px PNG icons plus a maskable one. Its colours equal `index.html`'s theme-color and `index.css`'s background |
| V8B3-T2 | Each PNG really is the size the manifest says: the test reads the file's header and unpacks its compressed rows with `zlib`. The maskable icon keeps the mark inside Android's safe circle, so every pixel outside the middle 80% is the background colour. Each committed PNG is exactly what `make-icons.mjs` makes today |
| V8B3-T3 | `index.html` links the manifest and the apple touch icon. After a build both are in `dist`, and Block 2's offline list includes the manifest and every icon |
| V8B3-T4 | The Install button stays hidden until Chrome offers installing (a pretend `beforeinstallprompt`), then shows. Tapping it calls `prompt()` exactly once. It disappears after `appinstalled`, and never renders when the display mode is standalone |
| V8B3-T5 | Where no install offer arrives, the welcome shows the "from your browser's menu" line instead of a button, and everything else on the card works the same |
| V8B3-T6 | Running as the installed app, Amygo asks the browser to keep its data once, and never asks in a plain browser tab. Nothing throws where `navigator.storage` is missing. The shell stays under budget |

**Visual check:** this block is about Android. The phone check is optional as always, and never marked passed unless done
on your phone.
1. After merging and pushing (with your OK at that moment), open the link in Chrome and tap **Install Amygo**.
2. Look at the icon on the home screen: the A-and-dumbbell mark should be whole, not clipped, in Android's icon shape.
3. Open it. You should see a dark splash with the icon and the name, then the app full screen with no address bar.
4. Open a History page and use the back gesture: it closes the page.
5. Turn on airplane mode, close Amygo, and open it from the icon. The gym and Today work, and a new set saves.

On the desktop, Chrome's install icon in the address bar (or the card's button) opens Amygo in its own window.

**What could go wrong:**
- **Chrome decides when to offer installing.** The offer can come late or not at all (Chrome's own rules, Samsung
  Internet, Firefox), so the button is a bonus. Chrome's menu always works (Install app, or Add to Home screen).
- **Our own PNG writer** could write a broken image. T2 unpacks every icon to catch that, and the phone check catches an
  ugly crop.
- **The browser can refuse to keep the data.** That's harmless: the log stays exactly as safe as it is today.
- **The installed app has no address bar,** so `?perf` only works in a browser tab. iOS gets the apple touch icon but is
  never a required check.

**Status: done** (2026-10-07, on branch `v8-go-public`; not yet pushed). 142 tests passing (6 new: V8B3-T1..T6, with
V8B1-T6/T7 updated). **Built:** `public/manifest.webmanifest`; four PNG icons in `public/icons/` drawn by
`scripts/make-icons.mjs` (its own PNG writer with Node's zlib, each pixel sampled 4 × 4 times; `--check` compares the
decoded pixels, so a different zlib can't make it fail); the manifest and apple-icon links in `index.html`;
`src/shell/install.ts` (Chrome's install offer kept for our button, the install sheet, keeping data once installed),
started by `startApp()`; the Install button or the "browser's menu" line on the welcome card. The offline copy picked
up the manifest and the icons by itself (9 → 14 files), as Block 2 intended. Shell: 14.3 → 14.7 KB (budget 60).

**Caught before it could ship:** a test named Node's `Buffer`, which the app's type settings don't include, so the type
check failed, and with it `npm run build`; Vercel would have refused that deploy (keeping the old version live).

**A review** (3 angles this time, to keep the cost down after Block 2's stop; 2 skeptics per finding; all finished)
confirmed 2 findings and split on 4; all six acted on:
- **Confirmed: on Android the Install button was almost never seen,** and keeping Chrome's offer for it also hid
  Chrome's own install bar. Chrome offers only after a tap and some 30 seconds on the page, by when a new visitor has
  usually closed the welcome card, and later visits never reopen it. **Changed from this plan:** an **Install** button now
  also shows in the header, beside "?", on every tab and every visit, whenever Chrome has offered.
- **Confirmed: the PNG test couldn't catch a broken PNG writer** (a skeptic wrote wrong checksums; Chrome couldn't decode
  the file; the tests passed). T2 now reads each PNG as strictly as a browser: every checksum, the header's fields, the
  end marker, each row.
- **Split, acted on:** after accepting Chrome's install sheet the card said "use your browser's menu" (now it follows
  Chrome's answer, and the line reads "Not installed yet? Use your browser's menu: Install app, or Add to Home screen.");
  only the maskable icon's pixels were checked (the ordinary icons' corners and mark, and the apple icon, now are, with
  numbers worked out in the test, not by the script); every pretend page was a first visit (the installed app is always a
  return visit; T4 and T6 now cover it); a commented-out manifest link passed (T3 now reads the built page without
  comments).

**Checked in the browser** on the production build: the manifest is served as `application/manifest+json`; all four icons
load at their exact sizes; the offline copy keeps the manifest and every icon; the welcome card shows the menu line
(Chrome hadn't offered in the browser pane, as is usual for an embedded browser); with a stand-in offer the Install
button appeared, opened the sheet exactly once, and after "installed" nothing showed. The phone check (installing from
the public link) waits for the push. **This completes v8.**

**Summary:** Amygo installs as an app with its own icon, opening full screen and working offline; the Install button
shows whenever Chrome offers it, and once installed Amygo asks to keep its data. That finishes v8.

---

## Not in this plan

- **A backup file: export and import of the log, with a restore that merges by set id.** It's the only way to bring your
  phone's log over from the laptop's Wi-Fi address to the public link (D4), and it doubles as a backup. Set ids already
  travel with their sets. Suggested as **v9**: once the https link exists, phone downloads no longer get Chrome's
  "insecure download" warning.
- **Weights (kg) and a picker, editing a saved set, and a rest timer.** Weights are the biggest gap in the log; suggested
  after the backup file.
- **Charts, goals, streaks, reminders or push notifications.**
- **Keeping an exercise in progress across a reload.** The update note waits for the set to finish instead.
- **Accounts, sync between devices, saving layouts to an account or sharing them, or any backend.** Still a deliberate
  big step of its own.
- **A custom domain** (for example amygo.app). It costs money, and buying one needs its own OK.
- **A Google Play listing** (an Android package wrapping the web app). It needs a paid Google Play developer account.
- **Visitor counting or analytics** (D10).
- **A link-preview picture** (`og:image`) for when the link is shared in chats, and **home-screen shortcuts**
  (long-press the icon to open Today).
- **Running the tests on Vercel or GitHub Actions.** The tests stay on the laptop before each push (D8).
- **A "you're offline" badge.** The app works the same either way, so there's nothing to warn about yet.
- **Removing `public/models/fitness-character.glb`** (233 KB). It's deployed but never downloaded or kept offline.
- **Duplicate (adding and deleting pieces) in build mode, a bigger or second room, other people in the gym, and new
  machines or exercises.**
- **Shrinking three.js or the model.** After Block 2 they're a one-time download per device, which takes the pressure off.