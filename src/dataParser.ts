import { ColumnInfo, DataType, ColumnStats, MetricStats } from './types';

/**
 * Sanitizes header names to remove non-ascii / non-printable characters.
 * Prevents raw binary metadata segments (e.g. Photoshop markers, JFIF blocks)
 * from being parsed as valid column headers.
 */
export function sanitizeHeader(str: string): string {
  if (!str) return '';
  let cleaned = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Standard ASCII printable range: space (32) to tilde (126)
    if (code >= 32 && code <= 126) {
      cleaned += str[i];
    }
  }
  // Condense spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Exclude signatures from standard graphics or layout properties
  if (cleaned === '' || /Photoshop|8BIM|JFIF|Exif|Adobe|ÿ|‰/i.test(cleaned)) {
    return 'Label_Dimension';
  }
  return cleaned;
}

/**
 * Removes raw binary / non-printable markers from individual cell text strings.
 */
export function sanitizeValueString(str: string): string {
  if (typeof str !== 'string') return str;
  let cleaned = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      cleaned += str[i];
    }
  }
  return cleaned.trim();
}

/**
 * Detects if the provided text string is raw binary output (e.g. from an image or archive)
 * rather than parsed-friendly comma-separated table text or JSON fields.
 */
export function isBinaryOrImageContent(text: string): boolean {
  if (!text) return false;
  
  const trimmed = text.trim();
  if (trimmed === '') return false;

  // JSON arrays/objects or apparent XML elements should never be classified as binary
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || (trimmed.startsWith('<') && trimmed.endsWith('>'))) {
    return false;
  }

  // 1. Check common binary headers/magic-strings (such as RIFF/WEBP, GIF, PNG, JPEG, PDF, ZIP)
  if (trimmed.startsWith('RIFF') && trimmed.includes('WEBP')) {
    return true;
  }
  // PNG: first character is usually byte \x89 (137) followed by "PNG"
  if (trimmed.startsWith('‰PNG') || trimmed.startsWith('\x89PNG') || trimmed.startsWith('\u0089PNG') || trimmed.slice(0, 10).includes('PNG')) {
    if (trimmed.startsWith('‰') || trimmed.startsWith('\x89') || trimmed.startsWith('\u0089')) {
      return true;
    }
  }
  // JPEG / EXIF headers
  if (trimmed.startsWith('\xFF\xD8\xFF') || trimmed.startsWith('ÿØÿ') || trimmed.includes('Exif\x00\x00')) {
    return true;
  }
  // GIF
  if (trimmed.startsWith('GIF89a') || trimmed.startsWith('GIF87a')) {
    return true;
  }
  // ZIP / files wrapped in PK container (JAR, docx, xlsx, zip)
  if (trimmed.startsWith('PK\x03\x04') || trimmed.startsWith('PK\u0003\u0004')) {
    return true;
  }
  // Adobe PDF
  if (trimmed.startsWith('%PDF')) {
    return true;
  }

  // Calculate percentage of control or undecodable characters
  // In binary files decoded as text, we get a substantial amount of control bytes (0-31 range, except tab, newline, carriage return)
  // or a lot of Unicode Replacement Characters (\uFFFD) indicating decoding failure.
  const sampleLength = Math.min(text.length, 1200);
  if (sampleLength === 0) return false;

  let nullChars = 0;
  let controlChars = 0;
  let replacementChars = 0;

  for (let i = 0; i < sampleLength; i++) {
    const code = text.charCodeAt(i);
    if (code === 0) {
      nullChars++;
    } else if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      // Ignore whitespace formatting: tab(9), newline(10), vertical-tab(11), carriage-return(13)
      controlChars++;
    }
    // Unicode Replacement Character (U+FFFD) is highly symptomatic of reading binary data
    if (code === 0xFFFD) {
      replacementChars++;
    }
  }

  // If alternating null bytes occur (UTF-16 encoding, etc.), we treat it as text rather than raw random binary
  const looksLikeUtf16 = sampleLength >= 10 && (nullChars / sampleLength > 0.35);
  if (looksLikeUtf16) {
    return false;
  }

  // If standard raw control characters represent more than 15% of the file's content, 
  // or replacement characters represent more than 20% of the sample, it's highly likely to be true binary data.
  const controlRatio = controlChars / sampleLength;
  const nullRatio = nullChars / sampleLength;
  const replacementRatio = replacementChars / sampleLength;

  if (nullRatio > 0.1 || controlRatio > 0.15 || replacementRatio > 0.2) {
    return true;
  }

  return false;
}

/**
 * Converts any generic text or raw binary string stream into a highly structured, 
 * scientifically interesting dataset (e.g., Signal Density, Entropy map, or frequency histogram). This allows 
 * users to upload images, zips, or arbitrary binary data and still visualize meaningful, valid mathematical charts.
 */
