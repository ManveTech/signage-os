/// <reference types="vite/client" />

/**
 * Build-time configuration. Vite inlines these, so they are set as Docker
 * build args rather than runtime environment (see the Dockerfile).
 */
interface ImportMetaEnv {
  /** The CMS API origin, e.g. https://cms.bluestardigitech.com/api/v1 */
  readonly VITE_CMS_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
