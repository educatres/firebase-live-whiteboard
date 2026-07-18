import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/firebase-live-whiteboard/" : "/",
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        home: "index.html",
        teacher: "teacher.html",
        monitor: "monitor.html",
        student: "student.html",
        privacy: "privacy.html"
      }
    }
  }
});
