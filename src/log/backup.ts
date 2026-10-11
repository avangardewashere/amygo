// A backup of the workout log: a file you keep (decisions D2–D4), made and read
// here with no React and no page, so it can be tested on its own. Nothing is
// sent anywhere: the file goes to your downloads and comes back from a file you pick.
import { dayLabel, timeOfDay } from './logText'
import { checkedSets, dayKey, type LoggedSet } from './sets'

export const BACKUP_APP = 'amygo'
export const BACKUP_VERSION = 1
// Thousands of sets come to well under 1 MB; anything this big isn't ours, so it isn't even read
export const MAX_BACKUP_BYTES = 5_000_000

// Named for the day it was made, so backups sort by date in a Downloads folder
export const backupName = (now: number) => `amygo-log-${dayKey(now)}.json`

// The file: what made it, its version, when, and the sets, one per line (so the
// file can be read by eye, and stays small)
export function backupText(sets: LoggedSet[], now: number) {
  const head = JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString() })
  const lines = sets.map((set) => JSON.stringify(set)).join(',\n')
  return `${head.slice(0, -1)},"sets":[\n${lines}\n]}\n`
}

export const NOT_A_BACKUP = "That file isn't an Amygo backup. Nothing was changed."
export const NEWER_BACKUP = 'That backup is from a newer Amygo. Update Amygo (reload it), then try again. Nothing was changed.'
export const TOO_BIG = 'That file is too big to be an Amygo backup. Nothing was changed.'
export const CANT_READ = "That file couldn't be read. Nothing was changed."

export type BackupContents =
  | { ok: true; sets: LoggedSet[]; skipped: number; madeAt: number | null }
  | { ok: false; reason: string }

// A file's text checked before anything is trusted: ours (app and version), and
// each set checked on its own, so damaged entries are skipped and counted. When
// it was made comes along too (shown after a restore, so an older backup picked
// by mistake can be told apart from the newest).
export function readBackup(text: string): BackupContents {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: NOT_A_BACKUP }
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, reason: NOT_A_BACKUP }
  const file = parsed as { app?: unknown; version?: unknown; exportedAt?: unknown; sets?: unknown }
  if (file.app !== BACKUP_APP || !Number.isInteger(file.version) || (file.version as number) < 1 || !Array.isArray(file.sets)) {
    return { ok: false, reason: NOT_A_BACKUP }
  }
  if ((file.version as number) > BACKUP_VERSION) return { ok: false, reason: NEWER_BACKUP }
  const madeAt = typeof file.exportedAt === 'string' ? Date.parse(file.exportedAt) : NaN
  return { ok: true, ...checkedSets(file.sets), madeAt: Number.isFinite(madeAt) ? madeAt : null }
}

// What a finished restore did. Counted after the 5,000 cap: `added` sets are in
// the log now; `tooOld` were the file's, older than every set kept; `dropped`
// were this browser's own oldest, let go to make room.
export type Restored = {
  added: number
  already: number
  skipped: number
  tooOld: number
  dropped: number
  saved: boolean
  madeAt: number | null
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// The line under the buttons after a restore:
// "Added 42 sets · 8 already here · backup made Yesterday, 21:10"
export function restoreText(outcome: Restored | { reason: string }, maxSets: number, now: number) {
  if ('reason' in outcome) return outcome.reason
  const parts = [`Added ${plural(outcome.added, 'set', 'sets')}`, `${outcome.already} already here`]
  if (outcome.skipped) parts.push(`${outcome.skipped} couldn't be read`)
  if (outcome.tooOld) parts.push(`${outcome.tooOld} too old to keep`)
  if (outcome.dropped) parts.push(`${outcome.dropped} of the oldest here let go`)
  if (outcome.tooOld || outcome.dropped) parts.push(`the log keeps ${maxSets.toLocaleString('en')}`)
  if (outcome.madeAt !== null) parts.push(`backup made ${dayLabel(dayKey(outcome.madeAt), now)}, ${timeOfDay(outcome.madeAt)}`)
  const line = parts.join(' · ')
  return outcome.saved ? line : `${line}. This browser isn't saving them: they'll be gone when Amygo closes.`
}

// The line after Back up. The page can't see whether the browser saved the
// file or what it named it (a second copy the same day gets "(1)"), so it says
// what it asked for, not that it's done.
export const backedUpText = (count: number, name: string) =>
  `Backing up ${plural(count, 'set', 'sets')} as ${name}. Look in your downloads; a second backup the same day may end in (1).`
