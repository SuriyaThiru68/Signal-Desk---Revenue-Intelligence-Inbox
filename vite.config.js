import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    open: false,
    allowedHosts: true,
  },
  preview: {
    // Render injects $PORT; falls back to 4173 locally
    port: parseInt(process.env.PORT) || 4173,
    host: "0.0.0.0",
    // true = allow any hostname (required for *.onrender.com)
    allowedHosts: true,
  },
});
