import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Daftarkan service worker. Ini salah satu syarat wajib Chrome
// supaya tombol "Install app" muncul (bukan cuma "Add shortcut").
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Gagal mendaftarkan service worker:", err);
    });
  });
}
