import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ColumnInfo, ChartConfig, ChartType, ColorTheme } from '../types';
import { robustParseNumber } from '../dataParser';
import Markdown from 'react-markdown';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { Sliders, CheckSquare, Square, Palette, HelpCircle, Activity, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

interface ChartVisualizerProps {
  data: any[];
  columns: ColumnInfo[];
  config: ChartConfig;
  onConfigChange: (newConfig: ChartConfig) => void;
  isAnalyzing?: boolean;
  analysisProgress?: number;
  currentStepMessage?: string;
}

const THEME_COLORS: Record<ColorTheme, string[]> = {
  indigo: ['#4f46e5', '#818cf8', '#a5b4fc', '#c7d2fe', '#6366f1'],
  emerald: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#059669'],
  amber: ['#f59e0b', '#fbbf24', '#fcd34d', '#fde047', '#d97706'],
  rose: ['#f43f5e', '#fb7185', '#fda4af', '#f87171', '#e11d48'],
  ocean: ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#0284c7'],
  monochrome: ['#1e293b', '#475569', '#64748b', '#94a3b8', '#cbd5e1'],
  
  // High-Contrast Complementary Palettes
  teal_orange: ['#0d9488', '#ea580c', '#14b8a6', '#f97316', '#2dd4bf', '#fdba74'],
  blue_amber: ['#2563eb', '#d97706', '#3b82f6', '#f59e0b', '#60a5fa', '#fcd34d'],
  purple_lime: ['#7c3aed', '#65a30d', '#8b5cf6', '#84cc16', '#a78bfa', '#a3e635'],
  magenta_emerald: ['#db2777', '#059669', '#ec4899', '#10b981', '#f472b6', '#34d399'],
  crimson_cyan: ['#e11d48', '#0891b2', '#f43f5e', '#0ca5e9', '#fda4af', '#7dd3fc']
};

function cleanFieldName(str: string): string {
  if (!str) return '';
  return str
    .replace(/[_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

export default function ChartVisualizer({
  data,
  columns,
  config,
  onConfigChange,
  isAnalyzing = false,
  analysisProgress = 0,
  currentStepMessage = ''
}: ChartVisualizerProps) {
  const [activeTab, setActiveTab] = useState<'chart' | 'settings' | 'narrative'>('chart');
  const [narrative, setNarrative] = useState<string>('');
  const [isNarrating, setIsNarrating] = useState<boolean>(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [suggestedTitles, setSuggestedTitles] = useState<{
    x: string;
    y: string;
    chart: string;
  } | null>(null);

  const [activeNarrativeSlide, setActiveNarrativeSlide] = useState<number>(0);

  const narrativeDeck = useMemo(() => {
    if (!narrative) return [];
    
    // Split the narrative by major Markdown headers (### or ##)
    const rawSections = narrative.split(/(?=### |## )/);
    const compiled = rawSections.map(sec => {
      const match = sec.match(/(?:###|##)\s*([^\n\r]*)/);
      const title = match ? match[1].trim() : "Analytical Summary";
      const content = sec.replace(/(?:###|##)\s*[^\n\r]*/, "").trim();
      return { title, content };
    }).filter(s => s.content.length > 5);

    if (compiled.length === 0 && narrative) {
      return [{ title: "Trend Overview", content: narrative }];
    }
    return compiled;
  }, [narrative]);

  useEffect(() => {
    setActiveNarrativeSlide(0);
  }, [narrative]);

  const chartHeight = config.height || 360;

  // Format tick labels for clean representation on any container size / scale
  const formatYAxisTick = (val: any) => {
    if (typeof val === 'number') {
      if (val >= 1e9) return `${(val / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
      if (val >= 1e6) return `${(val / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
      if (val >= 1e3) return `${(val / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
      if (val % 1 !== 0) return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
      return val.toLocaleString();
    }
    return String(val);
  };

  const formatXAxisTick = (val: any) => {
    const str = String(val);
    if (str.length > 14) {
      return str.slice(0, 12) + '...';
    }
    return str;
  };

  const fetchNarrative = async () => {
    if (data.length === 0 || config.yAxisKeys.length === 0) return;
    setIsNarrating(true);
    setNarrativeError(null);
    try {
      const response = await fetch('/api/analyze-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data,
          xAxisKey: config.xAxisKey,
          yAxisKeys: config.yAxisKeys,
          chartType: config.chartType
        })
      });
      if (!response.ok) {
        throw new Error('Failed to generate English data explanation.');
      }
      const resData = await response.json();
      setNarrative(resData.summary);

      if (resData.suggestedXTitle || resData.suggestedYTitle || resData.suggestedChartTitle) {
        const recX = resData.suggestedXTitle || '';
        const recY = resData.suggestedYTitle || '';
        const recChart = resData.suggestedChartTitle || '';

        setSuggestedTitles({
          x: recX,
          y: recY,
          chart: recChart
        });

        // Safe auto-apply: if the titles haven't been manually set by the user or are generic, apply the AI suggestions
        const currentXGeneric = !config.customXAxisTitle || config.customXAxisTitle === config.xAxisKey;
        const currentYGeneric = !config.customYAxisTitle || config.customYAxisTitle === config.yAxisKeys.join(' & ');
        const currentChartGeneric = !config.customChartTitle || config.customChartTitle === '' || config.customChartTitle === 'Interactive Visualization';

        if (currentXGeneric || currentYGeneric || currentChartGeneric) {
          onConfigChange({
            ...config,
            customXAxisTitle: currentXGeneric ? recX : config.customXAxisTitle,
            customYAxisTitle: currentYGeneric ? recY : config.customYAxisTitle,
            customChartTitle: currentChartGeneric ? recChart : config.customChartTitle
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setNarrativeError(err.message || 'Failed to generate English interpretation content.');
    } finally {
      setIsNarrating(false);
    }
  };

  useEffect(() => {
    setSuggestedTitles(null);
    const timer = setTimeout(() => {
      fetchNarrative();
    }, 600);
    return () => clearTimeout(timer);
  }, [data, config.xAxisKey, config.yAxisKeys, config.chartType]);
  
  // Extract categoric candidates for X-Axis, and Numeric candidates for Y-Axis
  const xAxisCandidates = useMemo(() => {
    return columns.map(c => c.name);
  }, [columns]);

  const yAxisCandidates = useMemo(() => {
    return columns.filter(c => c.type === 'number').map(c => c.name);
  }, [columns]);

  const yAxisSelectorCandidates = useMemo(() => {
    const numerics = columns.filter(c => c.type === 'number').map(c => c.name);
    if (numerics.length > 0) return numerics;
    // Fallback: list non-X axis columns
    return columns.filter(c => c.name !== config.xAxisKey).map(c => c.name);
  }, [columns, config.xAxisKey]);

  useEffect(() => {
    if (data.length === 0 || columns.length === 0) return;

    let needsUpdate = false;
    let newXKey = config.xAxisKey;
    let newYKeys = [...config.yAxisKeys];

    // Ensure we have a valid xAxisKey
    if (!newXKey || !columns.some(c => c.name === newXKey)) {
      const preferredX = columns.find(col => 
        col.name.toLowerCase().includes('date') || 
        col.name.toLowerCase().includes('day') || 
        col.name.toLowerCase().includes('name') || 
        col.name.toLowerCase().includes('region') || 
        col.name.toLowerCase().includes('campaign') ||
        col.type === 'string'
      );
      newXKey = preferredX ? preferredX.name : columns[0].name;
      needsUpdate = true;
    }

    // Filter down currently mapped keys to only those that exist in columns
    const validYKeys = newYKeys.filter(key => columns.some(c => c.name === key));
    if (validYKeys.length !== newYKeys.length) {
      newYKeys = validYKeys;
      needsUpdate = true;
    }

    if (newYKeys.length === 0) {
      // Choose leading numeric columns for Y-Axis
      const numericCols = columns.filter(col => col.type === 'number');
      let selectY = numericCols.length > 0 
        ? numericCols.slice(0, 2).map(col => col.name) 
        : [];

      // Fallback if no numeric columns
      if (selectY.length === 0 && columns.length > 0) {
        const fallbackCols = columns.filter(c => c.name !== newXKey);
        if (fallbackCols.length > 0) {
          selectY = [fallbackCols[0].name];
        } else {
          selectY = [columns[0].name];
        }
      }
      newYKeys = selectY;
      needsUpdate = true;
    }

    if (needsUpdate) {
      onConfigChange({
        ...config,
        xAxisKey: newXKey,
        yAxisKeys: newYKeys
      });
    }
  }, [data, columns, config.xAxisKey, config.yAxisKeys, onConfigChange]);

  const colors = useMemo(() => {
    return THEME_COLORS[config.theme] || THEME_COLORS.indigo;
  }, [config.theme]);

  // Sanitized data pass specifically for plotting to ensure all values are robustly parsed floats,
  // preventing charts from collapsing due to unformatted text values or blank gaps.
  const sanitizedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map((row, i) => {
      const cleanRow = { ...row };
      
      // Ensure XAxis key holds a valid, printable string label
      const xVal = cleanRow[config.xAxisKey];
      if (xVal === undefined || xVal === null || String(xVal).trim() === '') {
        cleanRow[config.xAxisKey] = `Point ${i + 1}`;
      } else {
        cleanRow[config.xAxisKey] = String(xVal);
      }
      
      // Ensure YAxis keys are parsed as numeric values
      config.yAxisKeys.forEach(key => {
        const val = cleanRow[key];
        if (val === undefined || val === null) {
          cleanRow[key] = 0;
        } else if (typeof val === 'number') {
          cleanRow[key] = isNaN(val) ? 0 : val;
        } else {
          const stringVal = String(val);
          const robustParsed = robustParseNumber(stringVal);
          if (robustParsed !== null) {
            cleanRow[key] = robustParsed;
          } else {
            const parsed = parseFloat(stringVal);
            cleanRow[key] = isNaN(parsed) ? 0 : parsed;
          }
        }
      });
      
      return cleanRow;
    });
  }, [data, config.xAxisKey, config.yAxisKeys]);

  // Prepare pie data (Needs custom mapping of a single series into keys)
  const pieData = useMemo(() => {
    if (config.chartType !== 'pie' || sanitizedData.length === 0) return [];
    const primaryYKey = config.yAxisKeys[0] || '';
    
    return sanitizedData.map((row) => ({
      name: String(row[config.xAxisKey] || 'Point'),
      value: Number(row[primaryYKey] || 0)
    }));
  }, [config.chartType, config.xAxisKey, config.yAxisKeys, sanitizedData]);

  // Adjust series mapping dynamically 
  const toggleYValue = (key: string) => {
    let updatedYKeys = [...config.yAxisKeys];
    if (updatedYKeys.includes(key)) {
      // Keep at least 1 series active
      if (updatedYKeys.length > 1) {
        updatedYKeys = updatedYKeys.filter(k => k !== key);
      }
    } else {
      updatedYKeys.push(key);
    }
    onConfigChange({ ...config, yAxisKeys: updatedYKeys });
  };

  // Safe parsed numerical values formatting
  const formatValue = (val: any) => {
    if (typeof val === 'number') {
      if (val % 1 !== 0) return val.toFixed(2);
      return val.toLocaleString();
    }
    return String(val);
  };

  // Render correct Recharts components based on selection
  const renderChart = () => {
    if (sanitizedData.length === 0 || config.yAxisKeys.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-72 text-slate-400">
          <Activity size={32} className="text-slate-300 animate-pulse mb-3" />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">No active variables selected</p>
          <p className="text-[11px] text-slate-400 mt-1">Check at least one series below or in settings</p>
        </div>
      );
    }

    const isVerticalBar = config.chartType === 'bar' && config.barLayout === 'vertical';
    const lineType = config.curved ? 'monotone' : 'linear';

    const xAxisTitle = config.customXAxisTitle || cleanFieldName(config.xAxisKey) || config.xAxisKey;
    const yAxisTitle = config.customYAxisTitle || config.yAxisKeys.map(cleanFieldName).join(' & ') || config.yAxisKeys.join(' & ');

    const hasXTitle = !!xAxisTitle;
    const hasYTitle = !!yAxisTitle;

    const chartMargins = {
      top: 15,
      right: 15,
      bottom: hasXTitle ? 32 : 5,
      left: hasYTitle ? 15 : 10
    };

    const currentYAxisWidth = hasYTitle ? 95 : 65;
    const currentVerticalYAxisWidth = hasYTitle ? 120 : 90;

    switch (config.chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={chartHeight} minWidth={0} minHeight={0}>
            <LineChart data={sanitizedData} margin={chartMargins}>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />}
              <XAxis 
                dataKey={config.xAxisKey} 
                tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'var(--font-sans)', fontWeight: 500 }} 
                stroke="#cbd5e1" 
                tickFormatter={formatXAxisTick}
                minTickGap={25}
                label={hasXTitle ? { 
                  value: xAxisTitle, 
                  position: 'insideBottom', 
                  offset: -12, 
                  style: { textAnchor: 'middle', fontSize: '10px', fill: '#475569', fontFamily: 'var(--font-sans)', fontWeight: 650 } 
                } : undefined}
              />
              <YAxis 
                tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'var(--font-mono)' }} 
                stroke="#cbd5e1" 
                tickFormatter={formatYAxisTick}
                width={currentYAxisWidth}
                label={hasYTitle ? { 
                  value: yAxisTitle, 
                  angle: -90, 
                  position: 'insideLeft', 
                  offset: -10,
                  style: { textAnchor: 'middle', fontSize: '10px', fill: '#475569', fontFamily: 'var(--font-sans)', fontWeight: 650 } 
                } : undefined}
              />
              {config.showTooltip && (
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                />
              )}
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              {config.yAxisKeys.map((key, i) => (
                <Line
                  key={key}
                  type={lineType}
                  dataKey={key}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2.5}
                  activeDot={{ r: 6 }}
                  dot={{ r: 3, strokeWidth: 1.5, fill: '#fff' }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={chartHeight} minWidth={0} minHeight={0}>
            <AreaChart data={sanitizedData} margin={chartMargins}>
              <defs>
                {config.yAxisKeys.map((key, i) => (
                  <linearGradient key={`grad-${key}`} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />}
              <XAxis 
                dataKey={config.xAxisKey} 
                tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'var(--font-sans)', fontWeight: 500 }} 
                stroke="#cbd5e1" 
                tickFormatter={formatXAxisTick}
                minTickGap={25}
                label={hasXTitle ? { 
                  value: xAxisTitle, 
                  position: 'insideBottom', 
                  offset: -12, 
                  style: { textAnchor: 'middle', fontSize: '10px', fill: '#475569', fontFamily: 'var(--font-sans)', fontWeight: 650 } 
                } : undefined}
              />
              <YAxis 
                tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'var(--font-mono)' }} 
                stroke="#cbd5e1" 
                tickFormatter={formatYAxisTick}
                width={currentYAxisWidth}
                label={hasYTitle ? { 
                  value: yAxisTitle, 
                  angle: -90, 
                  position: 'insideLeft', 
                  offset: -10,
                  style: { textAnchor: 'middle', fontSize: '10px', fill: '#475569', fontFamily: 'var(--font-sans)', fontWeight: 650 } 
                } : undefined}
              />
              {config.showTooltip && (
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                />
              )}
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              {config.yAxisKeys.map((key, i) => (
                <Area
                  key={key}
                  type={lineType}
                  dataKey={key}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  fill={`url(#grad-${key})`}
                  stackId={config.stacked ? 'stack' : undefined}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight} minWidth={0} minHeight={0}>
            <BarChart 
              data={sanitizedData} 
              layout={config.barLayout}
              margin={{ ...chartMargins, left: isVerticalBar ? 5 : chartMargins.left }}
            >
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />}
              {isVerticalBar ? (
                <>
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'var(--font-mono)' }} 
                    stroke="#cbd5e1" 
                    tickFormatter={formatYAxisTick}
                    label={hasXTitle ? { 
                      value: xAxisTitle, 
                      position: 'insideBottom', 
                      offset: -12, 
                      style: { textAnchor: 'middle', fontSize: '10px', fill: '#475569', fontFamily: 'var(--font-sans)', fontWeight: 650 } 
                    } : undefined}
                  />
                  <YAxis 
                    dataKey={config.xAxisKey} 
                    type="category" 
                    tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'var(--font-sans)', fontWeight: 500 }} 
                    stroke="#cbd5e1" 
                    tickFormatter={formatXAxisTick}
                    width={currentVerticalYAxisWidth}
                    label={hasYTitle ? { 
                      value: yAxisTitle, 
                      angle: -90, 
                      position: 'insideLeft', 
                      offset: -10,
                      style: { textAnchor: 'middle', fontSize: '10px', fill: '#475569', fontFamily: 'var(--font-sans)', fontWeight: 650 } 
                    } : undefined}
                  />
                </>
              ) : (
                <>
                  <XAxis 
                    dataKey={config.xAxisKey} 
                    tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'var(--font-sans)', fontWeight: 500 }} 
                    stroke="#cbd5e1" 
                    tickFormatter={formatXAxisTick}
                    minTickGap={25}
                    label={hasXTitle ? { 
                      value: xAxisTitle, 
                      position: 'insideBottom', 
                      offset: -12, 
                      style: { textAnchor: 'middle', fontSize: '10px', fill: '#475569', fontFamily: 'var(--font-sans)', fontWeight: 650 } 
                    } : undefined}
                  />
                  <YAxis 
                    tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'var(--font-mono)' }} 
                    stroke="#cbd5e1" 
                    tickFormatter={formatYAxisTick}
                    width={currentYAxisWidth}
                    label={hasYTitle ? { 
                      value: yAxisTitle, 
                      angle: -90, 
                      position: 'insideLeft', 
                      offset: -10,
                      style: { textAnchor: 'middle', fontSize: '10px', fill: '#475569', fontFamily: 'var(--font-sans)', fontWeight: 650 } 
                    } : undefined}
                  />
                </>
              )}
              {config.showTooltip && (
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                />
              )}
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              {config.yAxisKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={colors[i % colors.length]}
                  radius={[4, 4, 0, 0]}
                  stackId={config.stacked ? 'stack' : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={chartHeight} minWidth={0} minHeight={0}>
            <PieChart margin={{ top: 15, right: 15, left: 15, bottom: 15 }}>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={config.stacked ? 55 : 0} // Doughnut/Donut styling
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${formatXAxisTick(name)} (${(percent * 100).toFixed(0)}%)`}
                labelLine={true}
                style={{ fontSize: '10px', fontFamily: 'var(--font-sans)', fontWeight: 500, fill: '#1e293b' }}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              {config.showTooltip && (
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  formatter={(val) => formatValue(val)}
                />
              )}
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight} minWidth={0} minHeight={0}>
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={sanitizedData} margin={{ top: 15, right: 15, left: 15, bottom: 15 }}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey={config.xAxisKey} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 500 }} stroke="#cbd5e1" tickFormatter={formatXAxisTick} />
              <PolarRadiusAxis angle={30} tick={{ fontSize: 8, fill: '#94a3b8' }} stroke="#cbd5e1" tickFormatter={formatYAxisTick} />
              {config.yAxisKeys.map((key, i) => (
                <Radar
                  key={key}
                  name={key}
                  dataKey={key}
                  stroke={colors[i % colors.length]}
                  fill={colors[i % colors.length]}
                  fillOpacity={0.25}
                />
              ))}
              {config.showTooltip && (
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }} />
              )}
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
            </RadarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div id="chart-visualizer-container" className="bg-white rounded-xl border border-slate-200 flex flex-col h-full shadow-sm">
      {/* Visual Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5 min-w-0 flex-1 mr-4">
          <Activity size={16} className="text-indigo-600 shrink-0" />
          <span className="truncate" title={config.customChartTitle || (config.yAxisKeys.length > 0 ? `${config.yAxisKeys.map(cleanFieldName).join(' & ')} by ${cleanFieldName(config.xAxisKey)} Trends` : "Interactive Data Plot")}>
            {config.customChartTitle || (config.yAxisKeys.length > 0 ? `${config.yAxisKeys.map(cleanFieldName).join(' & ')} by ${cleanFieldName(config.xAxisKey)} Trends` : "Interactive Data Plot")}
          </span>
        </h3>
        
        {/* Workspace Tab choices */}
        <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 gap-1 text-[11px] font-bold">
          <button
            id="view-tabs-chart"
            onClick={() => setActiveTab('chart')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'chart' 
                ? 'bg-white text-indigo-700 border border-slate-200 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Workspace
          </button>
          <button
            id="view-tabs-settings"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'settings' 
                ? 'bg-white text-indigo-700 border border-slate-200 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders size={12} className="text-slate-500" />
            Config
          </button>
          <button
            id="view-tabs-narrative"
            onClick={() => setActiveTab('narrative')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'narrative' 
                ? 'bg-white text-indigo-700 border border-slate-200 shadow-xs' 
                : 'text-slate-505 hover:text-slate-800'
            }`}
          >
            <Sparkles size={12} className="text-indigo-600" />
            Narrative Explanation
          </button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 p-4 flex flex-col bg-white">
        {activeTab === 'chart' && (
          <div className="flex-1 flex flex-col justify-between">
            {/* Direct Quick Settings Bar in Canvas */}
            <div className="flex flex-wrap items-center gap-2.5 mb-4 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Type:</span>
                <select
                  id="select-chart-type"
                  value={config.chartType}
                  onChange={(e) => onConfigChange({ ...config, chartType: e.target.value as ChartType })}
                  className="px-2 py-1.5 rounded-md border border-slate-200 bg-white font-semibold text-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:border-slate-350 cursor-pointer"
                >
                  <option value="line">Line Chart</option>
                  <option value="bar">Bar Chart</option>
                  <option value="area">Area Chart</option>
                  <option value="pie">Pie Chart (Donut)</option>
                  <option value="radar">Radar Chart</option>
                </select>
              </div>

              <div className="h-4 w-px bg-slate-200" />

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">X-Axis:</span>
                <select
                  id="select-x-axis"
                  value={config.xAxisKey}
                  onChange={(e) => onConfigChange({ ...config, xAxisKey: e.target.value })}
                  className="px-2 py-1.5 rounded-md border border-slate-200 bg-white font-semibold text-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:border-slate-350 max-w-[120px] truncate cursor-pointer"
                >
                  {xAxisCandidates.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="h-4 w-px bg-slate-200" />

              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] shrink-0">Y-Axis Series:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {yAxisSelectorCandidates.map(keyName => {
                    const isChecked = config.yAxisKeys.includes(keyName);
                    return (
                      <button
                        key={keyName}
                        onClick={() => toggleYValue(keyName)}
                        className={`inline-flex items-center gap-1 py-1 px-2.5 rounded-md border text-xs transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                            : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800 hover:border-slate-300'
                        }`}
                        title={`Toggle ${keyName}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isChecked ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                        <span className="truncate max-w-[90px]">{keyName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Render Recharts Engine */}
            <div className="w-full relative" style={{ minHeight: `${chartHeight}px`, height: `${chartHeight}px` }}>
              {renderChart()}
            </div>

            {/* Executive Summary Mini Snippet */}
            <div className="mt-5 border-t border-slate-100 pt-3 flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Executive Narrative</span>
                  <button 
                    onClick={() => setActiveTab('narrative')}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    Read full breakdown &rarr;
                  </button>
                </div>
                {isNarrating ? (
                  <p className="text-xs text-slate-450 animate-pulse mt-0.5">Analytic summary generator is processing model data...</p>
                ) : narrative ? (
                  <p className="text-xs text-slate-600 line-clamp-3 mt-0.5 font-medium leading-relaxed">
                    {narrative.replace(/[#*`_-]/g, '').trim()}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic mt-0.5">
                    Select datasets metrics to view automatic contextual summarization.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-5 py-2">
            <div className="border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Visual Configuration Settings
              </span>
            </div>
            
            <div className="space-y-5">
              {/* Palette Color Theme Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Palette size={14} className="text-indigo-500" /> Chart Color Palettes
                  </label>
                  <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-semibold">
                    11 Hand-Crafted Combinations
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  {/* Standard Analogous Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                        Harmonious Tones
                      </span>
                      <span className="text-[9px] text-slate-400">Single dominant hues</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {(['indigo', 'emerald', 'amber', 'rose', 'ocean', 'monochrome'] as ColorTheme[]).map((themeName) => (
                        <button
                          id={`theme-${themeName}`}
                          key={themeName}
                          onClick={() => onConfigChange({ ...config, theme: themeName })}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            config.theme === themeName
                              ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700 font-semibold shadow-xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="capitalize">{themeName}</span>
                          <span className="flex gap-0.5 shrink-0">
                            <span className="w-2.5 h-2.5 rounded-full shadow-xs border border-white" style={{ backgroundColor: THEME_COLORS[themeName][0] }} />
                            <span className="w-2.5 h-2.5 rounded-full shadow-xs border border-white" style={{ backgroundColor: THEME_COLORS[themeName][1] }} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Complementary High Contrast Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block flex items-center gap-1">
                        <span>Complementary Contrast</span>
                        <Sparkles size={10} className="text-amber-500" />
                      </span>
                      <span className="text-[9px] text-emerald-600 font-medium">Recommended for reading overlays</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {(['teal_orange', 'blue_amber', 'purple_lime', 'magenta_emerald', 'crimson_cyan'] as ColorTheme[]).map((themeName) => {
                        const displayName = themeName.replace('_', ' & ');
                        return (
                          <button
                            id={`theme-${themeName}`}
                            key={themeName}
                            onClick={() => onConfigChange({ ...config, theme: themeName })}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                              config.theme === themeName
                                ? 'border-violet-600 bg-violet-50/50 text-violet-800 font-semibold shadow-xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span className="capitalize">{displayName}</span>
                            <span className="flex gap-0.5 shrink-0">
                              <span className="w-2.5 h-2.5 rounded-full shadow-xs border border-white" style={{ backgroundColor: THEME_COLORS[themeName][0] }} />
                              <span className="w-2.5 h-2.5 rounded-full shadow-xs border border-white" style={{ backgroundColor: THEME_COLORS[themeName][1] }} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Series Series select list and custom legend highlights */}
              <div className="space-y-2 bg-white rounded-xl p-3 border border-slate-100">
                <span className="text-xs font-bold text-slate-700 block">
                  Plotted Series Legend Override Preview & Toggle
                </span>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Toggle variables to show or hide lines. Each active series is rendered below with its designated palette color.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {yAxisCandidates.map((keyName, i) => {
                    const isActive = config.yAxisKeys.includes(keyName);
                    // Match visual color index dynamically
                    const currentColors = THEME_COLORS[config.theme] || THEME_COLORS.indigo;
                    const seriesColor = currentColors[i % currentColors.length];
                    
                    return (
                      <button
                        id={`series-${keyName}`}
                        key={keyName}
                        onClick={() => toggleYValue(keyName)}
                        className={`inline-flex items-center gap-2 py-1.5 px-3 rounded-lg border text-xs transition-all cursor-pointer ${
                          isActive
                            ? 'bg-slate-50 text-slate-800 border-slate-250 hover:bg-slate-100 shadow-xs'
                            : 'bg-white text-slate-400 border-slate-150 hover:text-slate-700 opacity-60'
                        }`}
                      >
                        <span 
                          className="w-3 h-3 rounded-full transition-transform active:rotate-12 outline-hidden border border-white shadow-xs shrink-0" 
                          style={{ backgroundColor: seriesColor }} 
                        />
                        <span className="truncate max-w-[140px] font-medium">{keyName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <span className="text-xs font-bold text-slate-700 block">Toggle Preferences</span>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer group text-xs text-slate-700 select-none font-medium">
                  <input
                    id="checkbox-stacked"
                    type="checkbox"
                    checked={config.stacked}
                    onChange={(e) => onConfigChange({ ...config, stacked: e.target.checked })}
                    className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Stack Series</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group text-xs text-slate-700 select-none font-medium">
                  <input
                    id="checkbox-curved"
                    type="checkbox"
                    checked={config.curved}
                    onChange={(e) => onConfigChange({ ...config, curved: e.target.checked })}
                    className="rounded border-slate-355 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Curved Interpolation</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group text-xs text-slate-700 select-none font-medium">
                  <input
                    id="checkbox-grid"
                    type="checkbox"
                    checked={config.showGrid}
                    onChange={(e) => onConfigChange({ ...config, showGrid: e.target.checked })}
                    className="rounded border-slate-355 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Draw Gridlines</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group text-xs text-slate-700 select-none font-medium">
                  <input
                    id="checkbox-tooltip"
                    type="checkbox"
                    checked={config.showTooltip}
                    onChange={(e) => onConfigChange({ ...config, showTooltip: e.target.checked })}
                    className="rounded border-slate-355 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Show Tooltips</span>
                </label>
              </div>

              {/* Bar Layout arrangements */}
              {config.chartType === 'bar' && (
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 text-xs">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Bar Arrangement:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50 gap-1 font-semibold">
                    <button
                      id="bar-layout-horizontal"
                      onClick={() => onConfigChange({ ...config, barLayout: 'horizontal' })}
                      className={`px-3 py-1 rounded-md text-xs transition-all ${
                        config.barLayout === 'horizontal'
                          ? 'bg-white text-indigo-700 border border-slate-200 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Vertical Column
                    </button>
                    <button
                      id="bar-layout-vertical"
                      onClick={() => onConfigChange({ ...config, barLayout: 'vertical' })}
                      className={`px-3 py-1 rounded-md text-xs transition-all ${
                        config.barLayout === 'vertical'
                          ? 'bg-white text-indigo-700 border border-slate-200 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Horizontal Bar
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Axis Labels */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 block">Custom Dashboard & Axis Titles</span>
                  {suggestedTitles && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-750 px-2 py-0.5 rounded-full font-bold">
                      <Sparkles size={10} className="animate-pulse" /> Custom AI Suggestions Ready
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Override the default titles and visual axes labels with custom descriptive names suitable for active publication or presentation views.
                </p>

                {suggestedTitles && (
                  <div className="bg-gradient-to-r from-indigo-50/70 to-emerald-50/70 border border-indigo-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-indigo-700 flex items-center gap-1 uppercase tracking-wider">
                        <Sparkles size={11} className="text-indigo-650" />
                        AI Suggested Dynamic Titles
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onConfigChange({
                            ...config,
                            customXAxisTitle: suggestedTitles.x,
                            customYAxisTitle: suggestedTitles.y,
                            customChartTitle: suggestedTitles.chart
                          });
                        }}
                        className="text-[10.5px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        Apply AI Titles
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-slate-600 leading-relaxed">
                      <div className="bg-white/70 p-2 rounded border border-indigo-100/40">
                        <span className="font-bold text-slate-400 block mb-0.5 uppercase text-[9px]">X-Axis Suggestion</span>
                        <span className="font-semibold text-slate-800">{suggestedTitles.x}</span>
                      </div>
                      <div className="bg-white/70 p-2 rounded border border-indigo-100/40">
                        <span className="font-bold text-slate-400 block mb-0.5 uppercase text-[9px]">Y-Axis Suggestion</span>
                        <span className="font-semibold text-slate-800">{suggestedTitles.y}</span>
                      </div>
                      <div className="bg-white/70 p-2 rounded border border-indigo-100/40">
                        <span className="font-bold text-slate-400 block mb-0.5 uppercase text-[9px]">Chart Title Suggestion</span>
                        <span className="font-semibold text-slate-800">{suggestedTitles.chart}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="space-y-1 sm:col-span-2">
                    <label id="label-custom-title" className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-600 flex items-center gap-1.5">
                      <span>Chart Title Suggestion ({config.customChartTitle ? 'Custom Override Active' : 'Default / Not Set'})</span>
                    </label>
                    <input
                      id="input-custom-title"
                      type="text"
                      placeholder={config.yAxisKeys.length > 0 ? `${config.yAxisKeys.map(cleanFieldName).join(' & ')} by ${cleanFieldName(config.xAxisKey)} Trends` : "Enter a custom title (e.g. Sales Trend Analysis 2026)..."}
                      value={config.customChartTitle || ''}
                      onChange={(e) => onConfigChange({ ...config, customChartTitle: e.target.value })}
                      className="w-full text-xs px-2.5 py-2 rounded-md border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label id="label-custom-x" className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-600 flex items-center gap-1.5">
                      <span>X-Axis Prompt Title ({config.xAxisKey || 'No Data'})</span>
                    </label>
                    <input
                      id="input-custom-x"
                      type="text"
                      placeholder={cleanFieldName(config.xAxisKey) || "Enter custom title..."}
                      value={config.customXAxisTitle || ''}
                      onChange={(e) => onConfigChange({ ...config, customXAxisTitle: e.target.value })}
                      className="w-full text-xs px-2.5 py-2 rounded-md border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label id="label-custom-y" className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-600 flex items-center gap-1.5">
                      <span>Y-Axis Prompt Title ({config.yAxisKeys.join(', ') || 'No Data'})</span>
                    </label>
                    <input
                      id="input-custom-y"
                      type="text"
                      placeholder={config.yAxisKeys.map(cleanFieldName).join(' & ') || "Enter custom title..."}
                      value={config.customYAxisTitle || ''}
                      onChange={(e) => onConfigChange({ ...config, customYAxisTitle: e.target.value })}
                      className="w-full text-xs px-2.5 py-2 rounded-md border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'narrative' && (
          <div className="flex-1 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="text-sm font-bold text-slate-950 flex items-center gap-1">
                  <Sparkles size={14} className="text-indigo-600" />
                  Natural English Narrator
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Smart dataset analysis prepared on-the-fly
                </p>
              </div>
              <button
                onClick={fetchNarrative}
                disabled={isNarrating}
                className="px-3 py-1.5 bg-slate-50 border border-slate-250 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50 hover:text-slate-900 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all font-semibold"
              >
                <RefreshCw size={12} className={isNarrating ? "animate-spin text-indigo-600" : ""} />
                {isNarrating ? "Interpreting..." : "Regenerate Model Review"}
              </button>
            </div>

            {/* AI Exact Axis & Chart Titles Details Card */}
            {suggestedTitles && (
              <div className="bg-gradient-to-r from-indigo-50/70 via-white to-emerald-50/70 border border-indigo-150 p-4 rounded-xl space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-indigo-600 shrink-0" />
                      Dataset Visual Axis Determinator
                    </h5>
                    <p className="text-[10px] text-slate-550 font-medium">
                      Exact titles recommended for presentation scales based on current active metrics.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onConfigChange({
                        ...config,
                        customXAxisTitle: suggestedTitles.x,
                        customYAxisTitle: suggestedTitles.y,
                        customChartTitle: suggestedTitles.chart
                      });
                    }}
                    className="text-[10.5px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-xs hover:scale-[1.01]"
                  >
                    Apply Recommended Titles as Chart Labels
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white/90 p-2.5 rounded-lg border border-indigo-100/30 shadow-2xs">
                    <span className="font-extrabold text-[#475569] block mb-1 tracking-wider uppercase text-[9px]">Exact X-Axis Title (for '{config.xAxisKey}')</span>
                    <p className="text-xs font-bold text-slate-800">{suggestedTitles.x}</p>
                    <p className="text-[9.5px] mt-1 text-slate-455 font-medium leading-relaxed">Derived by studying interval data types and consecutive ranges.</p>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-lg border border-indigo-100/30 shadow-2xs">
                    <span className="font-extrabold text-[#475569] block mb-1 tracking-wider uppercase text-[9px]">Exact Y-Axis Title (for '{config.yAxisKeys.join(', ')}')</span>
                    <p className="text-xs font-bold text-slate-800">{suggestedTitles.y}</p>
                    <p className="text-[9.5px] mt-1 text-slate-455 font-medium leading-relaxed">Derived from aggregated properties, unit metrics or count sums.</p>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-lg border border-indigo-100/30 shadow-2xs">
                    <span className="font-extrabold text-indigo-755 block mb-1 tracking-wider uppercase text-[9px]">Exact Chart Header</span>
                    <p className="text-xs font-bold text-indigo-950 truncate" title={suggestedTitles.chart}>{suggestedTitles.chart}</p>
                    <p className="text-[9.5px] mt-1 text-slate-455 font-medium leading-relaxed">Selected by identifying high-level context of this visualization study.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col space-y-3">
              {isNarrating ? (
                <div className="flex-1 bg-slate-50/50 border border-slate-200 rounded-xl flex flex-col items-center justify-center py-16 space-y-3 min-h-[220px]">
                  <Activity size={24} className="text-indigo-600 animate-spin" />
                  <p className="text-xs uppercase tracking-widest text-slate-400 animate-pulse font-bold">Interpreting charts coordinates...</p>
                </div>
              ) : narrativeError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-750 rounded-xl text-xs flex gap-2">
                  <AlertCircle size={15} className="text-rose-550 shrink-0 mt-0.5" />
                  <p>{narrativeError}</p>
                </div>
              ) : narrativeDeck.length > 0 ? (
                <div className="space-y-3">
                  {/* Sliding Stepper controls */}
                  {narrativeDeck.length > 1 && (
                    <div className="flex items-center justify-between bg-slate-100/60 p-2 rounded-xl border border-slate-200">
                      <div className="flex flex-wrap gap-1">
                        {narrativeDeck.map((sec, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveNarrativeSlide(idx)}
                            className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                              activeNarrativeSlide === idx
                                ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                                : 'text-slate-550 hover:text-slate-800'
                            }`}
                          >
                            {sec.title}
                          </button>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        <button
                          onClick={() => setActiveNarrativeSlide(prev => Math.max(0, prev - 1))}
                          disabled={activeNarrativeSlide === 0}
                          className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-250 text-xs font-bold rounded-md disabled:opacity-30 cursor-pointer text-slate-600 select-none animate-pulse-once"
                        >
                          Prev
                        </button>
                        <span className="text-[10.5px] font-mono text-slate-500 font-extrabold">
                          {activeNarrativeSlide + 1}/{narrativeDeck.length}
                        </span>
                        <button
                          onClick={() => setActiveNarrativeSlide(prev => Math.min(narrativeDeck.length - 1, prev + 1))}
                          disabled={activeNarrativeSlide === narrativeDeck.length - 1}
                          className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-250 text-xs font-bold rounded-md disabled:opacity-30 cursor-pointer text-slate-600 select-none animate-pulse-once"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Active content slide */}
                  {narrativeDeck[activeNarrativeSlide] && (
                    <motion.div
                      key={activeNarrativeSlide}
                      initial={{ opacity: 0, scale: 0.99 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-slate-50 p-5 rounded-xl border border-slate-200 max-h-[300px] overflow-y-auto leading-relaxed"
                    >
                      <h5 className="text-xs font-extrabold text-slate-900 border-b border-slate-200 pb-1.5 mb-2.5 flex items-center gap-1.5 uppercase tracking-wide">
                        <Sparkles size={11} className="text-indigo-600" />
                        {narrativeDeck[activeNarrativeSlide].title}
                      </h5>
                      <div className="markdown-body text-xs text-slate-650 font-medium">
                        <Markdown>{narrativeDeck[activeNarrativeSlide].content}</Markdown>
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 p-12 rounded-xl text-center">
                  <p className="text-slate-405 italic select-none text-xs">
                    Please map a column above to generate its natural dimension narrative.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
