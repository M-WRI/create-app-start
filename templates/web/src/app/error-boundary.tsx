import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
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

  override render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-svh items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Something went wrong. Please reload.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
