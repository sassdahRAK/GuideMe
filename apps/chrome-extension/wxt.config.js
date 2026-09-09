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
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0fD4PCZqtDcEPwznZy5ZCG9K95GmJBrXWccfdo9gk7v2fk5vo/82JIfvqKhdYgsR3YGXcyMMnhg+fet2DGQZKjhaMMsJC+Ce84GmOm81pI6obJThwqxfgmFKvJbqzbUqrOCIQ9o2ELOaGzzVVOp3F8BX+ifnbPTb4hGCEff4YNLcQmawCiFMxQqS9OBB0tPXrKwadzlJ9h/nrZhSATB2vIySQqro1IsmzSOK75yOEDR+9IyYVvB1xHJYOCapUFeQLH0giNtIWRpsdqta9jgrVgQ0nxwCZSETXeJMyXZn/8QXXcsgIrfE/jRdtDK+F0H2UCkmd7lFNryN2ZMStmpFtQIDAQAB',
    externally_connectable: {
      matches: [
        'http://localhost:3000/*',
        'https://guideme-lac.vercel.app/*',
      ],
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
