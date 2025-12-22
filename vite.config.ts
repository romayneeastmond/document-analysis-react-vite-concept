import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
        },
        plugins: [react()],
        define: {
            'process.env.AZURE_OPENAI_API_KEY': JSON.stringify(env.AZURE_OPENAI_API_KEY),
            'process.env.AZURE_OPENAI_ENDPOINT': JSON.stringify(env.AZURE_OPENAI_ENDPOINT),
            'process.env.AZURE_OPENAI_DEPLOYMENT': JSON.stringify(env.AZURE_OPENAI_DEPLOYMENT),
            'process.env.AZURE_COSMOS_ENDPOINT': JSON.stringify(env.AZURE_COSMOS_ENDPOINT),
            'process.env.AZURE_COSMOS_KEY': JSON.stringify(env.AZURE_COSMOS_KEY),
            'process.env.FUNCTION_DOCUMENT_ANALYSIS_ENDPOINT': JSON.stringify(env.FUNCTION_DOCUMENT_ANALYSIS_ENDPOINT),
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        }
    };
});
