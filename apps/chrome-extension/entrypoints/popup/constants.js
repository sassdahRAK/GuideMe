/**
 * Storage keys used to persist user preferences via chrome.storage.local.
 */
export const STORAGE_KEY_LANG = 'guideme_language';
export const STORAGE_KEY_THEME = 'guideme_theme';
export const STORAGE_KEY_SPEAKER = 'guideme_speaker';
export const STORAGE_KEY_HISTORY = 'guideme_history';
export const STORAGE_KEY_AUTH_TOKEN = 'authToken';
export const STORAGE_KEY_USER_PROFILE = 'userProfile';

/**
 * Supported speech synthesis voice presets.
 */
export const SPEAKER_OPTIONS = [
  { id: 'default', label: { km: 'លំនាំដើម (Default)', en: 'Default' } },
  { id: 'samantha', label: { km: 'សាម៉ានថា (Samantha)', en: 'Samantha' } },
  { id: 'daniel', label: { km: 'ដានីយ៉ែល (Daniel)', en: 'Daniel' } },
  { id: 'karen', label: { km: 'ការ៉ែន (Karen)', en: 'Karen' } },
];

/**
 * Supported languages in GuideMe.
 */
export const LANGUAGES = [
  { code: 'km', label: { km: 'ភាសាខ្មែរ', en: 'Khmer' } },
  { code: 'en', label: { km: 'អង់គ្លេស', en: 'English' } },
];
