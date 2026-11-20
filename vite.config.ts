import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// The end-to-end tests point this at a separate folder so they never touch the dev database.
const statePath = process.env.BQ_STATE_DIR;

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(statePath ? { persistState: { path: statePath } } : {})],
});
