import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'GuideMe: Universal Tutorial Engine',
    description: 'Interactive step-by-step guidance overlays and spotlights for web applications.',
    version: '1.0.0',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    permissions: [
      'storage',
      'tabs',
      'scripting',
    ],
    host_permissions: [
      '*://*/*',
      '<all_urls>',
    ],
    action: {
      default_title: 'GuideMe: Universal Tutorial Engine',
      default_icon: {
        16: 'icons/icon-16.png',
        19: 'icons/icon-19.png',
        32: 'icons/icon-32.png',
        38: 'icons/icon-38.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
      },
    },
    web_accessible_resources: [
      {
        resources: ['popup.html', 'logo.svg', 'icons/*', 'chunks/*', 'assets/*'],
        matches: ['<all_urls>'],
      },
    ],
  },
  runner: {
    disabled: true,
  },
  vite: () => ({
    plugins: [react()],
  }),
});
