import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const temporaryDirectory = fileURLToPath(new URL('./tmp', import.meta.url)).replace(/\\/g, '/');
const nonUiDirectories = ['docs', 'Description', 'services', 'supabase/tests'].map(directory =>
  fileURLToPath(new URL(`./${directory}`, import.meta.url)).replace(/\\/g, '/'));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Only scan the app, not HTML probes or old UI checkouts under tmp/.
  optimizeDeps: { entries: ['index.html'] },
  server: {
    watch: {
      // Native file watching can stall this workspace on Windows.
      usePolling: process.platform === 'win32',
      interval: 1000,
      // Ignore the directory itself before Chokidar tries to crawl its children.
      ignored: (path: string) => {
        const normalized = path.replace(/\\/g, '/');
        return [temporaryDirectory, ...nonUiDirectories].some(directory =>
          normalized === directory || normalized.startsWith(`${directory}/`));
      },
    },
  },
  test: {
    alias: {'npm:@supabase/supabase-js@2.117.3': '@supabase/supabase-js'},
    maxWorkers: 2,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
