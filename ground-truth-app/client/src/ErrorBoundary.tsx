// @a11y-strict
// client/src/ErrorBoundary.tsx — last-resort boundary around the whole app
// Session 49 · Build 5 · wave 5-1: renders the S11 app-error page (Reload +
// "Technical details" disclosure) instead of showing the stack to everyone.
// Route render errors are caught first by the router's errorElement.

import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { AppError } from './pages/fallback/AppErrorPage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error details:', errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return <AppError error={this.state.error} componentStack={this.state.errorInfo?.componentStack} />;
    }

    return this.props.children;
  }
}
