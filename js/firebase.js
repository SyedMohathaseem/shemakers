/* ============================================
   SheMakers — Local Mock Backend (No Firebase)
   ============================================ */

const LOCAL_DB_KEY = 'shemakers_mock_db_v1';
const MOCK_STORAGE_DB = 'shemakers_mock_storage_v1';
const MOCK_STORAGE_STORE = 'files';
const LEGACY_LOCAL_STORAGE_FILES_KEY = 'shemakers_mock_files_v1';

// Remove old large media cache from previous localStorage-based mock storage.
try {
  if (localStorage.getItem(LEGACY_LOCAL_STORAGE_FILES_KEY)) {
    localStorage.removeItem(LEGACY_LOCAL_STORAGE_FILES_KEY);
  }
} catch (e) {
  // Ignore localStorage cleanup errors and continue with IndexedDB mode.
}

function readJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function ensureDatabase() {
  const existing = readJson(LOCAL_DB_KEY, null);
  if (existing && typeof existing === 'object') return existing;
  const initial = { users: {}, products: {} };
  writeJson(LOCAL_DB_KEY, initial);
  return initial;
}

function randomId() {
  return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function toComparableTimestamp(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

function createDocSnapshot(id, data) {
  return {
    id,
    exists: !!data,
    data: () => data
  };
}

function createQuerySnapshot(entries) {
  return {
    empty: entries.length === 0,
    docs: entries.map(([id, value]) => createDocSnapshot(id, value))
  };
}

class LocalDocRef {
  constructor(collectionName, id) {
    this.collectionName = collectionName;
    this.id = id;
  }

  async set(data) {
    const dbData = ensureDatabase();
    if (!dbData[this.collectionName]) dbData[this.collectionName] = {};
    dbData[this.collectionName][this.id] = { ...data };
    writeJson(LOCAL_DB_KEY, dbData);
  }

  async get() {
    const dbData = ensureDatabase();
    const record = dbData[this.collectionName] ? dbData[this.collectionName][this.id] : null;
    return createDocSnapshot(this.id, record || null);
  }

  async update(data) {
    const dbData = ensureDatabase();
    if (!dbData[this.collectionName] || !dbData[this.collectionName][this.id]) {
      throw new Error('Document not found');
    }
    dbData[this.collectionName][this.id] = {
      ...dbData[this.collectionName][this.id],
      ...data
    };
    writeJson(LOCAL_DB_KEY, dbData);
  }

  async delete() {
    const dbData = ensureDatabase();
    if (dbData[this.collectionName]) {
      delete dbData[this.collectionName][this.id];
      writeJson(LOCAL_DB_KEY, dbData);
    }
  }
}

class LocalQuery {
  constructor(collectionName, entries) {
    this.collectionName = collectionName;
    this.entries = entries;
  }

  where(field, operator, value) {
    if (operator !== '==') {
      throw new Error('Only == queries are supported in local mode');
    }
    const filtered = this.entries.filter(([, record]) => record && record[field] === value);
    return new LocalQuery(this.collectionName, filtered);
  }

  orderBy(field, direction = 'asc') {
    const sorted = [...this.entries].sort((a, b) => {
      const av = a[1] ? a[1][field] : null;
      const bv = b[1] ? b[1][field] : null;
      const aScore = toComparableTimestamp(av) || (typeof av === 'number' ? av : 0);
      const bScore = toComparableTimestamp(bv) || (typeof bv === 'number' ? bv : 0);
      return direction === 'desc' ? bScore - aScore : aScore - bScore;
    });
    return new LocalQuery(this.collectionName, sorted);
  }

  async get() {
    return createQuerySnapshot(this.entries);
  }
}

class LocalCollection {
  constructor(name) {
    this.name = name;
  }

  doc(id) {
    return new LocalDocRef(this.name, id || randomId());
  }

  where(field, operator, value) {
    const dbData = ensureDatabase();
    const entries = Object.entries(dbData[this.name] || {});
    return new LocalQuery(this.name, entries).where(field, operator, value);
  }

  orderBy(field, direction = 'asc') {
    const dbData = ensureDatabase();
    const entries = Object.entries(dbData[this.name] || {});
    return new LocalQuery(this.name, entries).orderBy(field, direction);
  }

  async get() {
    const dbData = ensureDatabase();
    const entries = Object.entries(dbData[this.name] || {});
    return createQuerySnapshot(entries);
  }
}

class LocalDB {
  collection(name) {
    return new LocalCollection(name);
  }
}

function openStorageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MOCK_STORAGE_DB, 1);

    request.onupgradeneeded = () => {
      const dbInstance = request.result;
      if (!dbInstance.objectStoreNames.contains(MOCK_STORAGE_STORE)) {
        dbInstance.createObjectStore(MOCK_STORAGE_STORE, { keyPath: 'path' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open mock storage DB'));
  });
}

async function idbPutFile(path, file) {
  const dbInstance = await openStorageDb();
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(MOCK_STORAGE_STORE, 'readwrite');
    const store = tx.objectStore(MOCK_STORAGE_STORE);
    store.put({
      path,
      name: file.name,
      type: file.type,
      blob: file,
      uploadedAt: new Date().toISOString()
    });
    tx.oncomplete = () => {
      dbInstance.close();
      resolve();
    };
    tx.onerror = () => {
      dbInstance.close();
      reject(tx.error || new Error('Unable to store file in IndexedDB'));
    };
  });
}

async function idbGetFile(path) {
  const dbInstance = await openStorageDb();
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(MOCK_STORAGE_STORE, 'readonly');
    const store = tx.objectStore(MOCK_STORAGE_STORE);
    const request = store.get(path);

    request.onsuccess = () => {
      dbInstance.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      dbInstance.close();
      reject(request.error || new Error('Unable to read file from IndexedDB'));
    };
  });
}

async function idbDeleteFile(path) {
  const dbInstance = await openStorageDb();
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(MOCK_STORAGE_STORE, 'readwrite');
    const store = tx.objectStore(MOCK_STORAGE_STORE);
    store.delete(path);
    tx.oncomplete = () => {
      dbInstance.close();
      resolve();
    };
    tx.onerror = () => {
      dbInstance.close();
      reject(tx.error || new Error('Unable to delete file from IndexedDB'));
    };
  });
}

class LocalStorageRef {
  constructor(path) {
    this.path = path;
  }

  async put(file) {
    try {
      await idbPutFile(this.path, file);
    } catch (e) {
      if (e && e.name === 'QuotaExceededError') {
        throw new Error('Local test storage is full. Please remove some large videos and try again.');
      }
      throw e;
    }

    return {
      ref: {
        getDownloadURL: async () => {
          const latest = await idbGetFile(this.path);
          if (!latest) throw new Error('File not found');
          return URL.createObjectURL(latest.blob);
        }
      }
    };
  }

  async getDownloadURL() {
    const file = await idbGetFile(this.path);
    if (!file) throw new Error('File not found');
    return URL.createObjectURL(file.blob);
  }

  async delete() {
    await idbDeleteFile(this.path);
  }
}

class LocalStorageService {
  ref(path) {
    return new LocalStorageRef(path);
  }
}

const firebase = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => new Date().toISOString()
    }
  }
};

const db = new LocalDB();
const storage = new LocalStorageService();
