import { BarChart3, Database, Sparkles } from 'lucide-react';

interface DashboardHeaderProps {
  parsedCount: number;
  detectedColumnsCount: number;
  activePresetLabel: string;
}

export default function DashboardHeader({
  parsedCount,
  detectedColumnsCount,
  activePresetLabel
}: DashboardHeaderProps) {
  return (
    <header id="app-header" className="bg-white border-b border-slate-250 py-4 px-6 shadow-sm sticky top-0 z-20">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Branding Title */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
            <BarChart3 size={20} className="text-brand-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Interactive Data Dashboard
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Visualize, edit, and analyze CSV & JSON datasets beautifully
            </p>
          </div>
        </div>

        {/* Aggregate Status Badges */}
        <div className="flex flex-wrap items-center gap-3">
          {activePresetLabel && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
              <Database size={13} className="text-slate-500" />
              <span className="text-slate-500">Active Source:</span>
              <span className="font-semibold text-slate-700 truncate max-w-[180px]" title={activePresetLabel}>
                {activePresetLabel}
              </span>
            </div>
          )}

          {parsedCount > 0 && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs text-indigo-700">
              <Sparkles size={13} className="text-indigo-600" />
              <span className="font-semibold text-slate-700">Parsed Row Count:</span>
              <strong className="font-mono font-bold text-indigo-700">{parsedCount}</strong>
              <span className="text-indigo-200">|</span>
              <span className="font-semibold text-slate-700">Fields Detected:</span>
              <strong className="font-mono font-bold text-indigo-700">{detectedColumnsCount}</strong>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
