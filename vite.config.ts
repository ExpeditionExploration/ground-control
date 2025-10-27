import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath, URL } from 'url';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path'
import { json5Plugin } from 'vite-plugin-json5'

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
        host: '0.0.0.0',
        cors: true,
        origin: '*',
        allowedHosts: ['rpi4.local', 'localhost'],
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
