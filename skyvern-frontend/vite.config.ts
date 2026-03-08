import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 28080,
    proxy: {
      "/api": {
        target: "http://localhost:18000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 28080,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
