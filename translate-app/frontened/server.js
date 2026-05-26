// frontend/vite.config.js  (if using Vite)
export default {
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000", // your backend port
        changeOrigin: true,
      },
    },
  },
};