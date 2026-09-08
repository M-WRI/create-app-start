import type { i18n as I18nInstance } from "i18next";
import { Component, type ErrorInfo, type ReactNode } from "react";

/** Fallback when i18n is not ready (boundary sits above I18nextProvider). */
const INTERNAL_ERROR_FALLBACK = "Something went wrong. Please try again.";

type AppErrorBoundaryProps = {
  children: ReactNode;
  i18n?: I18nInstance;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("AppErrorBoundary", error, info);
  }

  private message(): string {
    const { i18n } = this.props;
    if (i18n?.isInitialized) {
      return i18n.t("errors.common.internal");
    }
    return INTERNAL_ERROR_FALLBACK;
  }

  override render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-svh items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">{this.message()}</p>
        </main>
      );
    }
    return this.props.children;
  }
}