export function parseBinaryToDataset(text: string, filename: string = 'Binary File'): any[] {
  if (!text) return [];

  // Generate a multi-metric signal profile of the binary space.
  // To keep the chart beautifully responsive and representative, we analyze up to 100 blocks.
  const numBlocks = 100;
  const blockSize = Math.max(1, Math.floor(text.length / numBlocks));
  const result: any[] = [];

  for (let b = 0; b < numBlocks; b++) {
    const startIdx = b * blockSize;
    const endIdx = Math.min(text.length, startIdx + blockSize);
    if (startIdx >= text.length) break;

    let sum = 0;
    let min = 255;
    let max = 0;
    const freqs = new Array(256).fill(0);

    for (let i = startIdx; i < endIdx; i++) {
      const code = text.charCodeAt(i) & 255; // clamp to 8-bit byte-like domain
      sum += code;
      if (code < min) min = code;
      if (code > max) max = code;
      freqs[code]++;
    }

    const count = endIdx - startIdx;
    const average = count > 0 ? sum / count : 0;

    // Calculate block-level Shannon Entropy to show visual information density
    let entropy = 0;
    for (let c = 0; c < 256; c++) {
      if (freqs[c] > 0) {
        const p = freqs[c] / count;
        entropy -= p * Math.log2(p);
      }
    }

    // Hex offset label
    const hexOffset = '0x' + startIdx.toString(16).toUpperCase().padStart(4, '0');
    const percentProgress = Math.round((b / numBlocks) * 100);

    result.push({
      'File Offset': hexOffset,
      'Progress %': percentProgress,
      'Signal Amplitude': parseFloat(average.toFixed(2)),
      'Entropy Density': parseFloat(entropy.toFixed(3)),
      'Max Intensity': max,
      'Min Intensity': min,
      'Range Delta': max - min
    });
  }

  return result;
}

/**
 * Robustly parses a string into a number by stripping common formatters
 * like currency symbols, trailing percentage signs, commas, and spaces.
 */
export function robustParseNumber(str: string): number | null {
  let cleaned = str.trim();
  
  if (cleaned === '') return null;
  
  // Handle accounting negative format: (123.4) -> -123.4
  let isNegative = false;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1).trim();
  }
  
  // Check for leading minus sign or trailing minus sign (e.g., 14.25-)
  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.substring(1).trim();
  } else if (cleaned.endsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(0, -1).trim();
  }
  
  // Strip thousands separators
  cleaned = cleaned.replace(/,/g, '');
  
  // Strip leading spaces, currency markers, plus signs
  cleaned = cleaned.replace(/^[\s$€£¥+]+/, '').trim();
  
  // Strip trailing spaces and percentages
  cleaned = cleaned.replace(/[\s%]+$/, '').trim();
  
  // Double-verify internal leading minus inside leftover bounds (e.g. $-140)
  if (cleaned.startsWith('-')) {
    isNegative = !isNegative; // flip negative
    cleaned = cleaned.substring(1).trim();
  }

  if (cleaned === '') return null;
  const num = Number(cleaned);
  if (isNaN(num)) return null;
  
  return isNegative ? -num : num;
}

/**
 * Automatically detects the field delimiter character from the first non-empty line of text.
 */
function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return ',';
  const firstLine = lines[0];
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = 0;
  for (const c of candidates) {
    let count = 0;
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === c) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return bestCount > 0 ? best : ',';
}

/**
 * Parses a standard CSV string into an array of objects.
 * Autodetects delimiters (comma, semicolon, tab, or pipe) and cleans the header line index.
 */
export function parseCSV(csvText: string): any[] {
  if (!csvText || csvText.trim() === '') return [];

  let cleanedText = csvText;
  if (cleanedText.startsWith('\uFEFF')) {
    cleanedText = cleanedText.slice(1);
  }

  const delimiter = detectDelimiter(cleanedText);
  const lines = cleanedText.split(/\r?\n/);
  const result: any[] = [];
  
  if (lines.length === 0) return [];
  
  // Find first non-empty line as header (ignoring comments)
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed !== '' && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  // Parse header
  const headers = parseCSVLine(lines[headerIndex], delimiter).map(h => {
    let s = h.trim();
    // Strip leading/trailing double or single quotes if they wrap the entire header name
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
    else if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1);
    return sanitizeHeader(s.trim());
  });
  if (headers.length === 0) return [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#') || line.startsWith('//')) continue; // Skip empty rows and comments
    
    const values = parseCSVLine(lines[i], delimiter);
    const rowObject: any = {};
    
    headers.forEach((header, index) => {
      if (header === '') return;
      
      let rawVal = values[index] !== undefined ? values[index].trim() : '';
      
      // Strip leading/trailing double or single quotes if they wrap the entire field value
      if (rawVal.startsWith('"') && rawVal.endsWith('"')) rawVal = rawVal.slice(1, -1);
      else if (rawVal.startsWith("'") && rawVal.endsWith("'")) rawVal = rawVal.slice(1, -1);
      rawVal = rawVal.trim();
      
      // Attempt to infer type
      if (rawVal === '') {
        rowObject[header] = null;
      } else if (rawVal.toLowerCase() === 'true') {
        rowObject[header] = true;
      } else if (rawVal.toLowerCase() === 'false') {
        rowObject[header] = false;
      } else {
        const parsedNum = robustParseNumber(rawVal);
        if (parsedNum !== null) {
          rowObject[header] = parsedNum;
        } else {
          rowObject[header] = sanitizeValueString(rawVal);
        }
      }
    });
    
    result.push(rowObject);
  }

  return result;
}

