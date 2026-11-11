import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const PB = process.env.VITE_PB_URL || "http://127.0.0.1:8090";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@design": path.resolve(__dirname, "../../design") } },
  server: {
    host: true,
    port: 5173,
    fs: { allow: [path.resolve(__dirname, "../..")] },
    // Same-origin in dev too: the TV, SDK and file URLs all use relative /api paths.
    proxy: { "/api": { target: PB, changeOrigin: true }, "/_": { target: PB, changeOrigin: true } },
  },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 700 },
});
