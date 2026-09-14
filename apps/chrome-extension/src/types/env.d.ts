/// <reference types="vite/client" />
/// <reference types="chrome" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly WXT_API_URL?: string;
  readonly [key: string]: unknown;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css' {
  const content: string;
  export default content;
}

declare global {
  namespace JSX {
    interface Element extends React.JSX.Element {}
  }
}