/**
 * Parses a single CSV line, respecting double-quoted values.
 */
function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Parses a JSON string which should be a flat array of objects,
 * or wraps alternative structures gracefully, scanning for nested data arrays.
 */
export function parseJSON(jsonText: string): any[] {
  if (!jsonText || jsonText.trim() === '') return [];

  try {
    const parsed = JSON.parse(jsonText.trim());
    let rawList: any[] = [];
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      // If there is any nested array of objects inside (e.g. { "data": [ ... ] } or { "rows": [ ... ] })
      const keys = Object.keys(parsed);
      let foundArray = false;
      for (const k of keys) {
        const val = parsed[k];
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          rawList = val;
          foundArray = true;
          break;
        }
      }
      if (!foundArray) {
        rawList = [parsed];
      }
    } else {
      return [];
    }

    // Sanitize any binary traces from JSON keys or text levels
    return rawList.map(item => {
      if (typeof item !== 'object' || item === null) return item;
      const cleanItem: any = {};
      Object.keys(item).forEach(k => {
        const cleanKey = sanitizeHeader(k);
        if (cleanKey === '') return;
        const val = item[k];
        if (typeof val === 'string') {
          cleanItem[cleanKey] = sanitizeValueString(val);
        } else {
          cleanItem[cleanKey] = val;
        }
      });
      return cleanItem;
    });
  } catch (error) {
    console.error('JSON Parse error:', error);
    return [];
  }
}

/**
 * Automagically checks dataset and extracts column metadata.
 */
function isPlaceholderString(val: any): boolean {
  if (typeof val !== 'string') return false;
  const s = val.trim().toLowerCase();
  return s === '' || s === 'n/a' || s === 'na' || s === 'nan' || s === '-' || s === 'null' || s === 'nil' || s === 'empty' || s === 'none' || s === 'undefined';
}

/**
 * Automagically checks dataset and extracts column metadata.
 */
export function detectColumns(data: any[]): ColumnInfo[] {
  if (!data || data.length === 0) return [];

  // Gather all unique keys across all records (to support sparse schema parsed)
  const keyMap: { [key: string]: { counts: { [type in DataType]: number } } } = {};

  data.forEach(row => {
    if (typeof row !== 'object' || row === null) return;
    Object.keys(row).forEach(key => {
      const val = row[key];
      if (val === null || val === undefined) return;

      if (!keyMap[key]) {
        keyMap[key] = { counts: { string: 0, number: 0, boolean: 0 } };
      }

      const rawType = typeof val;
      if (rawType === 'number') {
        keyMap[key].counts.number++;
      } else if (rawType === 'boolean') {
        keyMap[key].counts.boolean++;
      } else if (!isPlaceholderString(val)) {
        keyMap[key].counts.string++;
      }
    });
  });

  const columns: ColumnInfo[] = Object.keys(keyMap).map(name => {
    const counts = keyMap[name].counts;
    let type: DataType = 'string';

    // Smarter vote: if we have valid numbers and they equal or exceed the true string count, it's a number column
    if (counts.number > 0 && counts.number >= counts.string && counts.number >= counts.boolean) {
      type = 'number';
    } else if (counts.boolean > 0 && counts.boolean >= counts.string && counts.boolean >= counts.number) {
      type = 'boolean';
    }

    // Rough heuristic for ID: strings with name "id" or high unique ratio
    const values = data.map(r => r[name]).filter(v => v !== null && v !== undefined);
    const uniqueValues = new Set(values);
    const isUniqueId = name.toLowerCase() === 'id' || 
                        (type === 'string' && uniqueValues.size === data.length && data.length > 2);

    return {
      name,
      type,
      isUniqueId
    };
  });

  return columns;
}

/**
 * Dynamic statistical analyzer for numerical columns.
 */
export function calculateColumnStats(data: any[], columns: ColumnInfo[]): ColumnStats {
  const stats: ColumnStats = {};

  columns.forEach(col => {
    if (col.type !== 'number') return;

    // Filter valid numbers
    const values = data
      .map(row => row[col.name])
      .filter(val => typeof val === 'number' && !isNaN(val)) as number[];

    if (values.length === 0) return;

    // Computations
    const count = values.length;
    let min = values[0];
    let max = values[0];
    let sum = 0;

    values.forEach(v => {
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    });

    const avg = sum / count;

    // Median
    const sorted = [...values].sort((a, b) => a - b);
    const midIdx = Math.floor(count / 2);
    const median = count % 2 !== 0 
      ? sorted[midIdx] 
      : (sorted[midIdx - 1] + sorted[midIdx]) / 2;

    // Standard deviation
    const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    stats[col.name] = {
      min,
      max,
      sum,
      avg,
      median,
      stdDev,
      count
    };
  });

  return stats;
}
