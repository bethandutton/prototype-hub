import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The renderer is a plain web app. In the Mac app it is served by the local
// server in `server/`, which is also where the API, the MCP endpoint and the
// prototype files come from.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: { alias: { "@core": path.resolve(__dirname, "core"), "@": path.resolve(__dirname, "src") } },
  build: { outDir: "dist", emptyOutDir: true },
  server: { proxy: { "/api": "http://127.0.0.1:4848", "/p": "http://127.0.0.1:4848", "/mcp": "http://127.0.0.1:4848", "/events": "http://127.0.0.1:4848" } },
});
