import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';
export default defineConfig({
    plugins: [
        react(),
        electron([
            {
                entry: 'src/main/main.ts',
                vite: {
                    build: {
                        outDir: 'dist/main',
                        rollupOptions: {
                            external: ['better-sqlite3']
                        }
                    },
                },
            },
            {
                entry: 'src/preload/index.ts',
                onstart(options) {
                    options.reload();
                },
                vite: {
                    build: {
                        outDir: 'dist/preload',
                        rollupOptions: {
                            external: ['better-sqlite3']
                        }
                    },
                },
            },
        ]),
        renderer(),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
});
