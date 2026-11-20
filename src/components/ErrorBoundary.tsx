import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('POS ErrorBoundary caught:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F6F8FA] dark:bg-slate-950 p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold">Application Error Detected</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              စနစ်အတွင်း ချို့ယွင်းချက်တစ်ခု ဖြစ်ပေါ်ခဲ့ပါသည်။ ကျေးဇူးပြု၍ စာမျက်နှာကို ပြန်လည်ဖွင့်ပေးပါ။
            </p>
            <pre className="text-xs font-mono-num bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 p-3 rounded-lg overflow-auto max-h-40 whitespace-pre-wrap break-all">
              {this.state.errorMessage}
            </pre>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
