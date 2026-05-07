import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: true,
    watch: {
      ignored: ["**/data/bigdata/**", "**/data/smalldata/**"],
    },
  },
});
