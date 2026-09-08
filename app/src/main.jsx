import React from "react";
import { createRoot } from "react-dom/client";
import { InstallProvider } from "./InstallPrompt.jsx";
import { App } from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <InstallProvider><App /></InstallProvider>
  </React.StrictMode>,
);
