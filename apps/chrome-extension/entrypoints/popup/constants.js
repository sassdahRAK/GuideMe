/**
 * Storage keys used to persist user preferences via chrome.storage.local.
 */
export const STORAGE_KEY_LANG = 'guideme_language';
export const STORAGE_KEY_THEME = 'guideme_theme';
export const STORAGE_KEY_SPEAKER = 'guideme_speaker';
export const STORAGE_KEY_HISTORY = 'guideme_history';

/**
 * Supported speech synthesis voice presets.
 */
export const SPEAKER_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'samantha', label: 'Samantha' },
  { id: 'daniel', label: 'Daniel' },
  { id: 'karen', label: 'Karen' },
];

/**
 * Supported languages in GuideMe.
 */
export const LANGUAGES = [
  { code: 'km', label: 'Khmer' },
  { code: 'en', label: 'English' },
];
