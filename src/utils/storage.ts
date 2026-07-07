import { del, createStore } from 'idb-keyval';

/**
 * Legacy frontend storage cleanup utilities.
 *
 * Runtime application data now lives in the backend JSON data store under
 * `.runtime/data/` and is accessed through `/api/*` endpoints. This module is
 * intentionally limited to removing old browser-local data left by pre-backend
 * versions of Conexion.
 */
export const dbStore = createStore('conexion-db', 'data');

export async function removeStorage(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
    await del(key, dbStore);
  } catch (e) {
    console.warn(`Failed to remove legacy frontend storage key ${key}:`, e);
  }
}
