# GuideMe Khmer-First Accessibility Plan
## Dual-Language (Khmer / English) Interactive Guidance & Native Voice Prompts

---

> [!NOTE]
> **Project Naming Note:** Formerly referred to internally as *Rean Joch*. The official and current project name is **GuideMe**.

---

## 1. Current State Assessment

### Is this feature currently implemented?
**No.** The current codebase previously contained only basic visual mockups:
* `StepCard.jsx` had a static CSS equalizer animation and a hardcoded numeral helper.
* Walkthrough files contained static text strings.
* **Architecture gaps being addressed:**
  1. **Dual-Language (`km` / `en`):** Schema support for bilingual text and runtime language switching.
  2. **Pluggable Audio Engine:** An extensible audio architecture ready to connect to the AI team's online TTS API endpoint (with offline handling planned as a secondary fallback).
  3. **Accessible UI Controls:** Real-time `🇰🇭 ខ្មែរ` | `🇬🇧 EN` toggle and "ស្តាប់ឡើងវិញ / Listen Again" voice trigger.
  4. **Low-Literacy Assistive UX (Deferred):** Detailed below in Section 5 for future implementation.

---

## 2. Core Objectives & Design Principles

1. **Strictly 2 Languages:** Only **Khmer (`km`)** (Primary / Default) and **English (`en`)** (Secondary).
2. **Online-First TTS with Extensible Provider:**
   * **Primary Focus:** Online TTS API integration from the AI team. The Audio Engine provides a clean adapter interface (`BaseTtsProvider`) ready to connect to the team's endpoints.
   * **Offline Fallback (Future Phase):** Offline cached audio assets and pre-generated audio packs will serve as a fallback to be implemented and tested in a subsequent phase.
3. **Seamless Language Switching:** Instant live language toggle in the UI that updates text, badges, numerals, and audio prompts without resetting user progress.
4. **Accessible Audio Controls:** Prominent "ស្តាប់ឡើងវិញ / Listen Again" button and equalizer activity visualization.

---

## 3. Architecture & Data Schema Specification

### 3.1. Bilingual Step Schema (`tutorial-schema` & `core-types`)

Step definitions support either direct localized objects `{ km: string, en: string }` or plain strings (for backward compatibility):

```typescript
export interface LocalizedContent {
  km: string;
  en: string;
}

export interface AudioPromptConfig {
  km?: {
    audioUrl?: string;       // Pre-recorded audio clip
    ttsText?: string;        // Text prompt sent to online TTS API
    transcript?: string;     // Display script
    durationMs?: number;
  };
  en?: {
    audioUrl?: string;
    ttsText?: string;
    transcript?: string;
    durationMs?: number;
  };
  autoPlay?: boolean;        // Default: true
  speechRate?: number;       // Default: 1.0 (e.g. 0.85x for slow pacing)
}

export interface AccessibleStepDefinition {
  id: string;
  title: LocalizedContent | string;
  instruction: LocalizedContent | string;
  actionText?: LocalizedContent | string;
  audio?: AudioPromptConfig;
  target: {
    css: string;
    text?: string;
    ariaLabel?: string;
  };
  validation: {
    type: 'click' | 'input' | 'navigation' | 'manual';
    expectedValue?: string;
  };
}
```

### 3.2. Example Bilingual Guide Definition

```json
{
  "id": "guideme-spreadsheet-demo",
  "version": "2.0.0",
  "defaultLanguage": "km",
  "supportedLanguages": ["km", "en"],
  "name": {
    "km": "GuideMe - ការបញ្ចូលតារាងទិន្នន័យ",
    "en": "GuideMe - Spreadsheet Data Insertion"
  },
  "steps": [
    {
      "id": "step_click_insert",
      "title": {
        "km": "ម៉ឺនុយ Insert",
        "en": "Insert Menu"
      },
      "instruction": {
        "km": "សូមចុចលើពាក្យ Insert នៅលើរបារខាងលើ ដើម្បីបញ្ចូលរូបភាព ឬតារាងទិន្នន័យ។",
        "en": "Click the 'Insert' tab on the top menu to add charts or data."
      },
      "actionText": {
        "km": "ចុចទីនេះ",
        "en": "Click Here"
      },
      "audio": {
        "km": {
          "ttsText": "សូមចុចលើពាក្យ Insert នៅលើរបារខាងលើ",
          "transcript": "កំពុងអានការណែនាំជាសំឡេង..."
        },
        "en": {
          "ttsText": "Click the Insert tab on the top menu",
          "transcript": "Playing English voice guidance..."
        },
        "autoPlay": true
      },
      "target": {
        "css": "#insert-tab, button[aria-label*='Insert'], .tab-insert"
      },
      "validation": {
        "type": "click"
      }
    }
  ]
}
```

---

## 4. Pluggable Audio Architecture for AI Team's TTS API

```
                     ┌───────────────────────────┐
                     │   GuideMe Audio Engine    │
                     └─────────────┬─────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │ PlaceholderTtsProvider│                 │   Online AI Team TTS  │
   │ (Simulated/Dev Mode)  │                 │    Provider (Active)  │
   └───────────────────────┘                 └──────────┬────────────┘
                                                        │ (Fallback)
                                                        ▼
                                             ┌───────────────────────┐
                                             │ Offline Audio Cache   │
                                             │  (Future Milestone)   │
                                             └───────────────────────┘
```

---

## 5. Low-Literacy Assistive UX — Future Roadmap & Tracking

> [!IMPORTANT]
> **Implementation Note:** The following low-literacy enhancements will be implemented in a subsequent phase:

1. **Animated Pictographic Pointers:**
   - Visual bouncing finger / hand pointer overlay directly on target elements.
   - Pulsing color halo rings (green for click, blue for typing) matching spoken color instructions.
2. **Audio-Synchronized Highlighting:**
   - Highlighting words in the subtitle simultaneously as the voice reads them aloud.
3. **Phonetic & Simplified Wording Mode:**
   - Toggle between standard technical terms and simplified colloquial Khmer phrasing.
4. **Offline Audio Pre-caching Package:**
   - Bundling pre-rendered offline audio clips in extension packages when network is unavailable.
5. **Slow Speech Rate Control:**
   - 0.8x / 1.0x toggle tailored for first-time learners.

---

## 6. Verification Checklist

- [x] Rebranded all components from *Rean Joch* to **GuideMe**
- [x] Created `I18nManager` supporting `km` and `en` with dynamic fallback
- [x] Created `AudioEngine` with pluggable `BaseTtsProvider` & placeholder
- [x] Built accessible `LanguageToggle` component (`🇰🇭 ខ្មែរ` / `🇬🇧 EN`)
- [x] Connected audio playback controls ("ស្តាប់ឡើងវិញ / Listen Again") in `StepCard`
- [x] Updated schema validation for bilingual content
- [ ] Connect AI team's online TTS endpoint when ready
- [ ] Implement Low-Literacy Assistive UX milestone

