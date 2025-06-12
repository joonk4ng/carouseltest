// defineConfig used to define Vite configuration in type-safe manner
import { defineConfig } from 'vite';
// enables support for React specific features
import react from '@vitejs/plugin-react';
// enables support for URL and path utilities
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import compression from 'vite-plugin-compression';
import fs from 'fs-extra';
// defines varaibles for determining current file location
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Copy PDF.js worker files to public directory
const copyPdfWorker = () => ({
  name: 'copy-pdf-worker',
  buildStart() {
    const workerSrc = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.mjs');
    const workerDest = resolve(__dirname, 'public/pdf.worker.min.mjs');
    
    // Only copy if the file doesn't exist or is older than the source
    if (!fs.existsSync(workerDest) || 
        fs.statSync(workerSrc).mtime > fs.statSync(workerDest).mtime) {
      fs.ensureDirSync(dirname(workerDest));
      fs.copyFileSync(workerSrc, workerDest);
      console.log('PDF.js worker file copied successfully');
    }
  }
});

// export Vite config object
export default defineConfig({
  // specifies to use react plug to enable JSX support and other optimizations
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    copyPdfWorker(),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      deleteOriginFile: false,
      threshold: 10240, // Only compress files larger than 10kb
      compressionOptions: {
        level: 9, // Maximum compression
      },
      filter: /\.(js|css|html|svg|json|txt)$/i,
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      deleteOriginFile: false,
      threshold: 10240,
      compressionOptions: {
        level: 11, // Maximum compression
      },
      filter: /\.(js|css|html|svg|json|txt)$/i,
    }),
  ],
  // sets base public path for app - using root path for user site
  base: '/',
  // configures development server
  server: {
    open: true,
    headers: {
      'Cache-Control': 'no-store',  // Prevent caching during development
      'Vary': 'Accept-Encoding',
      'Service-Worker-Allowed': '/',
      'Content-Type': 'application/javascript'
    },
    port: 5173,
    middlewareMode: false,
    hmr: true,  // Enable HMR for better development experience
    fs: {
      strict: true,
      allow: []
    },
    watch: {
      usePolling: true,  // Enable polling for more reliable file watching
      interval: 1000,    // Check for changes every second
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**']
    }
  },
  // Add preview configuration
  preview: {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'Vary': 'Accept-Encoding',
      'Service-Worker-Allowed': '/'
    },
    port: 4173,
    strictPort: true,
    open: true,
  },
  build: {
    // specifies output directory for build files
    outDir: 'dist',
    // sets where static assets go
    assetsDir: 'assets',
    // configures Rollup for build process
    rollupOptions: {
      // sets entry point
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        // Configure chunks for better offline support
        manualChunks: {
          vendor: ['react', 'react-dom'],
          pdf: ['pdfjs-dist'],
          xlsx: ['xlsx']
        },
        //naming convention for asset files
        assetFileNames: (assetInfo) => {
          if (process.env.NODE_ENV === 'development') {
            return 'assets/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        // sets naming for chunks and entry points
        chunkFileNames: (chunkInfo) => {
          if (process.env.NODE_ENV === 'development') {
            return 'assets/[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        entryFileNames: (chunkInfo) => {
          if (process.env.NODE_ENV === 'development') {
            return 'assets/[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        // Ensure proper MIME types
        format: 'es'
      }
    },
    // enables source map generation and debugs minified production code by mapping it back to source
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    // Add additional build options
    modulePreload: {
      polyfill: true
    }
  },
  // specifies directory for static assets
  publicDir: 'public',
  // configures how Vite resolves module imports
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
    alias: {
      'react': resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      'pdfjs-dist': resolve(__dirname, 'node_modules/pdfjs-dist'),
      'buffer': resolve(__dirname, 'node_modules/buffer')
    },
  },
  // configures dependency pre-bundling for improved performance
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'pdfjs-dist',
      'buffer'
    ],
    exclude: []
  },
  // CSS handling configuration 
  css: {
    modules: {
      localsConvention: 'camelCase'
    },
    devSourcemap: true
  },
  define: {
    'global': 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'Buffer': 'Buffer'
  }
});
