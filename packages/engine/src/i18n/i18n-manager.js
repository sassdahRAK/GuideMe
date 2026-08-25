import { Language } from '@guideme/core-types';

const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

/**
 * Converts Western digits to Khmer digits.
 * @param {number|string} num
 * @returns {string}
 */
export function toKhmerDigits(num) {
  return String(num).replace(/[0-9]/g, (d) => KHMER_DIGITS[d]);
}

/**
 * Centralized Internationalization (i18n) Manager for GuideMe Dual-Language Guidance.
 * Strictly manages Khmer ('km' - Primary) and English ('en' - Secondary).
 */
export class I18nManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.initialLanguage='km']
   * @param {Object} [options.storageAdapter] Optional persistent storage adapter
   */
  constructor({ initialLanguage = Language.KM, storageAdapter = null } = {}) {
    this.currentLanguage = this._normalizeLanguage(initialLanguage);
    this.storageAdapter = storageAdapter;
    this.listeners = new Set();
  }

  /**
   * Get active language ('km' or 'en').
   * @returns {string}
   */
  getLanguage() {
    return this.currentLanguage;
  }

  /**
   * Set active language.
   * @param {string} lang
   * @returns {boolean} Whether language actually changed
   */
  setLanguage(lang) {
    const normalized = this._normalizeLanguage(lang);
    if (normalized === this.currentLanguage) {
      return false;
    }

    const prevLang = this.currentLanguage;
    this.currentLanguage = normalized;

    // Persist if storage adapter provided
    if (this.storageAdapter && typeof this.storageAdapter.set === 'function') {
      try {
        this.storageAdapter.set('guideme_preferred_language', normalized);
      } catch (err) {
        // Non-blocking storage error
      }
    }

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentLanguage, prevLang);
      } catch (err) {
        console.error('[GuideMe I18nManager] Listener error:', err);
      }
    });

    return true;
  }

  /**
   * Toggle between Khmer and English.
   * @returns {string} New active language
   */
  toggleLanguage() {
    const nextLang = this.currentLanguage === Language.KM ? Language.EN : Language.KM;
    this.setLanguage(nextLang);
    return this.currentLanguage;
  }

  /**
   * Subscribe to language change events.
   * @param {(currentLang: string, prevLang: string) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  onLanguageChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Resolves a localized string or object for the given or current language.
   * @param {string|{km?: string, en?: string}|null|undefined} field
   * @param {string} [lang] Optional target language; defaults to currentLanguage
   * @returns {string}
   */
  resolve(field, lang = this.currentLanguage) {
    if (field === null || field === undefined) {
      return '';
    }

    if (typeof field === 'string') {
      return field;
    }

    if (typeof field === 'object') {
      const target = field[lang];
      if (typeof target === 'string' && target.trim().length > 0) {
        return target;
      }
      // Fallback: Check primary (km), then secondary (en), or any non-empty string value
      if (typeof field[Language.KM] === 'string' && field[Language.KM].trim().length > 0) {
        return field[Language.KM];
      }
      if (typeof field[Language.EN] === 'string' && field[Language.EN].trim().length > 0) {
        return field[Language.EN];
      }
      const firstAvailable = Object.values(field).find((v) => typeof v === 'string' && v.trim().length > 0);
      return firstAvailable || '';
    }

    return String(field);
  }

  /**
   * Format localized step badge: "ជំហានទី ១/៤" in Khmer, "Step 1/4" in English.
   * @param {number} currentStepIndex 0-indexed
   * @param {number} totalSteps
   * @param {string} [lang]
   * @returns {string}
   */
  formatStepBadge(currentStepIndex, totalSteps, lang = this.currentLanguage) {
    const current = currentStepIndex + 1;
    if (lang === Language.KM) {
      return `ជំហានទី ${toKhmerDigits(current)}/${toKhmerDigits(totalSteps)}`;
    }
    return `Step ${current}/${totalSteps}`;
  }

  /**
   * @private
   */
  _normalizeLanguage(lang) {
    if (typeof lang === 'string' && lang.toLowerCase().startsWith('en')) {
      return Language.EN;
    }
    return Language.KM;
  }
}
