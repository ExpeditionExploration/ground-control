import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath, URL } from 'url';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path'
import { json5Plugin } from 'vite-plugin-json5'
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
    ssr: {
        external: true,
    },
    build: {
        emptyOutDir: false,
        sourcemap: true,
        // minify: true,
        // terserOptions: {
        //     mangle: true,
        //     compress: true,
        // }
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                spatial: resolve(
                    __dirname,
                    'src/modules/spatial/window/index.html',
                ),
            },
        },
    },
    server: {
        host: 'rpi-82266.local',
        https: {
            key: fs.readFileSync('ssl/server.key'),
            cert: fs.readFileSync('ssl/server.crt'),
            // passphrase: 'your-passphrase',
        },
        cors: {
            origin: '*',
        },
        allowedHosts: ['rpi4.local', 'localhost', 'rpi-82266.local'],
    },
    plugins: [react(), tailwindcss(), json5Plugin()],
    resolve: {
        alias: [
            {
                find: 'src',
                replacement: fileURLToPath(new URL('./src', import.meta.url)),
            },
        ],
    },
});
