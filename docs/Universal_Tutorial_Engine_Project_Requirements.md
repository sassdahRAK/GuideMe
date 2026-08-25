# Universal Tutorial Engine Chrome Extension

## Dynamic Auto-Guiding System

> **One extension, infinite websites** - No manual configuration per site. Automatically detects any webpage and provides step-by-step guidance.

---

## 🎯 Core Concept

The extension **dynamically analyzes** any website you visit and automatically generates step-by-step guidance without requiring manual setup for each site.

```
Install extension once
       ↓
Visit ANY website
       ↓
Auto-detect page type & elements
       ↓
Generate tutorial steps dynamically
       ↓
User follows guidance
       ✓ Learn by doing
```

---

## 🔄 How Dynamic Detection Works

### **1. Automatic Page Analysis (On Load)**
The extension automatically examines the page and classifies elements:

```javascript
// Auto-detect on ANY page load
const pageAnalysis = {
  // Form elements
  inputs: document.querySelectorAll('input, select, textarea'),
  
  // Interactive elements  
  buttons: document.querySelectorAll('button, [role="button"]'),
  
  // Links and navigation
  links: document.querySelectorAll('a[href]'),
  
  // Input fields specifically
  textFields: document.querySelectorAll('input[type="text"]'),
  
  // Hover-sensitive elements
  interactive: document.querySelectorAll('[tabindex]:not([tabindex="-1"])')
};
```

### **2. Pattern Recognition Library**
Pre-built patterns for common web flows:

```javascript
const PATTERNS = {
  loginForm: detectLoginForm,
  signupForm: detectSignupForm,
  searchPage: detectSearchPage,
  ecommerceProduct: detectProductPage,
  settingsPage: detectSettingsPage,
  dashboard: detectDashboard,
  formGeneric: detectGenericForm,
  navigation: detectNavigation,
  modal: detectModal,
  table: detectDataTable
};
```

### **3. Dynamic Step Generation**
Converts detected elements into guidance:

```
Detected: "Search bar at top"
       ↓
Auto-step: "Find the search bar at the top of the page"
       ↓
User types query → Press Enter
       ↓
Validation: Search results appear?
```

---

## 🌍 Website Type Detection & Auto-Guide

### **A. E-Commerce Sites (Amazon, Shopee, etc.)**
```
Auto-detected: Product grid, price tags, Add to Cart buttons
Generated steps:
1. "Find the search bar at the top of the page"
2. "Type your product name and press Enter"
3. "Click on a product image to view details"
4. "Select product options (size/color if available)"
5. "Click 'Add to Cart' button"
6. "Go to cart icon to review your selection"
```

### **B. Login/Signup Forms**
```
Auto-detected: 2 input fields + submit button
Generated steps:
1. "Enter your username or email in the first field"
2. "Enter your password in the second field (characters hidden)"
3. "Click the login button to access your account"
4. "Verify you're logged in (dashboard/home page appears)"
```

### **C. Navigation & Menus**
```
Auto-detected: Header menu, footer links, sidebar
Generated steps:
1. "Locate the main navigation menu at the top"
2. "Hover over or click 'Settings' in the menu"
3. "Select 'Account' or 'Profile' from dropdown"
4. "Use the sidebar links to navigate between sections"
```

### **D. Settings/Configuration Pages**
```
Auto-detected: Toggle switches, dropdowns, save buttons
Generated steps:
1. "Find the toggle switch to enable/disable a feature"
2. "Click the dropdown to select an option"
3. "Make your selections across the settings sections"
4. "Click 'Save Changes' to apply your settings"
5. "Verify changes applied (page refresh or confirmation message)"
```

### **E. Learning Platforms (Coursera, Udemy, etc.)**
```
Auto-detected: Video player, course progress, enrollment buttons
Generated steps:
1. "Click the 'Enroll' or 'Start Course' button"
2. "Use the video player controls to play/pause"
3. "Adjust video quality using the settings icon"
4. "Track your progress bar as you watch"
5. "Mark complete when finished (checkmark appears)"
```

### **F. Admin Dashboards (AWS, Google Cloud, etc.)**
```
Auto-detected: Widgets, navigation panels, metric displays
Generated steps:
1. "Locate the main navigation menu on the left"
2. "Click 'Services' to view available options"
3. "Select a service (e.g., EC2, S3, Cloud Storage)"
4. "Use the search bar to find specific resources"
5. "Check the status indicators for each resource"
6. "Use the action buttons to manage items"
```

---

## 🛠️ Technical Implementation

### **A. Content Script Architecture**

