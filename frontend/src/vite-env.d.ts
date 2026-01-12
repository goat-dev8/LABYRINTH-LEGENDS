/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_LINERA_FAUCET_URL: string;
  readonly VITE_LINERA_APP_ID: string;
  readonly VITE_APPLICATION_ID: string;
  readonly VITE_DYNAMIC_ENVIRONMENT_ID: string;
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
