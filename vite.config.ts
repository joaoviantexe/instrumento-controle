/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // NEXT_PUBLIC_ permite reaproveitar variáveis de integrações que usam esse prefixo.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
  },
});
