import React, { useState, useRef, useEffect } from 'react';
import { DATA_PRESETS } from '../dataPresets';
import { PresetDataset } from '../types';
import { Upload, FileText, Database, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { isBinaryOrImageContent } from '../dataParser';

interface DataImporterProps {
  rawText: string;
  onDataChange: (text: string, format: 'csv' | 'json') => void;
  parsedCount: number;
  detectedColumnsCount: number;
  parseError: string | null;
}

export default function DataImporter({
  rawText,
  onDataChange,
  parsedCount,
  detectedColumnsCount,
  parseError
}: DataImporterProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('web-analytics');
  const [activeTab, setActiveTab] = useState<'presets' | 'paste' | 'upload'>('presets');
  const [pasteContent, setPasteContent] = useState<string>(rawText);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync paste content box with parent state when presets change
  useEffect(() => {
    setPasteContent(rawText);
  }, [rawText]);

  const handlePresetSelect = (preset: PresetDataset) => {
    setSelectedPresetId(preset.id);
    onDataChange(preset.rawText, preset.format);
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPasteContent(val);
    // Detect format rudely
    const format = val.trim().startsWith('[') || val.trim().startsWith('{') ? 'json' : 'csv';
    onDataChange(val, format);
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

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const trimmed = text.trim();
      const format = (trimmed.startsWith('[') || trimmed.startsWith('{')) ? 'json' : 'csv';
      onDataChange(text, format);
      setActiveTab('paste'); // Go to paste tab to inspect raw content
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerSearchFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div id="data-importer-container" className="bg-density-card rounded-lg border border-density-border neon-glow-card overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-density-border bg-density-bg p-1 gap-1">
        <button
          id="tab-presets"
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-1 px-2 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeTab === 'presets'
              ? 'bg-density-accent/15 text-density-accent shadow-[0_0_12px_rgba(5,255,161,0.2)] border border-density-accent/40'
              : 'text-density-muted hover:text-density-text hover:bg-density-card/60'
          }`}
        >
          <Database size={12} />
          Presets
        </button>
        <button
          id="tab-paste"
          onClick={() => setActiveTab('paste')}
          className={`flex-1 py-1 px-2 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeTab === 'paste'
              ? 'bg-density-accent/15 text-density-accent shadow-[0_0_12px_rgba(5,255,161,0.2)] border border-density-accent/40'
              : 'text-density-muted hover:text-density-text hover:bg-density-card/60'
          }`}
        >
          <FileText size={12} />
          Raw Editor
        </button>
        <button
          id="tab-upload"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-1 px-2 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 flex items-center justify-center gap-1.5 ${
            activeTab === 'upload'
              ? 'bg-density-accent/15 text-density-accent shadow-[0_0_12px_rgba(5,255,161,0.2)] border border-density-accent/40'
              : 'text-density-muted hover:text-density-text hover:bg-density-card/60'
          }`}
        >
          <Upload size={12} />
          Upload
        </button>
      </div>

      <div className="p-3.5">
        {activeTab === 'presets' && (
          <div className="space-y-2.5">
            <span className="text-[9px] font-bold text-density-muted uppercase tracking-wider block">
              Quickly Load Sample Datasets
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {DATA_PRESETS.map((preset) => (
                <button
                  id={`preset-${preset.id}`}
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                  className={`p-2.5 text-left rounded-md border text-[11px] transition-all duration-200 leading-snug ${
                    selectedPresetId === preset.id
                      ? 'border-density-accent bg-density-accent/10 text-density-accent shadow-[0_0_15px_rgba(5,255,161,0.12)] ring-1 ring-density-accent/30'
                      : 'border-density-border bg-density-bg/30 text-density-muted hover:border-density-accent/40 hover:bg-density-bg/80 hover:text-density-text hover:shadow-[0_0_10px_rgba(5,255,161,0.05)]'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1 h-4 text-density-text">
                    {preset.name}
                  </div>
                  <p className="text-density-muted text-[10px] mt-0.5 font-normal leading-normal">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'paste' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-density-muted uppercase tracking-wider block">
                Edit CSV Rows or Plain JSON
              </span>
              <button 
                onClick={() => {
                  const preset = DATA_PRESETS.find(p => p.id === selectedPresetId);
                  if (preset) handlePresetSelect(preset);
                }}
                className="text-[9px] flex items-center gap-1 font-bold uppercase tracking-wide text-density-accent hover:text-emerald-300 transition-colors"
              >
                <RefreshCw size={10} /> Reset
              </button>
            </div>
            <textarea
              id="raw-data-textarea"
              value={pasteContent}
              onChange={handlePasteChange}
              spellCheck={false}
              className="w-full h-52 p-3 text-[11px] font-mono bg-density-bg text-density-text rounded-md border border-density-border focus:outline-hidden focus:ring-1 focus:ring-density-accent/40 focus:border-density-accent leading-normal overflow-auto"
              placeholder="Paste comma-separated data here...&#10;Date,Sign_Ups,Revenue&#10;2026-05-01,150,4500&#10;2026-05-02,230,6800"
            />
          </div>
        )}

        {activeTab === 'upload' && (
          <div
            id="drop-zone"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerSearchFile}
            className={`cursor-pointer group flex flex-col items-center justify-center p-6 border border-dashed rounded-md transition-all duration-250 ${
              dragActive 
                ? 'border-density-accent bg-density-accent/10 shadow-[0_0_20px_rgba(5,255,161,0.15)]' 
                : 'border-density-border bg-density-bg/20 hover:border-density-accent hover:bg-density-accent/5 hover:shadow-[0_0_15px_rgba(5,255,161,0.08)]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="h-8 w-8 flex items-center justify-center rounded-md bg-density-bg border border-density-border text-density-muted group-hover:bg-density-accent/15 group-hover:text-density-accent group-hover:border-density-accent/50 group-hover:shadow-[0_0_10px_rgba(5,255,161,0.3)] transition-all duration-250 mb-2 shadow-xs">
              <Upload size={14} />
            </div>
            <p className="text-[11px] font-bold text-density-text group-hover:text-density-accent transition-colors">
              Drag and drop your dataset here
            </p>
            <p className="text-[9px] text-density-muted mt-0.5">
              Supports CSV, JSON, TSV, log, and any other text data files
            </p>
            <button
              type="button"
              className="mt-3 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-density-accent bg-density-accent/10 hover:bg-density-accent/20 rounded border border-density-accent/20 neon-glow-button cursor-pointer"
            >
              Browse Files
            </button>
          </div>
        )}

        {/* Live Parse Feedback Status */}
        <div className="mt-3 pt-3 border-t border-density-border flex items-start gap-2">
          {parseError ? (
            <div className="flex gap-2 p-2 rounded-md bg-rose-950/25 border border-rose-900/40 text-rose-300 text-[11px] w-full">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-400" />
              <div className="space-y-0.5">
                <span className="font-bold uppercase tracking-wide text-rose-200 text-[10px]">Parse Error</span>
                <p className="text-rose-400/90 leading-normal">{parseError}</p>
              </div>
            </div>
          ) : parsedCount === 0 ? (
            <div className="flex gap-2 p-2 rounded-md bg-amber-950/25 border border-amber-900/40 text-amber-300 text-[11px] w-full">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-400" />
              <div className="space-y-0.5">
                <span className="font-bold uppercase tracking-wide text-amber-200 text-[10px]">Empty State</span>
                <p className="text-amber-400/90 leading-normal">No datasets parsed. Please input valid format values.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full p-2 rounded-md bg-density-accent/5 border border-density-accent/20 text-density-accent text-[11px]">
              <CheckCircle2 size={14} className="text-density-accent shrink-0" />
              <div className="flex-1 flex justify-between">
                <span>
                  Parsed <strong className="text-white font-mono">{parsedCount}</strong> rows & <strong className="text-white font-mono">{detectedColumnsCount}</strong> columns.
                </span>
                <span className="text-[9px] text-density-accent font-bold uppercase tracking-wider bg-density-accent/10 leading-none py-0.5 px-1 rounded-sm border border-density-accent/20">
                  READY
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
