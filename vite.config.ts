import { fileURLToPath, URL } from 'node:url';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

async function copyDataPlaceholders(sourceDirectory: string, outputDirectory: string): Promise<void> {
  const entries = await readdir(sourceDirectory, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const sourcePath = resolve(sourceDirectory, entry.name);
    const outputPath = resolve(outputDirectory, entry.name);

    if (entry.isDirectory()) {
      await copyDataPlaceholders(sourcePath, outputPath);
      return;
    }

    if (entry.isFile() && (entry.name === 'README.md' || entry.name === 'config.json')) {
      await mkdir(outputDirectory, { recursive: true });
      await copyFile(sourcePath, outputPath);
    }
  }));
}

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
          copyFile(
            resolve(projectRoot, 'public/favicon.ico'),
            resolve(outputDirectory, 'favicon.ico'),
          ),
          copyDataPlaceholders(
            resolve(projectRoot, 'public/data'),
            resolve(outputDirectory, 'data'),
          ),
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
  build: {
    // Keep browser support intentional when Vite changes its rolling default.
    target: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'],
    // The dev server exposes player-supplied data from public/. Production
    // builds deliberately copy only the placeholders above.
    copyPublicDir: false,
  },
  test: {
    include: ['tests/**/*.spec.ts'],
  },
});
