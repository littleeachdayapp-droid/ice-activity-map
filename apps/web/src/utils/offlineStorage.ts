/**
 * IndexedDB-based offline storage for reports
 */

import { Report } from '../types/report';

const DB_NAME = 'ice-activity-map';
const DB_VERSION = 1;
const REPORTS_STORE = 'reports';
const META_STORE = 'meta';

let dbInstance: IDBDatabase | null = null;

/**
 * Open or create the IndexedDB database
 */
async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create reports store
      if (!db.objectStoreNames.contains(REPORTS_STORE)) {
        const reportsStore = db.createObjectStore(REPORTS_STORE, { keyPath: 'id' });
        reportsStore.createIndex('timestamp', 'timestamp', { unique: false });
        reportsStore.createIndex('activityType', 'activityType', { unique: false });
      }

      // Create meta store for tracking cache state
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Convert Report to storable format (serialize dates)
 */
function serializeReport(report: Report): Record<string, unknown> {
  return {
    ...report,
    timestamp: report.timestamp.toISOString()
  };
}

/**
 * Convert stored report back to Report type
 */
function deserializeReport(stored: Record<string, unknown>): Report {
  return {
    ...stored,
    timestamp: new Date(stored.timestamp as string)
  } as Report;
}

/**
 * Save reports to IndexedDB
 */
export async function cacheReports(reports: Report[]): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([REPORTS_STORE, META_STORE], 'readwrite');
    const reportsStore = transaction.objectStore(REPORTS_STORE);
    const metaStore = transaction.objectStore(META_STORE);

    // Clear existing reports and add new ones
    await new Promise<void>((resolve, reject) => {
      const clearRequest = reportsStore.clear();
      clearRequest.onerror = () => reject(clearRequest.error);
      clearRequest.onsuccess = () => resolve();
    });

    // Add each report
    for (const report of reports) {
      await new Promise<void>((resolve, reject) => {
        const addRequest = reportsStore.add(serializeReport(report));
        addRequest.onerror = () => reject(addRequest.error);
        addRequest.onsuccess = () => resolve();
      });
    }

    // Update cache timestamp
    await new Promise<void>((resolve, reject) => {
      const putRequest = metaStore.put({
        key: 'lastCached',
        value: new Date().toISOString(),
        count: reports.length
      });
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    });

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.error('Failed to cache reports:', err);
  }
}

/**
 * Get cached reports from IndexedDB
 */
export async function getCachedReports(): Promise<Report[]> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(REPORTS_STORE, 'readonly');
    const store = transaction.objectStore(REPORTS_STORE);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const reports = (request.result || []).map(deserializeReport);
        resolve(reports);
      };
    });
  } catch (err) {
    console.error('Failed to get cached reports:', err);
    return [];
  }
}

/**
 * Get cache metadata
 */
export async function getCacheInfo(): Promise<{ lastCached: Date | null; count: number }> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(META_STORE, 'readonly');
    const store = transaction.objectStore(META_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get('lastCached');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          resolve({
            lastCached: new Date(request.result.value),
            count: request.result.count || 0
          });
        } else {
          resolve({ lastCached: null, count: 0 });
        }
      };
    });
  } catch (err) {
    console.error('Failed to get cache info:', err);
    return { lastCached: null, count: 0 };
  }
}

/**
 * Add a single report to the cache (for offline submissions)
 */
export async function addReportToCache(report: Report): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(REPORTS_STORE, 'readwrite');
    const store = transaction.objectStore(REPORTS_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(serializeReport(report));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('Failed to add report to cache:', err);
  }
}

/**
 * Queue a report submission for later (when offline)
 */
const PENDING_SUBMISSIONS_KEY = 'pending-submissions';

export async function queueReportSubmission(reportData: unknown): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(META_STORE, 'readwrite');
    const store = transaction.objectStore(META_STORE);

    // Get existing pending submissions
    const existing = await new Promise<unknown[]>((resolve, reject) => {
      const request = store.get(PENDING_SUBMISSIONS_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.value || []);
    });

    // Add new submission
    const pending = [...existing, { data: reportData, timestamp: new Date().toISOString() }];

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ key: PENDING_SUBMISSIONS_KEY, value: pending });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('Failed to queue report submission:', err);
  }
}

/**
 * Get pending report submissions
 */
export async function getPendingSubmissions(): Promise<Array<{ data: unknown; timestamp: string }>> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(META_STORE, 'readonly');
    const store = transaction.objectStore(META_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(PENDING_SUBMISSIONS_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.value || []);
    });
  } catch (err) {
    console.error('Failed to get pending submissions:', err);
    return [];
  }
}

/**
 * Clear pending submissions after successful sync
 */
export async function clearPendingSubmissions(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(META_STORE, 'readwrite');
    const store = transaction.objectStore(META_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(PENDING_SUBMISSIONS_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('Failed to clear pending submissions:', err);
  }
}

/**
 * Check if the browser supports IndexedDB
 */
export function isOfflineStorageSupported(): boolean {
  return 'indexedDB' in window;
}
