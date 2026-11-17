import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { DATA_PRESETS } from './dataPresets';
import { parseCSV, parseJSON, detectColumns, calculateColumnStats, isBinaryOrImageContent, parseBinaryToDataset } from './dataParser';
import { ColumnInfo, ChartConfig, ColumnStats, ChartType } from './types';
import DashboardHeader from './components/DashboardHeader';
import ChartVisualizer from './components/ChartVisualizer';
import DataGridTable from './components/DataGridTable';
import StatsAnalysis from './components/StatsAnalysis';
import { 
  Database, 
  Sparkles, 
  Sliders, 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  BarChart3,
  HelpCircle,
  HelpCircle as InfoIcon
} from 'lucide-react';

export default function App() {
  // Primary state: Raw dataset starts empty to enforce the beautiful clean landing dashboard
  const [rawText, setRawText] = useState<string>('');
  const [dataFormat, setDataFormat] = useState<'csv' | 'json'>('csv');
  const [activePresetId, setActivePresetId] = useState<string>('');

  // Multimodal Visual Image States
  const [isImageUpload, setIsImageUpload] = useState<boolean>(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');

  // Parsed and computed outputs
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [stats, setStats] = useState<ColumnStats>({});
  const [parseError, setParseError] = useState<string | null>(null);

  // States for drag & drop or file uploads
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [showPasteArea, setShowPasteArea] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Spreadsheet collapsible section
  const [showSpreadsheet, setShowSpreadsheet] = useState<boolean>(false);

  // Automatic visualization defaults
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    chartType: 'line',
    xAxisKey: '',
    yAxisKeys: [],
    stacked: false,
    showGrid: true,
    showTooltip: true,
    curved: true,
    theme: 'indigo',
    barLayout: 'horizontal',
    height: 380,
    customXAxisTitle: '',
    customYAxisTitle: '',
    customChartTitle: ''
  });

  // AI Dynamic Auto-configuration & Storyteller States
  const [isAutoConfiguring, setIsAutoConfiguring] = useState<boolean>(false);
  const [datasetStory, setDatasetStory] = useState<string>('');
  const [aiConfigError, setAiConfigError] = useState<string | null>(null);

  const fetchAiConfig = async (currentData: any[], currentCols: ColumnInfo[]) => {
    if (currentData.length === 0 || currentCols.length === 0) return;
    
    setIsAutoConfiguring(true);
    setAiConfigError(null);
    try {
      const sampleData = currentData.slice(0, 50).map(row => {
        const cleanRow: any = {};
        currentCols.forEach(col => {
          cleanRow[col.name] = row[col.name];
        });
        return cleanRow;
      });

      const response = await fetch('/api/recommend-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: sampleData,
          columns: currentCols
        })
      });

      if (!response.ok) {
        throw new Error('Server returned an error whilst recommending AI configuration');
      }

      const resData = await response.json();
      
      setChartConfig(prev => ({
        ...prev,
        chartType: resData.recommendedChartType || prev.chartType,
        xAxisKey: resData.recommendedXAxisKey || prev.xAxisKey,
        yAxisKeys: resData.recommendedYAxisKeys && resData.recommendedYAxisKeys.length > 0 ? resData.recommendedYAxisKeys : prev.yAxisKeys,
        customChartTitle: resData.suggestedChartTitle || '',
        customXAxisTitle: resData.suggestedXTitle || '',
        customYAxisTitle: resData.suggestedYTitle || ''
      }));

      setDatasetStory(resData.story || '');
    } catch (err: any) {
      console.warn("AI automated config failed, relying on local rule fallbacks:", err);
      setAiConfigError(err.message || 'Auto-configuration mapping failed.');
      setDatasetStory(`### 📊 Ready to Explore\nWe mapped your dataset with **${currentData.length} records** and auto-selected general coordinates. Toggle the settings sidebar above to customize any axes or titles.`);
    } finally {
      setIsAutoConfiguring(false);
    }
  };

  const analyzeUploadedImage = async (base64DataUrl: string) => {
    setIsAutoConfiguring(true);
    setAiConfigError(null);
    setParseError(null);
    try {
      const base64Parts = base64DataUrl.split(',');
      const base64Data = base64Parts[1] || base64Parts[0];
      const mimeType = base64DataUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          mimeType: mimeType
        })
      });

      if (!response.ok) {
        throw new Error('Our multimodal engine could not parse this image. Let\'s try uploading a clean text-based CSV/JSON or check network.');
      }

      const resData = await response.json();

      if (resData.error) {
        throw new Error(resData.error);
      }

      const parsedData = resData.extractedData || [];
      const parsedCols = resData.extractedColumns || [];

      if (parsedData.length === 0) {
        throw new Error('Gemini could not locate structured table cells or charts in the uploaded image. Please try another snapshot or upload standard CSV tables.');
      }

      const computedStats = calculateColumnStats(parsedData, parsedCols);

      setData(parsedData);
      setColumns(parsedCols);
      setStats(computedStats);

      setChartConfig({
        chartType: resData.recommendedChartType || 'line',
        xAxisKey: resData.recommendedXAxisKey || (parsedCols[0]?.name || ''),
        yAxisKeys: resData.recommendedYAxisKeys || (parsedCols.filter((c: any) => c.type === 'number').slice(0, 2).map((c: any) => c.name) || []),
        stacked: false,
        showGrid: true,
        showTooltip: true,
        curved: true,
        theme: 'indigo',
        barLayout: 'horizontal',
        height: 380,
        customChartTitle: resData.suggestedChartTitle || '',
        customXAxisTitle: resData.suggestedXTitle || '',
        customYAxisTitle: resData.suggestedYTitle || ''
      });

      setDatasetStory(resData.story || '');
    } catch (err: any) {
      console.warn("AI automated visual analysis failed:", err);
      setAiConfigError(err.message || 'Image profiling failed.');
      setDatasetStory(`### ⚠️ Visual Profiling Disrupted\n\nFailed to extract tabular data: **${err.message || 'Unknown network error'}**.\n\nPlease upload CSV or JSON data tables instead, or check your API key / limits.`);
    } finally {
      setIsAutoConfiguring(false);
    }
  };

  // Automatically parse data whenever raw text changes 
  useEffect(() => {
    if (!rawText || rawText.trim() === '') {
      setData([]);
      setColumns([]);
      setStats({});
      setParseError(null);
      return;
    }

    if ((isImageUpload && imagePreviewUrl) || rawText.startsWith('[IMAGE_UPLOAD:') || rawText.startsWith('[BINARY_DATA:')) {
      // Async visual intelligence extraction is handled in custom handler, bypass standard CSV/JSON text parsers
      return;
    }

    try {
      setParseError(null);

      let parsed: any[] = [];
      if (dataFormat === 'json') {
        parsed = parseJSON(rawText);
      } else {
        parsed = parseCSV(rawText);
      }

      // If text-delimited parsing yielded no rows at all, and the file contents are strictly binary,
      // we fallback to the binary profiling map (such as analyzing signal density on dropped images/archives).
      if (parsed.length === 0 && isBinaryOrImageContent(rawText)) {
        parsed = parseBinaryToDataset(rawText);
      }

      if (parsed.length === 0) {
        setParseError('The file content was empty or structured incorrectly. Please upload a structured file.');
        setData([]);
        setColumns([]);
        setStats({});
        return;
      }

      // Auto-detect schema columns & calculate numerical stats
      const detectedCols = detectColumns(parsed);
      const computedStats = calculateColumnStats(parsed, detectedCols);

      setData(parsed);
      setColumns(detectedCols);
      setStats(computedStats);

      // Dynamically auto-tune axes mapping for the loaded data
      if (detectedCols.length > 0) {
        // Find suitable label or date column for X-Axis
        const preferredX = detectedCols.find(col => 
          col.name.toLowerCase().includes('date') || 
          col.name.toLowerCase().includes('day') || 
          col.name.toLowerCase().includes('name') || 
          col.name.toLowerCase().includes('region') || 
          col.name.toLowerCase().includes('campaign') ||
          col.type === 'string'
        );
        const newXAxisKey = preferredX ? preferredX.name : detectedCols[0].name;

        // Choose leading numeric columns for Y-Axis
        const numericCols = detectedCols.filter(col => col.type === 'number');
        let newYKeys = numericCols.length > 0 
          ? numericCols.slice(0, 2).map(col => col.name) 
          : [];

        // Fallback: If no numerical columns detected, map the first available non-X axis column as Y-Axis key to ensure graph renders instantly
        if (newYKeys.length === 0 && detectedCols.length > 1) {
          const fallbackCols = detectedCols.filter(c => c.name !== newXAxisKey);
          if (fallbackCols.length > 0) {
            newYKeys = [fallbackCols[0].name];
          }
        }

        let finalChartType: ChartType = 'line';
        if (newXAxisKey.toLowerCase().includes('region') || newXAxisKey.toLowerCase().includes('campaign')) {
          finalChartType = 'bar';
        }

        setChartConfig(prev => ({
          ...prev,
          chartType: finalChartType,
          xAxisKey: newXAxisKey,
          yAxisKeys: newYKeys,
          customChartTitle: '',
          customXAxisTitle: '',
          customYAxisTitle: ''
        }));

        // Fire asynchronous AI-driven smart layout tuning & storyteller
        fetchAiConfig(parsed, detectedCols);
      }
    } catch (err: any) {
      setParseError(err.message || 'Error occurred while loading data.');
    }
  }, [rawText, dataFormat])  // Interactive slide-deck index for the parsed global dataset story
  const [activeStorySlide, setActiveStorySlide] = useState<number>(0);

  const storyDeck = useMemo(() => {
    if (!datasetStory) return [];
    
    // Split the story by major Markdown headers (###)
    const rawSections = datasetStory.split(/(?=### )/);
    const compiled = rawSections.map(sec => {
      const match = sec.match(/###\s*([^\n\r]*)/);
      const title = match ? match[1].trim() : "Interactive Data Overview";
      const content = sec.replace(/###\s*[^\n\r]*/, "").trim();
      return { title, content };
    }).filter(s => s.content.length > 10);

    if (compiled.length === 0 && datasetStory) {
      return [{ title: "Analytical Summary", content: datasetStory }];
    }
    return compiled;
  }, [datasetStory]);

  // Handle auto-reset of active slide when dataset changes
  useEffect(() => {
    setActiveStorySlide(0);
  }, [datasetStory]);

  // Clean raw text triggers
  const handlePresetSelect = (id: string, text: string, format: 'csv' | 'json') => {
    setFileError(null);
    setRawText(text);
    setDataFormat(format);
    setActivePresetId(id);
    setIsImageUpload(false);
    setImagePreviewUrl('');
  };

  // Callback to sync live corrections from table spreadsheet
  const handleDataUpdate = (newData: any[]) => {
    setData(newData);
    const computedStats = calculateColumnStats(newData, columns);
    setStats(computedStats);
  };

  const handleRawTextUpdate = (newText: string) => {
    setRawText(newText);
    setActivePresetId('custom');
  };

  // Clear memory and reset state to return back to uploader screen
  const handleResetWorkspace = () => {
    setRawText('');
    setData([]);
    setColumns([]);
    setStats({});
    setParseError(null);
    setFileError(null);
    setActivePresetId('');
    setShowPasteArea(false);
    setShowSpreadsheet(false);
    setDatasetStory('');
    setAiConfigError(null);
    setIsImageUpload(false);
    setImagePreviewUrl('');
    setChartConfig({
      chartType: 'line',
      xAxisKey: '',
      yAxisKeys: [],
      stacked: false,
      showGrid: true,
      showTooltip: true,
      curved: true,
      theme: 'indigo',
      barLayout: 'horizontal',
      height: 380,
      customXAxisTitle: '',
      customYAxisTitle: '',
      customChartTitle: ''
    });
  };

  // Drag and Drop implementation
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processLoadedFile = (file: File) => {
    setFileError(null);
    setParseError(null);
    setIsImageUpload(false);
    setImagePreviewUrl('');

    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);

    if (isImage) {
      setIsImageUpload(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImagePreviewUrl(dataUrl);
        setRawText(`[IMAGE_UPLOAD:${file.name}]`);
        setDataFormat('json');
        setActivePresetId('custom');
        // Fire multimodal image profiling async
        analyzeUploadedImage(dataUrl);
      };
      reader.onerror = () => {
        setFileError('The uploaded image content could not be read. Please upload another file.');
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      
      // Dynamic fallback: If browser read the content as text but it possesses raw binary or media layouts, process it safely
      if (isBinaryOrImageContent(text)) {
        const hasImageMagic = text.startsWith('‰PNG') || 
                              text.startsWith('\x89PNG') || 
                              text.startsWith('ÿØÿ') || 
                              text.includes('JFIF') || 
                              text.includes('Exif') || 
                              text.startsWith('GIF8');
        
        if (hasImageMagic) {
          // Redirect to high-capacity image analysis flow
          setIsImageUpload(true);
          const visualReader = new FileReader();
          visualReader.onload = (visualEvent) => {
            const dataUrl = visualEvent.target?.result as string;
            setImagePreviewUrl(dataUrl);
            setRawText(`[IMAGE_UPLOAD:${file.name}]`);
            setDataFormat('json');
            setActivePresetId('custom');
            analyzeUploadedImage(dataUrl);
          };
          visualReader.onerror = () => {
            setFileError('The visual image could not be resolved. Please try uploading a PNG or JPEG file.');
          };
          visualReader.readAsDataURL(file);
          return;
        } else {
          // Treat as a structured mathematical binary dataset profile to avoid leaking unprintable headers
          const parsedBinary = parseBinaryToDataset(text, file.name);
          setData(parsedBinary);
          const detectedCols = detectColumns(parsedBinary);
          setColumns(detectedCols);
          const computedStats = calculateColumnStats(parsedBinary, detectedCols);
          setStats(computedStats);
          
          setRawText(`[BINARY_DATA:${file.name}]`);
          setDataFormat('json');
          setActivePresetId('custom');
          return;
        }
      }

      const trimmed = text.trim();
      const format = (trimmed.startsWith('[') || trimmed.startsWith('{')) ? 'json' : 'csv';
      setRawText(text);
      setDataFormat(format || 'csv');
      setActivePresetId('custom');
    };
    reader.onerror = () => {
      setFileError('The file content could not be read. Please upload another file.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processLoadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processLoadedFile(e.target.files[0]);
    }
  };

  const triggerInputFileClick = () => {
    fileInputRef.current?.click();
  };

  // Custom Memoized Automated Insights Profiler Findings Report
  const customAnalyticalInsights = useMemo(() => {
    if (data.length === 0 || columns.length === 0) return [];
    
    interface InsightItem {
      title: string;
      desc: string;
      iconType: 'schema' | 'peak' | 'trend' | 'correlation';
      badge: string;
      badgeColor: string;
    }
    
    const reports: InsightItem[] = [];
    const numCols = columns.filter(c => c.type === 'number').map(c => c.name);
    const strCols = columns.filter(c => c.type === 'string').map(c => c.name);

    // Insight 1: Archetype Schema Profiler
    reports.push({
      title: 'Structural Schema',
      desc: `Mapped ${data.length} records with ${columns.length} dimensions. Includes ${numCols.length} numerical fields (${numCols.slice(0, 2).join(', ')}${numCols.length > 2 ? '...' : ''}) and ${strCols.length || '0'} text fields.`,
      iconType: 'schema',
      badge: `${strCols.length ? 'Mixed Types' : 'Numeric Grid'}`,
      badgeColor: 'border-indigo-200 text-indigo-700 bg-indigo-50/50'
    });

    // Insight 2: Peak anomalies for numeric fields
    if (numCols.length > 0) {
      const bestCol = numCols[0];
      const colStatInfo = stats[bestCol];
      if (colStatInfo) {
        const peakRow = data.find(r => r[bestCol] === colStatInfo.max);
        const idxVal = peakRow ? data.indexOf(peakRow) + 1 : 1;
        const labelCol = strCols.length > 0 ? strCols[0] : null;
        const reference = peakRow && labelCol ? `"${peakRow[labelCol]}" (row ${idxVal})` : `row ${idxVal}`;
        
        reports.push({
          title: `Peak Maximum: ${bestCol}`,
          desc: `The maximum extreme point was found at ${reference} reaching [ ${colStatInfo.max % 1 === 0 ? colStatInfo.max.toLocaleString() : colStatInfo.max.toLocaleString(undefined, { maximumFractionDigits: 2 })} ]. Metric average is ${colStatInfo.avg.toLocaleString(undefined, { maximumFractionDigits: 1 })}.`,
          iconType: 'peak',
          badge: 'Maximum Point',
          badgeColor: 'border-emerald-200 text-emerald-700 bg-emerald-50/50'
        });
      }
    }

    // Insight 3: Matrix Progression Trend Check
    if (numCols.length > 0) {
      const trendCol = numCols[0];
      const colStatInfo = stats[trendCol];
      if (colStatInfo && data.length >= 3) {
        // Compare first 25% average vs last 25% average
        const quad = Math.max(1, Math.floor(data.length * 0.25));
        const firstQuad = data.slice(0, quad);
        const lastQuad = data.slice(-quad);
        
        const firstAvg = firstQuad.reduce((sum, r) => sum + (Number(r[trendCol]) || 0), 0) / quad;
        const lastAvg = lastQuad.reduce((sum, r) => sum + (Number(r[trendCol]) || 0), 0) / quad;
        
        const change = lastAvg - firstAvg;
        const pct = firstAvg !== 0 ? (change / firstAvg) * 100 : 0;
        
        if (Math.abs(pct) > 1) {
          reports.push({
            title: `Metric Shift: ${trendCol}`,
            desc: `The metric displays a ${pct > 0 ? 'climbing expansion' : 'dropping shift'} of ${Math.abs(pct).toFixed(1)}% between the starting baseline sequence and final segments.`,
            iconType: 'trend',
            badge: pct > 0 ? 'Upward Trend' : 'Descending',
            badgeColor: pct > 0 ? 'border-emerald-200 text-emerald-700 bg-emerald-50/50' : 'border-rose-200 text-rose-700 bg-rose-50/50'
          });
        }
      }
    }

    // Insight 4: Correlation and Synergy checker
    if (numCols.length >= 2) {
      const [colA, colB] = numCols;
      let syncScore = 0;
      let steps = 0;
      for (let i = 1; i < data.length; i++) {
        const diffA = (Number(data[i][colA]) || 0) - (Number(data[i-1][colA]) || 0);
        const diffB = (Number(data[i][colB]) || 0) - (Number(data[i-1][colB]) || 0);
        if (diffA * diffB > 0) {
          syncScore++;
        }
        if (diffA !== 0 || diffB !== 0) {
          steps++;
        }
      }
      const consensusRatio = steps > 0 ? (syncScore / steps) * 105 : 0;
      const normalizedRatio = Math.min(100, consensusRatio);
      if (normalizedRatio > 65) {
        reports.push({
          title: 'Variable Correlation',
          desc: `High co-movement: '${colA}' and '${colB}' move in sync across ${normalizedRatio.toFixed(0)}% of tracked records, indicating a very strong predictive relationship.`,
          iconType: 'correlation',
          badge: 'High Sync',
          badgeColor: 'border-indigo-200 text-indigo-700 bg-indigo-50/50'
        });
      } else {
        reports.push({
          title: 'Relative Independence',
          desc: `Calculated correlation ratio for '${colA}' versus '${colB}' is low (${normalizedRatio.toFixed(0)}%), illustrating relatively independent variables.`,
          iconType: 'correlation',
          badge: 'Independent',
          badgeColor: 'border-amber-200 text-amber-700 bg-amber-50/50'
        });
      }
    } else {
      reports.push({
        title: 'Single Series Analysed',
        desc: 'Only one numerical column detected. Import datasets with multiple numerical values to get co-variance metrics and relational correlations.',
        iconType: 'correlation',
        badge: 'Univariate',
        badgeColor: 'border-slate-200 text-slate-700 bg-slate-50'
      });
    }

    return reports;
  }, [data, columns, stats]);

  const activePresetLabel = useMemo(() => {
    if (activePresetId === 'custom') return 'Uploaded Custom Dataset';
    const found = DATA_PRESETS.find(p => p.id === activePresetId);
    return found ? found.name : 'Active Output Report';
  }, [activePresetId]);

  return (
    <div id="app-root-visualizer" className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800 antialiased">
      
      {/* Dynamic Header */}
      <DashboardHeader
        parsedCount={data.length}
        detectedColumnsCount={columns.length}
        activePresetLabel={data.length > 0 ? activePresetLabel : ''}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        
        <AnimatePresence mode="wait">
          {data.length === 0 ? (
            <motion.div
              key="uploader"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="max-w-5xl mx-auto py-2"
            >
              {/* Premium Welcome Hero with clean spacing and negative space */}
              <div className="text-center mb-10 space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-indigo-100 text-xs font-bold tracking-wide text-indigo-700 bg-indigo-50/60 shadow-2xs">
                  <Sparkles size={12} className="text-indigo-600 animate-pulse" />
                  Instant Executive Presentation Engine
                </span>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl text-balance">
                  Turn plain data into beautiful, easy-to-read stories
                </h2>
                <p className="text-sm text-slate-550 max-w-xl mx-auto leading-relaxed">
                  Upload CSV/JSON files or use our hand-selected business scenarios. Gemini will instantly map layout dimensions, configure perfect axis labels, and generate a clear narrative.
                </p>
              </div>

              {/* Grid split for Step Tracker + Upload Area + Presets side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Steps Description Module (Left Sidebar) */}
                <div className="lg:col-span-4 bg-slate-900 text-white rounded-2xl p-6 flex flex-col justify-between shadow-md relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/40 via-transparent to-white/5 pointer-events-none" />
                  
                  <div className="space-y-6 relative z-10">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400">Simplified Workflow</h3>
                      <p className="text-lg font-extrabold text-white mt-1">Universal Onboarding</p>
                    </div>

                    <div className="space-y-5">
                      <div className="flex gap-3">
                        <div className="h-6 w-6 shrink-0 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold font-mono">1</div>
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Feed Content</h4>
                          <p className="text-[11px] text-indigo-200/80 mt-1">Upload files, paste raw text, or select high-fidelity data blueprints.</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="h-6 w-6 shrink-0 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold font-mono">2</div>
                        <div>
                          <h4 className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Cognitive Mapping</h4>
                          <p className="text-[11px] text-indigo-200/80 mt-1">Our analysis identifies variable patterns and suggests perfect axes titles.</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="h-6 w-6 shrink-0 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold font-mono">3</div>
                        <div>
                          <h4 className="text-xs font-bold text-indigo-250 uppercase tracking-wider">Strategic Reading</h4>
                          <p className="text-[11px] text-indigo-200/80 mt-1">Review complex data coordinates transformed into friendly interactive slides.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-indigo-900/30 text-[10.5px] text-indigo-300 font-medium relative z-10">
                    🔒 Server-side proxy keeps credentials secure. No client keys needed.
                  </div>
                </div>

                {/* Main Upload Terminal (8 of 12 columns) */}
                <div className="lg:col-span-8 space-y-6 flex flex-col justify-between">
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-widest">
                          <Upload size={14} className="text-indigo-600" />
                          Source Data Hub
                        </h3>
                        <span className="text-[10px] text-slate-400 font-mono">CSV / JSON / TSV COMPATIBLE</span>
                      </div>
                      
                      {isAutoConfiguring ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-xl min-h-[170px] space-y-4">
                          <div className="relative">
                            {isImageUpload && imagePreviewUrl ? (
                              <div className="relative h-20 w-28 overflow-hidden rounded-lg border border-slate-300 shadow-sm flex items-center justify-center select-none">
                                <img src={imagePreviewUrl} alt="Uploading preview" referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-60 blur-[0.5px]" />
                                <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
                                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-600 to-transparent animate-[bounce_2s_infinite]" />
                              </div>
                            ) : (
                              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-50 border border-indigo-120 text-indigo-700 animate-spin">
                                <RefreshCw size={18} />
                              </div>
                            )}
                          </div>
                          <div className="text-center space-y-1">
                            <p className="text-xs font-extrabold text-indigo-700 animate-pulse">
                              {isImageUpload ? "Multi-modal visual intelligence scanning..." : "Engaging Gemini Cognitive Mapping..."}
                            </p>
                            <p className="text-[10px] text-slate-450 max-w-sm mx-auto font-medium">
                              {isImageUpload 
                                ? "Reading image structures, matching numeric scales, and translating patterns to native English titles." 
                                : "Identifying variable patterns, configuring optimal axis labels, and writing slide narratives."}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div
                          id="central-drag-uploader"
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          onClick={triggerInputFileClick}
                          className={`cursor-pointer group flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all duration-200 min-h-[170px] ${
                            dragActive 
                              ? 'border-indigo-600 bg-indigo-50/50 shadow-xs' 
                              : 'border-slate-250 bg-slate-50 hover:border-indigo-500 hover:bg-slate-50/30'
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.json,.txt,.tsv,image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-300 shadow-2xs transition-colors mb-3">
                            <Upload size={16} />
                          </div>
                          <p className="text-xs font-bold text-slate-700">
                            Click to browse or drag & drop files here
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Recommended format: CSV / JSON tables, or any chart / dashboard screenshot
                          </p>
                        </div>
                      )}

                      {(parseError || fileError) && (
                        <div className="flex gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs leading-relaxed">
                          <AlertCircle size={15} className="shrink-0 text-rose-500 mt-0.5" />
                          <div>
                            <span className="font-extrabold uppercase tracking-wide">Dataset Loading Failure</span>
                            <p className="opacity-95 text-[11px] mt-0.5">{parseError || fileError}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => setShowPasteArea(!showPasteArea)}
                        className="text-xs flex items-center gap-1.5 font-bold text-indigo-600 hover:text-indigo-700 transition-colors select-none cursor-pointer"
                      >
                        <FileText size={13} />
                        {showPasteArea ? 'Hide Static Copy Paste Box' : 'Copy and paste raw logs data manually instead'}
                      </button>

                      {showPasteArea && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            id="raw-paste-field-direct"
                            value={rawText}
                            onChange={(e) => {
                              const val = e.target.value;
                              const format = val.trim().startsWith('[') || val.trim().startsWith('{') ? 'json' : 'csv';
                              setRawText(val);
                              setDataFormat(format);
                              setActivePresetId('custom');
                            }}
                            spellCheck={false}
                            className="w-full h-32 p-3 text-xs font-mono bg-slate-50 text-slate-800 rounded-lg border border-slate-250 focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:border-slate-350 leading-relaxed font-semibold shadow-inner"
                            placeholder="Period,Signups,Revenue&#10;Q1 Baseline,4500,128000&#10;Q2 Expansion,6800,210000"
                          />
                          <span className="text-[9.5px] text-slate-400 block font-medium">
                            The visualizer automatically infers column headers and data separators.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Curated Business Preset Cards */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                      <Sparkles size={12} className="text-indigo-600" />
                      Select a Predefined Business Scenario
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {DATA_PRESETS.map((p, idx) => {
                        const icons = ["💼", "🧪", "📈", "🏢"];
                        return (
                          <button
                            key={p.id}
                            onClick={() => handlePresetSelect(p.id, p.rawText, p.format)}
                            className="p-3 border border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-400 text-left rounded-xl transition-all duration-150 flex gap-3 cursor-pointer group shadow-2xs hover:shadow-xs"
                          >
                            <span className="text-xl shrink-0 mt-0.5">{icons[idx % icons.length]}</span>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 transition-colors block truncate">
                                {p.name.slice(2)}
                              </span>
                              <span className="text-[10.5px] text-slate-450 line-clamp-1 mt-0.5 font-medium leading-tight">
                                {p.description}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {/* Overhauled Operational Banner */}
              <div className="rounded-2xl border border-slate-200 hover:border-slate-300 py-4 bg-white px-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm transition-all">
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-50 border border-indigo-120 text-indigo-700">
                    <Database size={18} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900 leading-none">
                        Active Presentation Room: {activePresetLabel.replace(/^.*?\s/, '')}
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-[9.5px] font-bold text-emerald-700 border border-emerald-250">
                        ✨ Core Synced
                      </span>
                    </div>
                    <p className="text-xs text-slate-450 mt-1.5 font-semibold">
                      Currently processing <strong className="text-slate-800 font-mono text-[11px] font-extrabold">{data.length} records</strong> and <strong className="text-indigo-700 font-mono text-[11px] font-extrabold">{columns.length} layout features</strong> securely.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleResetWorkspace}
                  className="px-4 py-2 bg-slate-50 text-indigo-700 hover:text-indigo-850 hover:bg-slate-100 border border-slate-250 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer select-none"
                >
                  <RefreshCw size={12} />
                  Change Dataset File
                </button>
              </div>

              {/* Dynamic Presentation Story Slides Reader */}
              {(isAutoConfiguring || datasetStory) && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-indigo-50/50 border border-indigo-150 flex items-center justify-center text-indigo-600">
                        <Sparkles size={15} className={isAutoConfiguring ? "animate-spin text-indigo-500" : "text-indigo-600"} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800 flex items-center gap-1.5 leading-none">
                          Interactive Analyst Presentation Deck
                        </h4>
                        <p className="text-[10.5px] text-slate-400 mt-1 font-medium">
                          {isAutoConfiguring ? "Analyzing uploaded headers..." : "Slide-based, human-readable data interpretations"}
                        </p>
                      </div>
                    </div>

                    {!isAutoConfiguring && storyDeck.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setActiveStorySlide(prev => Math.max(0, prev - 1))}
                          disabled={activeStorySlide === 0}
                          className="p-1 px-3 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-250 text-xs font-bold rounded-lg disabled:opacity-30 cursor-pointer select-none"
                        >
                          Prev
                        </button>
                        <span className="text-xs font-mono text-slate-500 font-extrabold px-1.5">
                          Slide {activeStorySlide + 1} of {storyDeck.length}
                        </span>
                        <button
                          onClick={() => setActiveStorySlide(prev => Math.min(storyDeck.length - 1, prev + 1))}
                          disabled={activeStorySlide === storyDeck.length - 1}
                          className="p-1 px-3 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-250 text-xs font-bold rounded-lg disabled:opacity-30 cursor-pointer select-none"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>

                  {isAutoConfiguring ? (
                    <div className="py-8 flex flex-col items-center justify-center space-y-3">
                      <RefreshCw size={24} className="text-indigo-600 animate-spin" />
                      <div className="text-center">
                        <p className="text-xs font-extrabold text-slate-700 animate-pulse">Running Gemini Data Evaluator...</p>
                        <p className="text-[10px] text-slate-450 mt-1">Configuring ideal coordinate scales, axis labels, and custom titles.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {/* Active Slide Tab row for immediate navigation */}
                      {storyDeck.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                          {storyDeck.map((sec, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActiveStorySlide(idx)}
                              className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                                activeStorySlide === idx
                                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-205'
                                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                              }`}
                            >
                              {sec.title}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Display active slide description */}
                      {storyDeck[activeStorySlide] && (
                        <motion.div
                          key={activeStorySlide}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-slate-50/40 p-4 rounded-xl border border-slate-150 max-h-[200px] overflow-y-auto leading-relaxed"
                        >
                          <h5 className="text-xs font-extrabold text-slate-900 border-b border-slate-200 pb-1.5 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                            <Sparkles size={11} className="text-indigo-600" />
                            {storyDeck[activeStorySlide].title}
                          </h5>
                          <div className="markdown-body text-xs text-slate-650 font-medium">
                            <Markdown>{storyDeck[activeStorySlide].content}</Markdown>
                          </div>
                        </motion.div>
                      )}

                      {/* Summary Banner for Instant Clarity */}
                      <div className="flex items-start lg:items-center gap-3 text-xs text-slate-705 bg-indigo-50/20 border border-indigo-100/50 rounded-xl p-3.5">
                        <Sparkles size={14} className="shrink-0 text-indigo-600 mt-0.5 lg:mt-0" />
                        <div>
                          <p className="font-semibold leading-relaxed">
                            <span className="font-extrabold text-indigo-800 uppercase tracking-wider text-[10px] mr-1.5 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">AI Alignment Mapping</span>
                            Applying a <strong className="text-slate-900 font-extrabold">{chartConfig.chartType} chart</strong>. Mapped independent X scale as <code className="bg-slate-100 px-1 rounded text-slate-800 text-[10.5px] font-semibold">{chartConfig.xAxisKey}</code> and Y measurement indicators as <code className="bg-slate-100 px-1 rounded text-indigo-750 text-[10.5px] font-semibold">{chartConfig.yAxisKeys.join(', ')}</code>.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Continuous Outliers and Findings Badges */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest px-1">
                  <Zap size={11} className="text-indigo-600 shrink-0" />
                  Continuous Automated Findings Report
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {customAnalyticalInsights.map((insight, index) => (
                    <div 
                      key={index} 
                      className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-350 hover:shadow-2xs transition-all duration-150"
                    >
                      <div className="space-y-1.5">
                        <div>
                          <span className={`text-[8.5px] font-extrabold leading-none uppercase border px-2 py-0.5 rounded-md ${insight.badgeColor}`}>
                            {insight.badge}
                          </span>
                        </div>
                        <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest truncate pt-1">
                          {insight.title}
                        </h5>
                        <p className="text-[11px] text-slate-500 leading-normal font-medium">
                          {insight.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Center Workspace Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Visualizer (Left Column, 8 blocks) */}
                <div className="lg:col-span-8 flex flex-col justify-between">
                  <ChartVisualizer
                    data={data}
                    columns={columns}
                    config={chartConfig}
                    onConfigChange={setChartConfig}
                  />
                </div>

                {/* Right Statistics Outlier Block (4 blocks) */}
                <div className="lg:col-span-4 select-none">
                  <StatsAnalysis
                    data={data}
                    columns={columns}
                    stats={stats}
                    xAxisKey={chartConfig.xAxisKey}
                  />
                </div>

              </div>

              {/* Collapsible spreadsheet sheet */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button
                  onClick={() => setShowSpreadsheet(!showSpreadsheet)}
                  className="w-full px-5 py-4 bg-slate-50 flex items-center justify-between text-left hover:bg-slate-100/70 transition-all cursor-pointer select-none border-b border-slate-200"
                >
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                    <Sliders size={13} className="text-indigo-600" />
                    <span>Interactive Worksheet Data Sheet ({data.length} Rows)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-bold">
                      {showSpreadsheet ? 'Collapse Sheet' : 'Expand & Edit Row Cells'}
                    </span>
                    {showSpreadsheet ? <ChevronUp size={16} className="text-indigo-600" /> : <ChevronDown size={16} className="text-indigo-600" />}
                  </div>
                </button>

                {showSpreadsheet && (
                  <div className="p-4 bg-white">
                    <span className="text-xs text-slate-450 font-semibold mb-3 block">
                      Edit details inline below. All statistics, automatic stories, and visual graph coordinates above update natively.
                    </span>
                    <div className="h-96">
                      <DataGridTable
                        data={data}
                        columns={columns}
                        onDataUpdate={handleDataUpdate}
                        onRawTextUpdate={handleRawTextUpdate}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 mt-16 text-center text-slate-400 text-xs shadow-xs select-none">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium text-slate-400">
            Interactive Data Dashboard • Configured with live automatic summaries
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-400/80 font-mono font-medium">
            <span>FULLY LOCAL STATE SYNCHRONIZATION RUNNING</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
