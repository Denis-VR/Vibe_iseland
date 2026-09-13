import React from "react";
import { createRoot } from "react-dom/client";
import Sanctuary from "./sanctuary";
import "./globals.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Sanctuary />
  </React.StrictMode>,
);
