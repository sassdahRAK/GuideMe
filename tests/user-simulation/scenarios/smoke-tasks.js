/**
 * GuideMe User Simulation — 5 Smoke Test Tasks
 *
 * These are the ONLY 5 tasks run in smoke mode.
 * Each task represents a realistic Khmer-speaking low-digital-literacy user.
 *
 * Ground truth is available ONLY to the evaluator — not the simulator.
 * The simulator receives only: task, guidance text, and visible page state.
 */

export const SMOKE_TASKS = [
  {
    id: 'task_001',
    // ── What the Khmer user says ──────────────────────────────────────────
    userPrompt: 'ខ្ញុំចង់ប្ដូរ password តែអត់ដឹងទៅណា',
    // Informal Khmer: "I want to change my password but don't know where to go"
    language: 'km',

    // ── Ground truth (evaluator only — simulator never sees this) ─────────
    groundTruth: {
      startPage: 'http://localhost:7777/settings.html',
      targetPage: 'settings.html',
      targetSection: 'section-password',
      requiredActions: [
        { type: 'fill', selector: '#current-password', value: 'OldPass123' },
        { type: 'fill', selector: '#new-password', value: 'NewPass456!' },
        { type: 'fill', selector: '#confirm-password', value: 'NewPass456!' },
        { type: 'click', selector: '#btn-change-password' },
      ],
      successIndicator: '[data-changed="true"]',
      successMessage: 'Password ត្រូវបានប្ដូររួចហើយ',
    },

    // ── Evaluation metadata ───────────────────────────────────────────────
    taskType: 'form-fill-multi-step',
    complexity: 'medium',
    expectedGuidanceKeywords: ['password', 'settings', 'ប្ដូរ'],
    maxSteps: 6,
  },

  {
    id: 'task_002',
    userPrompt: 'ចង់ប្ដូរឈ្មោះខ្ញុំក្នុងនេះ',
    // "I want to change my name here"
    language: 'km',

    groundTruth: {
      startPage: 'http://localhost:7777/profile.html',
      targetPage: 'profile.html',
      targetSection: 'profile-form',
      requiredActions: [
        { type: 'clear', selector: '#profile-name' },
        { type: 'fill', selector: '#profile-name', value: 'ចន្ទ បូរ៉ា' },
        { type: 'click', selector: '#btn-save-profile' },
      ],
      successIndicator: '[data-saved="true"]',
      successMessage: 'Profile ត្រូវបានរក្សាទុក',
    },

    taskType: 'form-fill-single',
    complexity: 'easy',
    expectedGuidanceKeywords: ['ឈ្មោះ', 'profile', 'រក្សាទុក'],
    maxSteps: 4,
  },

  {
    id: 'task_003',
    userPrompt: 'ខ្ញុំចង់ upload ឯកសារ តែអត់ដឹងចុចត្រង់ណា',
    // "I want to upload a document but don't know where to click"
    language: 'km',

    groundTruth: {
      startPage: 'http://localhost:7777/upload.html',
      targetPage: 'upload.html',
      targetSection: 'upload-zone',
      requiredActions: [
        { type: 'click', selector: '#btn-choose-file' },
        // Note: actual file selection via OS dialog skipped in automation;
        // evaluator checks that the upload zone was reached and button clicked
      ],
      successIndicator: '#btn-choose-file',
      successMessage: 'ជ្រើសរើសឯកសារ',
    },

    taskType: 'navigation-and-click',
    complexity: 'easy',
    expectedGuidanceKeywords: ['upload', 'ឯកសារ', 'ជ្រើស'],
    maxSteps: 3,
  },

  {
    id: 'task_004',
    userPrompt: 'ចង់ save តើចុចមួយណា?',
    // Informal: "I want to save, which one do I click?"
    language: 'km',

    groundTruth: {
      startPage: 'http://localhost:7777/profile.html',
      targetPage: 'profile.html',
      targetSection: 'profile-form',
      requiredActions: [
        { type: 'click', selector: '#btn-save-profile' },
      ],
      successIndicator: '#btn-save-profile',
      successMessage: 'រក្សាទុក',
    },

    taskType: 'single-click',
    complexity: 'easy',
    expectedGuidanceKeywords: ['save', 'រក្សាទុក', 'ចុច'],
    maxSteps: 2,
  },

  {
    id: 'task_005',
    userPrompt: 'ខ្ញុំចង់ប្ដូររូប profile',
    // "I want to change my profile photo"
    language: 'km',

    groundTruth: {
      startPage: 'http://localhost:7777/profile.html',
      targetPage: 'profile.html',
      targetSection: 'avatar-section',
      requiredActions: [
        { type: 'click', selector: '#btn-change-avatar' },
      ],
      successIndicator: '#btn-change-avatar',
      successMessage: 'ប្ដូររូបភាព',
    },

    taskType: 'single-click',
    complexity: 'easy',
    expectedGuidanceKeywords: ['រូប', 'profile', 'ប្ដូររូប'],
    maxSteps: 3,
  },
];

export default SMOKE_TASKS;
