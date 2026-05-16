import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Tauri 期望前端 dev server 跑在固定端口
const HOST = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // 让 Tauri CLI 的输出不被 Vite 清屏覆盖
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: HOST || false,
    hmr: HOST
      ? { protocol: "ws", host: HOST, port: 1421 }
      : undefined,
    watch: {
      // 不监听 Rust 侧文件，交给 Tauri 自己处理
      ignored: ["**/src-tauri/**"],
    },
  },
  // 让 Vite 产物兼容 Tauri 的 WebView
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
  },
});
