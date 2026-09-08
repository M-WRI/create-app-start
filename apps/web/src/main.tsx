import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.js";
import { createI18n } from "./app/providers.js";
import "./styles/index.css";

async function bootstrap() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element #root not found");
  }

  const i18n = await createI18n({ locale: "en" });
  createRoot(rootElement).render(
    <StrictMode>
      <App i18n={i18n} />
    </StrictMode>,
  );
}

void bootstrap();
