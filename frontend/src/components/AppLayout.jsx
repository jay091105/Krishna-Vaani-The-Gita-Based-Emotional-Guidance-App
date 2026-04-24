import React from 'react';
import DotBackground from './DotBackground';

function AppLayout({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-slate-950" />
      <DotBackground />

      {/* Subtle readability overlay above dots, below app content */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-slate-950/45 via-slate-950/30 to-slate-950/60" />

      <div className="pointer-events-none fixed inset-0 -z-10 opacity-65">
        <div className="animate-float-slow absolute -left-16 top-16 h-72 w-72 rounded-full bg-indigo-500/18 blur-3xl" />
        <div className="animate-float-mid absolute right-0 top-1/3 h-80 w-80 rounded-full bg-cyan-400/16 blur-3xl" />
        <div className="animate-float-fast absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-violet-400/14 blur-3xl" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default AppLayout;