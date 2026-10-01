import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    async () => {
      try {
        const registration =
          await navigator.serviceWorker.register(
            "/sw.js"
          );

        console.log(
          "Service Worker registered successfully:",
          registration
        );

        /*
          Check for a newer service
          worker when the app opens.
        */

        await registration.update();

        console.log(
          "Service Worker update checked."
        );
      } catch (error) {
        console.error(
          "Service Worker registration failed:",
          error
        );
      }
    }
  );
}

createRoot(
  document.getElementById("root")
).render(
  <StrictMode>
    <App />
  </StrictMode>
);