```javascript
// background.js - manages extension state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    injectAnalysisScript(tabId);
  }
});

// content.js - runs on every page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'startTutorial') {
    startDynamicTutorial();
  }
  if (message.type === 'getProgress') {
    sendResponse(getCurrentProgress());
  }
});
```

### **B. Page Analysis Module**

```javascript
function analyzeCurrentPage() {
  return {
    url: location.href,
    title: document.title,
    formCount: document.querySelectorAll('form').length,
    inputCount: document.querySelectorAll('input, select, textarea').length,
    buttonCount: document.querySelectorAll('button').length,
    hasForms: document.querySelectorAll('form[action]').length > 0,
    hasNavigation: document.querySelectorAll('nav, [role="navigation"]').length > 0,
    pageType: classifyPageType(),
    interactiveElements: [...document.querySelectorAll('input, button, a, select, textarea')].map(el => ({
      tag: el.tagName,
      type: el.type,
      role: el.getAttribute('role'),
      id: el.id,
      class: el.className,
      text: el.textContent.trim().substring(0, 50)
    }))
  };
}

function classifyPageType() {
  if (hasForms && inputCount > 2) return 'form';
  if (buttonCount > 3 && hasNavigation) return 'dashboard';
  if (hasNavigation && !forms) return 'website';
  if (inputCount > 1) return 'form-page';
  return 'generic';
}

function generateDynamicSteps(analysis) {
  const pattern = detectPattern(analysis);
  return PATTERNS[pattern] || generateGenericSteps(analysis);
}
```

### **C. Dynamic UI Injection**

```css
/* tutorial.css - auto-adjusts to element types */
.tutorial-overlay {
  position: fixed;
  z-index: 9999;
  font-family: system-ui, sans-serif;
}

.step-indicator {
  position: fixed;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 10000;
}

.highlight-overlay {
  position: fixed;
  border: 2px solid #3b82f6;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.1);
  z-index: 9998;
}

.button-highlight { border-color: #10b981; background: rgba(16, 185, 129, 0.1); }
.input-highlight { border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
.link-highlight { border-color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
```

### **D. Communication System**
- Browser-to-OS messaging (SE & DS teams researching)
- Survey alignment and data capture
- Progress tracking across sessions
- Monetization tier events

---

## 📊 Dynamic vs Manual Comparison

| Aspect | Manual (Traditional) | Dynamic (This Project) |
|--------|---------------------|----------------------|
| **Setup time** | Hours per website | Seconds on any site |
| **Maintenance** | High (site changes break) | Low (auto-adapts) |
| **Coverage** | Limited to configured sites | Unlimited (any website) |
| **Learning curve** | High (tutorial authors needed) | Low (just install & use) |
| **Scalability** | Poor (one site = one tutorial) | Excellent (one extension = all sites) |
| **User effort** | Configure per website | Install once, use everywhere |

---

## 📈 Success Metrics

| Metric | Target |
|--------|--------|
| Tutorial completion rate | > 60% |
| Average steps per tutorial | 5-8 |
| Drop-off point | Step 3 (complex interaction) |
| Dynamic detection accuracy | > 85% website types |
| User satisfaction | > 4/5 rating |
| Cross-browser compatibility | Chrome, Edge, Firefox |

---

## 🚀 Next Steps (Prioritized)

1. **Build page analysis module** - Auto-detect elements on any URL
2. **Create pattern library** - Common web flow templates (login, e-commerce, forms, etc.)
3. **Develop dynamic step generator** - Convert detected elements to guidance
4. **Implement adaptive UI** - Highlights that adjust to element types
5. **Test across 50+ websites** - Ensure dynamic detection works universally
6. **Implement offline handling** - Cached tutorials, graceful degradation
7. **Add monetization tiers** - Free/Pro/Premium feature breakdowns
8. **Survey integration** - Tie tutorial completion to user research

---

## 🔒 Security & Privacy

### **Data Collected (Non-PII)**
- Tutorial step completion timestamps
- Element selectors used (hashes, not full DOM)
- Interaction patterns (click locations, typed text patterns)
- Time-on-task metrics
- Page type classification (generic, login, form, etc.)

### **Data NOT Collected**
- Actual typed passwords/credentials
- Full page content
- User identity information
- Cross-site tracking

### **Storage**
- LocalStorage for tutorial progress (per tab only)
- No server communication required for basic functionality
- Optional analytics endpoint (user opt-in)

### **Permissions Required**
```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs"
  ],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js", "tutorial-engine.js", "highlight.js"],
      "css": ["tutorial.css"]
    }
  ]
}
```

---

## 📝 License

Internal project - Universal Tutorial Engine MVP
Based on Meeting #3 decisions (August 20, 2026)