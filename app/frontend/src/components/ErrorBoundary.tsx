import { Component, type ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#111214] p-6 text-[#ECECEC]">
        <div className="text-lg font-semibold">页面出错了</div>
        <pre className="max-w-xl whitespace-pre-wrap text-xs text-[#FF5C5C]">{this.state.error.message}</pre>
        <button className="rounded-lg bg-[#C6F432] px-4 py-2 text-sm text-[#111214]" onClick={() => this.setState({ error: null })}>
          返回
        </button>
      </div>
    );
  }
}
