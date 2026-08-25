import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'GuideMe — Universal Tutorial Engine',
    description: 'Interactive step-by-step guidance overlays and spotlights for web applications.',
    version: '1.0.0',
    permissions: [
      'storage',
      'activeTab',
      'tabs',
      'scripting',
    ],
    host_permissions: [
      '<all_urls>',
    ],
    action: {
      default_title: 'GuideMe Tutorials',
    },
  },
  vite: () => ({
    plugins: [react()],
  }),
});
