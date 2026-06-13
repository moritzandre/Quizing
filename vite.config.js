import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative base so the build works under any path (GitHub Pages project
  // subpath, a custom domain, or local preview). Hash routing means no
  // server-side rewrites are needed for deep links.
  base: "./",
  plugins: [react(), tailwindcss()],
});
