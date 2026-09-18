/**
 * GuideMe Test Site — Lightweight app JS
 * Provides realistic form interaction without any external dependencies.
 * This file is part of the ISOLATED test environment — never production code.
 */

const statusBar = document.getElementById('status-bar');

function showStatus(msg, durationMs = 3000) {
  if (!statusBar) return;
  statusBar.textContent = msg;
  setTimeout(() => { statusBar.textContent = ''; }, durationMs);
}

function showMessage(el, text, type = 'success') {
  if (!el) return;
  el.textContent = text;
  el.className = `message-area ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── Profile form ───────────────────────────────────────────────────────────
const profileForm = document.getElementById('profile-form');
if (profileForm) {
  profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('profile-name')?.value;
    const email = document.getElementById('profile-email')?.value;
    if (!name || !email) {
      showMessage(document.getElementById('profile-message'), 'សូមបំពេញព័ត៌មានទាំងអស់', 'error');
      return;
    }
    showMessage(document.getElementById('profile-message'), '✓ Profile ត្រូវបានរក្សាទុករួចហើយ!', 'success');
    showStatus('Profile saved ✓');
    // Mark the save button with data-saved for test assertion
    document.getElementById('btn-save-profile')?.setAttribute('data-saved', 'true');
  });

  document.getElementById('btn-cancel-profile')?.addEventListener('click', () => {
    profileForm.reset();
    showStatus('Changes cancelled');
  });

  // Avatar change button triggers hidden file input
  document.getElementById('btn-change-avatar')?.addEventListener('click', () => {
    document.getElementById('avatar-upload')?.click();
  });

  document.getElementById('avatar-upload')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      showStatus(`រូបភាព "${file.name}" ត្រូវបានជ្រើស`);
      document.getElementById('profile-avatar').textContent = '📷';
    }
  });
}

// ── Password form ──────────────────────────────────────────────────────────
const passwordForm = document.getElementById('password-form');
if (passwordForm) {
  passwordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const current = document.getElementById('current-password')?.value;
    const newPwd = document.getElementById('new-password')?.value;
    const confirm = document.getElementById('confirm-password')?.value;
    const msg = document.getElementById('settings-message');

    if (!current || !newPwd || !confirm) {
      showMessage(msg, 'សូមបំពេញ Password ទាំងអស់', 'error');
      return;
    }
    if (newPwd !== confirm) {
      showMessage(msg, 'Password ថ្មីមិនដូចគ្នា', 'error');
      return;
    }
    showMessage(msg, '✓ Password ត្រូវបានប្ដូររួចហើយ!', 'success');
    passwordForm.reset();
    showStatus('Password changed ✓');
    document.getElementById('btn-change-password')?.setAttribute('data-changed', 'true');
  });
}

// ── Language / Notifications save ─────────────────────────────────────────
document.getElementById('btn-save-language')?.addEventListener('click', () => {
  const lang = document.getElementById('language-select')?.value;
  showMessage(document.getElementById('settings-message'), `✓ ភាសា "${lang}" ត្រូវបានរក្សា`, 'success');
  showStatus('Language saved ✓');
});

document.getElementById('btn-save-notifications')?.addEventListener('click', () => {
  showMessage(document.getElementById('settings-message'), '✓ ការជូនដំណឹងត្រូវបានរក្សា', 'success');
  showStatus('Notifications saved ✓');
});

// ── Upload zone ────────────────────────────────────────────────────────────
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const uploadActions = document.getElementById('upload-actions');

if (uploadZone && fileInput) {
  document.getElementById('btn-choose-file')?.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;
    fileList.innerHTML = '';
    files.forEach(f => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.setAttribute('data-filename', f.name);
      item.innerHTML = `<span>📄</span><span>${f.name}</span><span style="margin-left:auto;color:var(--text-muted);font-size:0.8rem">${(f.size / 1024).toFixed(1)} KB</span>`;
      fileList.appendChild(item);
    });
    uploadActions.style.display = 'flex';
    showStatus(`${files.length} ឯកសារត្រូវបានជ្រើស`);
  });

  document.getElementById('btn-upload-submit')?.addEventListener('click', () => {
    showMessage(document.getElementById('upload-message'), '✓ Upload ជោគជ័យ!', 'success');
    fileList.innerHTML = '';
    uploadActions.style.display = 'none';
    fileInput.value = '';
    showStatus('Upload complete ✓');
    document.getElementById('btn-upload-submit')?.setAttribute('data-uploaded', 'true');
  });

  document.getElementById('btn-upload-cancel')?.addEventListener('click', () => {
    fileList.innerHTML = '';
    uploadActions.style.display = 'none';
    fileInput.value = '';
    showStatus('Upload cancelled');
  });
}

// ── Help search ────────────────────────────────────────────────────────────
document.getElementById('btn-search')?.addEventListener('click', () => {
  const q = document.getElementById('help-search')?.value?.trim();
  if (q) showStatus(`ស្វែងរក: "${q}"`);
});

// ── Contact form ───────────────────────────────────────────────────────────
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const subject = document.getElementById('contact-subject')?.value;
    const message = document.getElementById('contact-message')?.value;
    if (!subject || !message) {
      showStatus('សូមបំពេញព័ត៌មានទាំងអស់');
      return;
    }
    showMessage(
      contactForm.querySelector('.message-area') || (() => {
        const el = document.createElement('div'); contactForm.after(el); return el;
      })(),
      '✓ សារបានផ្ញើរួចហើយ!',
      'success'
    );
    contactForm.reset();
    showStatus('Message sent ✓');
  });
}
