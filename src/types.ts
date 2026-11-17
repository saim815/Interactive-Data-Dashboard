export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'radar';

export type DataType = 'string' | 'number' | 'boolean';

export type ColorTheme = 
  | 'indigo' 
  | 'emerald' 
  | 'amber' 
  | 'rose' 
  | 'ocean' 
  | 'monochrome'
  | 'teal_orange'
  | 'blue_amber'
  | 'purple_lime'
  | 'magenta_emerald'
  | 'crimson_cyan';

export interface ColumnInfo {
  name: string;
  type: DataType;
  isUniqueId: boolean;
}

export interface MetricStats {
  min: number;
  max: number;
  sum: number;
  avg: number;
  median: number;
  stdDev: number;
  count: number;
}

export interface ColumnStats {
  [columnName: string]: MetricStats;
}

export interface ChartConfig {
  chartType: ChartType;
  xAxisKey: string;
  yAxisKeys: string[];
  stacked: boolean;
  showGrid: boolean;
  showTooltip: boolean;
  curved: boolean;
  theme: ColorTheme;
  barLayout: 'vertical' | 'horizontal';
  height: number;
  customXAxisTitle?: string;
  customYAxisTitle?: string;
  customChartTitle?: string;
}

export interface PresetDataset {
  id: string;
  name: string;
  description: string;
  rawText: string;
  format: 'csv' | 'json';
}
