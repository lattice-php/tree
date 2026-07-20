import inertia from "@inertiajs/vite";
import { lattice } from "@lattice-php/lattice/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import laravel from "laravel-vite-plugin";
import { defineConfig } from "vite";

// Builds the workbench demo app. Assets land in the Testbench skeleton's
// public dir — the manifest `php artisan serve` and the browser suite read.
export default defineConfig({
  plugins: [
    // dts off: the generated icon-name module would land in the package's own
    // resources/js, which ships as source to consumers.
    lattice({ icons: { dts: false } }),
    laravel({
      input: ["workbench/resources/css/app.css", "workbench/resources/js/app.tsx"],
      publicDirectory: "vendor/orchestra/testbench-core/laravel/public",
      buildDirectory: "build",
      refresh: ["workbench/app/**", "workbench/resources/views/**", "resources/js/**"],
    }),
    inertia(),
    react(),
    tailwindcss(),
  ],
});
