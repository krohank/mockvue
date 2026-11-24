import React from 'react';

export class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error) { console.error('[MockVue] Page error:', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="max-w-lg mx-auto px-6 py-24 space-y-5"><h1 className="font-serif text-3xl font-bold">This page couldn’t load</h1><p className="text-sm leading-relaxed">Your saved interviews are still available. Reload to try again. Any saved draft will be restored.</p><button type="button" className="rounded-xl bg-[#7A263A] text-white px-5 py-3 text-sm font-semibold" onClick={() => window.location.reload()}>Reload page</button></main>;
  }
}
