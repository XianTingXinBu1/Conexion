import type { InjectionKey, Ref } from 'vue';
import type { Theme, UserCharacter } from '@/types';
import type { useAppSettings } from '@/composables/useAppSettings';

export interface AppThemeContext {
  theme: Ref<Theme>;
  toggleTheme: () => void;
}

export interface AppDebugContext {
  debugMode: Ref<boolean>;
  toggleDebugMode: () => void;
}

export type AppSettingsContext = ReturnType<typeof useAppSettings>;

export interface AppDataContext {
  selectedUser: Ref<UserCharacter | undefined>;
  deleteAllData: () => Promise<void>;
}

export const APP_THEME_KEY = Symbol('app-theme') as InjectionKey<AppThemeContext>;
export const APP_DEBUG_KEY = Symbol('app-debug') as InjectionKey<AppDebugContext>;
export const APP_SETTINGS_KEY = Symbol('app-settings') as InjectionKey<AppSettingsContext>;
export const APP_DATA_KEY = Symbol('app-data') as InjectionKey<AppDataContext>;
