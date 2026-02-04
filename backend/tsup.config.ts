// backend/tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts'],             // your entry file (or ['src/index.ts'] if you moved to src/)
  format: ['esm'],                 // ESM only – good for music-metadata
  outDir: 'dist',                  // output folder
  clean: true,                     // clean dist/ before build
  sourcemap: true,                 // helpful for Vercel logs/debug
  dts: false,                      // skip .d.ts generation (you had --no-dts)
  minify: false,                   // keep readable for now; set true in prod later
  target: 'es2020',                // modern enough, supports Node 18/20

  // Critical: externalize to avoid dynamic require bundling issues
  external: [
    // Node.js built-ins (prevent polyfill crashes)
    'path',
    'fs',
    'os',
    'crypto',
    'buffer',
    'stream',
    'http',
    'https',
    'url',
    'util',

    // Your main CJS-heavy deps from package.json (add more if errors pop on others)
    'express',
    'body-parser',
    'cors',
    'multer',
    'mongoose',
    'jsonwebtoken',
    'nodemailer',
    'fluent-ffmpeg',
    'music-metadata',  // optional: externalize if you prefer dynamic import
  ],

  // Optional: if splitting causes issues, disable
  splitting: false,

  // Optional: banner for "use client" if needed later (not for server)
  // banner: { js: '"use server";' },
});