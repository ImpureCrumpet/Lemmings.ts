import { fileURLToPath, URL } from 'node:url';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'copy-legal-notices',
      async writeBundle(outputOptions) {
        const outputDirectory = resolve(projectRoot, outputOptions.dir ?? 'dist');
        const licenseDirectory = resolve(outputDirectory, 'LICENSES');
        await mkdir(licenseDirectory, { recursive: true });
        await Promise.all([
          copyFile(resolve(projectRoot, 'LICENSE'), resolve(outputDirectory, 'LICENSE')),
          copyFile(
            resolve(projectRoot, 'THIRD_PARTY_NOTICES.md'),
            resolve(outputDirectory, 'THIRD_PARTY_NOTICES.md'),
          ),
          copyFile(
            resolve(projectRoot, 'LICENSES/GPL-2.0.txt'),
            resolve(licenseDirectory, 'GPL-2.0.txt'),
          ),
        ]);
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
  },
});
