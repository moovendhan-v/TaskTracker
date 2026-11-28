import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// One self-contained script (IIFE) for <script src> on any site: no imports, no globals but
// window.TaskFlowFeedback. TaskFlow's web app serves it at /embed/v1/feedback.js.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    lib: { entry: resolve(import.meta.dirname, 'src/widget.ts'), formats: ['iife'], name: 'TaskFlowFeedbackBundle', fileName: () => 'feedback.js' },
  },
});
