'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from '@/shared/services/error-logger';
import { ErrorFallback } from './error-fallback';

type Props = { children: ReactNode; name?: string };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, { scope: 'app', name: this.props.name, componentStack: info.componentStack ?? undefined });
  }

  private retry = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? <ErrorFallback onRetry={this.retry} title="برنامه با خطا روبه‌رو شد" /> : this.props.children;
  }
}
