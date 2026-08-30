const DB_NAME = 'joaoguirunas-tts-cache';
const STORE = 'audio';
const DB_VERSION = 1;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 50;

export interface CachedAudio {
  key: string;
  url: string;
  createdAt: number;
  textPreview: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

export async function ttsCacheGet(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const entry: CachedAudio | undefined = req.result;
        if (!entry) return resolve(null);
        if (Date.now() - entry.createdAt > TTL_MS) return resolve(null);
        resolve(entry.url);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function ttsCacheSet(key: string, url: string, textPreview: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);

      const countReq = store.count();
      countReq.onsuccess = () => {
        const evictThenInsert = () => {
          const entry: CachedAudio = { key, url, createdAt: Date.now(), textPreview: textPreview.slice(0, 80) };
          store.put(entry);
        };

        if (countReq.result >= MAX_ENTRIES) {
          const idx = store.index('createdAt');
          const cursorReq = idx.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              store.delete(cursor.primaryKey);
            }
            evictThenInsert();
          };
          cursorReq.onerror = () => evictThenInsert();
        } else {
          evictThenInsert();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // silent degradation — IndexedDB unavailable (private browsing, quota)
  }
}

export async function ttsCacheClear(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // silent
  }
}

export async function sha256CacheKey(text: string, voiceId: string, modelId: string): Promise<string> {
  const raw = text + '|' + voiceId + '|' + modelId;
  const encoded = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
