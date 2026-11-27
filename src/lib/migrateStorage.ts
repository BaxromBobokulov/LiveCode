// The app used to be called CodeVision, and saved everything in localStorage under "codevision.*" keys.
// It is LiveCode now, and every key uses the "livecode." prefix. This runs once on load, before any store
// reads its saved values (main.tsx imports it first), and moves old values to their new names, so a
// returning student keeps their preferences, badges and solved problems through the rename.
// A "livecode.*" value that is already there wins: it is never overwritten by an old one.

const OLD_PREFIX = 'codevision.'
const NEW_PREFIX = 'livecode.'

export function migrateStorage(storage: Storage) {
  // Collect the keys first: removing items while walking storage.key(i) would skip some.
  const oldKeys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key?.startsWith(OLD_PREFIX)) oldKeys.push(key)
  }
  for (const oldKey of oldKeys) {
    const newKey = NEW_PREFIX + oldKey.slice(OLD_PREFIX.length)
    const value = storage.getItem(oldKey)
    if (value !== null && storage.getItem(newKey) === null) storage.setItem(newKey, value)
    storage.removeItem(oldKey)
  }
}

// localStorage can throw (private mode, blocked site data) or be missing (tests run in Node).
try {
  migrateStorage(localStorage)
} catch {
  // Nothing moved; the app starts with defaults, as on a first visit.
}
