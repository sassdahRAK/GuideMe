import { Language } from '../types/index.ts';

const KHMER_DIGITS: string[] = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

/**
 * Converts Western digits to Khmer digits.
 */
export function toKhmerDigits(num: number | string): string {
  return String(num).replace(/[0-9]/g, (d) => KHMER_DIGITS[Number(d)]);
}

export type I18nListener = (currentLang: string, prevLang: string) => void;

export interface StorageAdapter {
  get?: (key: string) => any;
  set?: (key: string, value: any) => void;
}

export interface I18nManagerOptions {
  initialLanguage?: string;
  storageAdapter?: StorageAdapter | null;
}

/**
 * Centralized Internationalization (i18n) Manager for GuideMe Dual-Language Guidance.
 * Strictly manages Khmer ('km' - Primary) and English ('en' - Secondary).
 */
export class I18nManager {
  private currentLanguage: string;
  private storageAdapter: StorageAdapter | null;
  private listeners: Set<I18nListener>;

  constructor({ initialLanguage = Language.KM, storageAdapter = null }: I18nManagerOptions = {}) {
    this.currentLanguage = this._normalizeLanguage(initialLanguage);
    this.storageAdapter = storageAdapter;
    this.listeners = new Set();
  }

  /**
   * Get active language ('km' or 'en').
   */
  getLanguage(): string {
    return this.currentLanguage;
  }

  /**
   * Set active language.
   * @returns Whether language actually changed
   */
  setLanguage(lang: string): boolean {
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
   * @returns New active language
   */
  toggleLanguage(): string {
    const nextLang = this.currentLanguage === Language.KM ? Language.EN : Language.KM;
    this.setLanguage(nextLang);
    return this.currentLanguage;
  }

  /**
   * Subscribe to language change events.
   * @returns Unsubscribe function
   */
  onLanguageChange(listener: I18nListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Resolves a localized string or object for the given or current language.
   */
  resolve(field: string | { km?: string; en?: string; [key: string]: any } | null | undefined, lang: string = this.currentLanguage): string {
    if (field === null || field === undefined) {
      return '';
    }

    if (typeof field === 'string') {
      return field;
    }

    if (typeof field === 'object') {
      const target = (field as any)[lang];
      if (typeof target === 'string' && target.trim().length > 0) {
        return target;
      }
      // Fallback: Check primary (km), then secondary (en), or any non-empty string value
      if (typeof field[Language.KM] === 'string' && field[Language.KM]!.trim().length > 0) {
        return field[Language.KM]!;
      }
      if (typeof field[Language.EN] === 'string' && field[Language.EN]!.trim().length > 0) {
        return field[Language.EN]!;
      }
      const firstAvailable = Object.values(field).find((v) => typeof v === 'string' && v.trim().length > 0);
      return (firstAvailable as string) || '';
    }

    return String(field);
  }

  /**
   * Format localized step badge: "ជំហានទី ១/៤" in Khmer, "Step 1/4" in English.
   * @param currentStepIndex 0-indexed
   */
  formatStepBadge(currentStepIndex: number, totalSteps: number, lang: string = this.currentLanguage): string {
    const current = currentStepIndex + 1;
    if (lang === Language.KM) {
      return `ជំហានទី ${toKhmerDigits(current)}/${toKhmerDigits(totalSteps)}`;
    }
    return `Step ${current}/${totalSteps}`;
  }

  private _normalizeLanguage(lang: string): string {
    if (typeof lang === 'string' && lang.toLowerCase().startsWith('en')) {
      return Language.EN;
    }
    return Language.KM;
  }
}
