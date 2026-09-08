import type { i18n as I18nInstance } from "i18next";
import { BrowserRouter } from "react-router";
import { AppErrorBoundary } from "./error-boundary.js";
import { AppProviders } from "./providers.js";
import { AppRouter } from "./router.js";

type AppProps = {
  i18n: I18nInstance;
};

export function App({ i18n }: AppProps) {
  return (
    <AppErrorBoundary i18n={i18n}>
      <AppProviders i18n={i18n}>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </AppProviders>
    </AppErrorBoundary>
  );
}
