import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installFetchCsrf } from "./lib/install-fetch-csrf";

// Install the CSRF-injecting fetch wrapper before any component or react-query
// fetch runs. Server-side csrfProtection requires an x-csrf-token header on
// POST/PUT/PATCH/DELETE that matches the csrf-token cookie.
installFetchCsrf();

createRoot(document.getElementById("root")!).render(<App />);
