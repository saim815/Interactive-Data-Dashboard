import { useState, useMemo } from 'react';
import { ColumnInfo, ColumnStats, MetricStats } from '../types';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, CircleAlert, Sparkles, Sigma, HelpCircle } from 'lucide-react';

interface StatsAnalysisProps {
  data: any[];
  columns: ColumnInfo[];
  stats: ColumnStats;
  xAxisKey: string;
  isAnalyzing?: boolean;
}

export default function StatsAnalysis({
  data,
  columns,
  stats,
  xAxisKey,
  isAnalyzing = false
}: StatsAnalysisProps) {
  // Select which numeric column to display deep analytics for
  const numericColumns = useMemo(() => {
    return columns.filter(c => c.type === 'number');
  }, [columns]);

  const [selectedColName, setSelectedColName] = useState<string>('');

  // Default selection to first numeric column if not set or invalid
  const activeColName = useMemo(() => {
    if (selectedColName && numericColumns.some(c => c.name === selectedColName)) {
      return selectedColName;
    }
    return numericColumns[0]?.name || '';
  }, [selectedColName, numericColumns]);

  const colStats = useMemo<MetricStats | null>(() => {
    if (!activeColName || !stats[activeColName]) return null;
    return stats[activeColName];
  }, [activeColName, stats]);

  // Calculate anomalies & outliers (z-score > 1.5 StdDev)
  const anomalies = useMemo(() => {
    if (!activeColName || !colStats || data.length === 0) return [];
    
    const { avg, stdDev } = colStats;
    if (stdDev === 0) return [];

    return data
      .map((row, index) => {
        const val = Number(row[activeColName]);
        if (isNaN(val)) return null;

        const deviation = Math.abs(val - avg);
        const zScore = deviation / stdDev;

        if (zScore > 1.5) {
          return {
            row: row,
            index: index + 1,
            label: String(row[xAxisKey] || index + 1),
            value: val,
            zScore: zScore,
            direction: val > avg ? 'high' : 'low'
          };
        }
        return null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [activeColName, colStats, data, xAxisKey]);

  // Calculate simple trend direction (compare first 30% vs last 30% or simple slope)
  const trendAnalysis = useMemo(() => {
    if (!activeColName || data.length < 2) return { direction: 'stable', text: 'Insufficient data points for trend analysis.' };

    const validValues = data
      .map(row => Number(row[activeColName]))
      .filter(val => typeof val === 'number' && !isNaN(val));

    if (validValues.length < 2) return { direction: 'stable', text: 'Insufficient numeric values found.' };

    // Simple Linear Regression slope approximation
    const n = validValues.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += validValues[i];
      sumXY += i * validValues[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const pctChange = ((validValues[n - 1] - validValues[0]) / (validValues[0] || 1)) * 100;
    const formattedPercent = Math.abs(pctChange).toFixed(1);

    if (slope > 0.05) {
      return {
        direction: 'up',
        text: `Strong upward trend. This metric rose overall by about ${formattedPercent}% from start to finish.`
      };
    } else if (slope < -0.05) {
      return {
        direction: 'down',
        text: `Gradual downward trend. This metric dropped globally by around ${formattedPercent}% over the tracked timeline.`
      };
    } else {
      return {
        direction: 'stable',
        text: 'Stable baseline. The metric shows low long-term drift and hovers consistently around the current mean value.'
      };
    }
  }, [activeColName, data]);

  // Small inline bar chart data for mini histogram simulation
  const histogramData = useMemo(() => {
    if (!activeColName || data.length === 0) return [];
    
    // Group values into 5 buckets from min to max
    const { min, max } = colStats || { min: 0, max: 100 };
    const range = max - min;
    if (range <= 0) return [];

    const bucketCount = 5;
    const step = range / bucketCount;
    const buckets = Array.from({ length: bucketCount }).map((_, i) => ({
      name: `${Math.round(min + i * step)}-${Math.round(min + (i + 1) * step)}`,
      count: 0
    }));

    data.forEach(row => {
      const val = Number(row[activeColName]);
      if (isNaN(val)) return;

      const bucketIdx = Math.min(bucketCount - 1, Math.floor((val - min) / step));
      if (bucketIdx >= 0 && bucketIdx < bucketCount) {
        buckets[bucketIdx].count++;
      }
    });

    return buckets;
  }, [activeColName, colStats, data]);

  if (numericColumns.length === 0) {
    return (
      <div id="stats-empty-container" className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 shadow-sm">
        <Sigma size={24} className="text-slate-400 mx-auto mb-2 animate-pulse" />
        <p className="text-sm font-bold text-slate-800">No Numeric Columns Detected</p>
        <p className="text-xs mt-1 text-slate-550 leading-relaxed max-w-xs mx-auto">
          Statistical diagnostics require numbers. Please make sure your dataset has columns containing numeric values!
        </p>
      </div>
    );
  }

  return (
    <div id="stats-analysis-container" className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 shadow-sm relative overflow-hidden">
      
      {/* Top Selector row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Sparkles size={16} className="text-indigo-600 shrink-0" />
            Automatic Statistics & Outliers
          </h4>
          <p className="text-xs text-slate-500">Deep math properties of selected columns</p>
        </div>
        
        <select
          id="select-stats-column"
          value={activeColName}
          onChange={(e) => setSelectedColName(e.target.value)}
          className="text-xs font-semibold text-indigo-700 px-3 py-1.5 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 rounded-lg focus:outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
        >
          {numericColumns.map(col => (
            <option key={col.name} value={col.name}>{col.name}</option>
          ))}
        </select>
      </div>

      {colStats && (
        <div className="space-y-4">
          {/* Bento-grid of simple metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Average (Mean)</span>
              <p className="text-lg font-bold font-mono text-slate-800">{colStats.avg % 1 === 0 ? colStats.avg : colStats.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Median Value</span>
              <p className="text-lg font-bold font-mono text-slate-800">{colStats.median % 1 === 0 ? colStats.median : colStats.median.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Peak Maximum</span>
              <p className="text-lg font-bold font-mono text-emerald-700">{colStats.max.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Lowest Minimum</span>
              <p className="text-lg font-bold font-mono text-indigo-700">{colStats.min.toLocaleString()}</p>
            </div>
          </div>

          {/* Simple distribution graph */}
          {histogramData.length > 0 && (
            <div className="bg-slate-50/30 p-3 rounded-lg border border-slate-100 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Distribution Spread</span>
                <span>Values count</span>
              </div>
              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={histogramData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip wrapperClassName="font-mono text-[10px] rounded-md" />
                    <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Trend evaluation status badge */}
          <div className="p-3.5 rounded-lg border border-indigo-100/70 bg-indigo-50/20 flex gap-2.5 items-start">
            {trendAnalysis.direction === 'up' ? (
              <TrendingUp size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : trendAnalysis.direction === 'down' ? (
              <TrendingDown size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            ) : (
              <HelpCircle size={16} className="text-slate-500 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-800">Sequential Trend Trend</span>
              <p className="text-xs text-slate-650 leading-relaxed font-medium">{trendAnalysis.text}</p>
            </div>
          </div>

          {/* Outliers list */}
          <div className="space-y-2">
            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 px-0.5">
              <CircleAlert size={12} className="text-amber-500 shrink-0" />
              Statistical Outliers ({anomalies.length})
            </h5>
            
            {anomalies.length > 0 ? (
              <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                {anomalies.map((anom, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-orange-50/50 border border-orange-100 text-xs font-medium">
                    <span className="text-slate-700 truncate max-w-[120px]">
                      At key <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 text-[10px] font-mono">{anom.label}</code>
                    </span>
                    <span className="font-mono font-bold text-orange-700">
                      Value: {anom.value.toLocaleString()} 
                      <span className="text-[9px] text-orange-500 block text-right font-normal">({anom.direction === 'high' ? 'High outliers' : 'Low outliers'})</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100 text-center select-none leading-normal">
                Perfect baseline stability! No anomalies or values exceeding normal deviation bounds were found in this column.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
