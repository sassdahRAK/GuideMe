/**
 * AudioCache — High-performance client-side cache for synthesized TTS audio.
 * Caches Audio Blobs in memory and IndexedDB using SHA-256 / MD5 equivalent hashing of text + voice.
 * Prevents redundant HTTP requests to /api/v1/tts and achieves instant playback response.
 */

const DB_NAME = 'guideme_audio_cache_db';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;
const MAX_MEMORY_ENTRIES = 120;

export class AudioCache {
  constructor() {
    /** @type {Map<string, { blob: Blob, mimeType: string, timestamp: number }>} */
    this._memoryCache = new Map();
    this._dbPromise = null;
    this._initDb();
  }

  /**
   * Initializes IndexedDB storage if supported by current environment.
   * @private
   */
  _initDb() {
    if (typeof indexedDB === 'undefined') return;

    this._dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Computes deterministic SHA-256 cache key from text, voice, language, and speed.
   * @param {string} text
   * @param {Object} [options={}]
   * @param {string} [options.voice='']
   * @param {string} [options.lang='km']
   * @param {number|string} [options.rate=1.0]
   * @returns {Promise<string>} Hexadecimal hash string
   */
  async computeKey(text, options = {}) {
    const cleanText = (text || '').trim();
    const voice = options.voice || '';
    const lang = options.lang || options.language || 'km';
    const rate = options.rate || options.speed || '1.0';
    const raw = `${cleanText}::${voice}::${lang}::${rate}`;

    // 1. Standard Web Crypto API (Browser & Node 18+)
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      try {
        const data = new TextEncoder().encode(raw);
        const hashBuf = await crypto.subtle.digest('SHA-256', data);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch {
        // Fallback to polynomial hash
      }
    }

    // 2. Fast polynomial hash fallback
    let h1 = 0xdeadbeef;
    let h2 = 0x41c64e6d;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  /**
   * Retrieves a cached Audio Blob if available.
   * Checks L1 (Memory) first, then L2 (IndexedDB).
   * @param {string} text
   * @param {Object} [options={}]
   * @returns {Promise<Blob|null>}
   */
  async get(text, options = {}) {
    if (!text) return null;
    const key = await this.computeKey(text, options);

    // L1: Memory Cache (0ms latency)
    if (this._memoryCache.has(key)) {
      const entry = this._memoryCache.get(key);
      entry.timestamp = Date.now();
      return entry.blob;
    }

    // L2: IndexedDB
    if (this._dbPromise) {
      try {
        const db = await this._dbPromise;
        if (db) {
          const blob = await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
          });

          if (blob) {
            this._storeMemory(key, blob);
            return blob;
          }
        }
      } catch {
        // Fall through
      }
    }

    return null;
  }

  /**
   * Stores an Audio Blob in memory and IndexedDB.
   * Supports both set(text, blob) and set(text, options, blob).
   * @param {string} text
   * @param {Object|Blob} options
   * @param {Blob} [maybeBlob]
   * @returns {Promise<void>}
   */
  async set(text, options = {}, maybeBlob) {
    let actualOptions = options;
    let actualBlob = maybeBlob;

    // Handle 2-arg signature set(text, blob)
    if (!maybeBlob && options && (typeof options.size === 'number' || (typeof Blob !== 'undefined' && options instanceof Blob))) {
      actualBlob = options;
      actualOptions = {};
    }

    const isValidBlob = actualBlob && (
      (typeof Blob !== 'undefined' && actualBlob instanceof Blob) ||
      (typeof actualBlob.size === 'number')
    );

    if (!text || !isValidBlob) return;
    const key = await this.computeKey(text, actualOptions);

    this._storeMemory(key, actualBlob);

    if (this._dbPromise) {
      try {
        const db = await this._dbPromise;
        if (db) {
          await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(actualBlob, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          });
        }
      } catch {}
    }
  }

  /**
   * Helper to store into memory cache with LRU eviction.
   * @private
   */
  _storeMemory(key, blob) {
    if (this._memoryCache.size >= MAX_MEMORY_ENTRIES) {
      const oldestKey = this._memoryCache.keys().next().value;
      if (oldestKey) this._memoryCache.delete(oldestKey);
    }
    this._memoryCache.set(key, {
      blob,
      mimeType: blob?.type || 'audio/mpeg',
      timestamp: Date.now(),
    });
  }

  /**
   * Clears all cached audio entries from memory and IndexedDB.
   * @returns {Promise<void>}
   */
  async clear() {
    this._memoryCache.clear();
    if (this._dbPromise) {
      try {
        const db = await this._dbPromise;
        if (db) {
          await new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          });
        }
      } catch {}
    }
  }
}

// Global Singleton Cache Instance
export const globalAudioCache = new AudioCache();
