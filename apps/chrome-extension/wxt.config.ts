import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

// Only trust local dev-server origins during local development builds — a
// production build must not let any process bound to a common dev port
// (e.g. localhost:3000/3005) pull the user's stored auth token via
// externally_connectable (see background.ts's GUIDEME_GET_AUTH_TOKEN /
// GUIDEME_AUTH_SUCCESS handlers, and audit finding GM-005).
const isDevBuild = process.env.NODE_ENV !== 'production';

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
        'https://guideme-lac.vercel.app/*',
        ...(isDevBuild ? ['http://localhost:3005/*', 'http://localhost:3000/*'] : []),
      ],
    },
    permissions: [
      'storage',
      'tabs',
      'scripting',
    ],
    host_permissions: [
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
        resources: ['popup.html', 'logo.svg', 'icons/*', 'chunks/*', 'assets/*', 'guideme-embed.js'],
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
