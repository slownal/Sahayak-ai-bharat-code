"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

/**
 * ErrorBoundary — wraps ResultView so a rendering error in the results
 * panel never crashes the entire page. The user gets a friendly message
 * and a Reset button instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message };
  }

  override componentDidCatch(error: Error) {
    console.error("[Sahayak] ResultView render error:", error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            role="alert"
            className="w-full max-w-lg bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3"
          >
            <p className="text-red-700 font-medium">
              ⚠️ Something went wrong displaying the result.
            </p>
            <p className="text-sm text-red-500">{this.state.errorMsg}</p>
            <button
              onClick={() => this.setState({ hasError: false, errorMsg: "" })}
              className="mt-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-lg px-4 py-2 min-h-[44px]"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

