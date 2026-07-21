import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const mediapipeModuleLoader = fileURLToPath(
  new URL("./public/mediapipe/wasm/vision_wasm_module_internal.js", import.meta.url)
);

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [
    react(),
    {
      name: "local-mediapipe-worker-loader",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const [pathname, query = ""] = request.url?.split("?") ?? [];
          if (pathname !== "/mediapipe/wasm/vision_wasm_module_internal.js" || !query.includes("import")) {
            next();
            return;
          }

          // MediaPipe dynamically imports its ESM WASM loader inside the worker.
          // Vite intentionally rejects imports from public/, so expose this one
          // local runtime file directly during development. Production already
          // serves the copied public asset as a normal ESM module.
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/javascript; charset=utf-8");
          response.setHeader("Cache-Control", "no-cache");
          response.end(readFileSync(mediapipeModuleLoader));
        });
      }
    }
  ],
  server: { host: "127.0.0.1" },
});
