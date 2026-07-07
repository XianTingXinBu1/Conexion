import { STORAGE_KEYS } from '@/constants';
import { removeStorage } from '@/utils/storage';

export const STORAGE_SCHEMA_VERSION = 7;

const FRONTEND_OWNED_SCHEMA_KEY = STORAGE_KEYS.STORAGE_SCHEMA_VERSION;

const LEGACY_FRONTEND_STORAGE_KEYS = Object.values(STORAGE_KEYS).filter(
  key => key !== FRONTEND_OWNED_SCHEMA_KEY,
);

export async function ensureStorageSchema(): Promise<number> {
  for (const key of LEGACY_FRONTEND_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  await Promise.all(
    LEGACY_FRONTEND_STORAGE_KEYS.map(key => removeStorage(key)),
  );

  localStorage.setItem(FRONTEND_OWNED_SCHEMA_KEY, JSON.stringify(STORAGE_SCHEMA_VERSION));
  return STORAGE_SCHEMA_VERSION;
}
