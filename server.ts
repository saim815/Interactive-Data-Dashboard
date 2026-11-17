import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Helper to sanitize field names nicely for presentation view titles
function cleanFieldName(key: string): string {
  if (!key) return "";
  return key
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy init Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined in environment variables. Server-side Gemini insights will fall back to local rule-based insights.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "dummy-key",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function robustParseNumberServer(val: any): number {
  if (typeof val === 'number') {
    return isNaN(val) ? NaN : val;
  }
  if (val === undefined || val === null) {
    return NaN;
  }
  
  let cleaned = String(val).trim();
  if (cleaned === '') return NaN;
  
  // Handle accounting parentheses: (123.4) -> -123.4
  let isNegative = false;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1).trim();
  }
  
  // Check for leading minus or trailing minus (e.g., 14.5-)
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
  
  // Double-verify internal leading minus (e.g., $-140)
  if (cleaned.startsWith('-')) {
    isNegative = !isNegative; // flip negative
    cleaned = cleaned.substring(1).trim();
  }

  if (cleaned === '') return NaN;
  const num = Number(cleaned);
  return isNaN(num) ? NaN : (isNegative ? -num : num);
}

// Rule-based analytic generator to explain statistical patterns in clear human English
function generateRuleBasedNarrative(data: any[], xAxisKey: string, yAxisKeys: string[], chartType: string): string {
  const safeXKey = xAxisKey || 'Index';
  const safeYKeys = Array.isArray(yAxisKeys) ? yAxisKeys : [];
  const safeChart = chartType || 'line';

  let narrative = `### 🏷️ Identified Visual Labels & Rationale\n`;
  narrative += `* **Recommended X-Axis Label**: \`${cleanFieldName(safeXKey)}\` (represents raw dimension \`${safeXKey}\`). Used to map sequential variations cleanly.\n`;
  narrative += `* **Recommended Y-Axis Label**: \`${safeYKeys.map(cleanFieldName).join(' & ')}\` (represents raw metrics \`${safeYKeys.join(', ')}\`). Used as quantitative scales.\n`;
  narrative += `* **Descriptive Chart Title**: \`${safeYKeys.map(cleanFieldName).join(' & ')} by ${cleanFieldName(safeXKey)} Trends\`\n\n`;
  narrative += `### 📊 Dynamic Core Analytics (Heuristic Modeling)\n\n`;
  narrative += `We successfully analyzed **${data.length} records** aligned against the **${safeXKey}** scale using a **${safeChart}** layout.\n\n`;

  if (safeYKeys.length === 0) {
    narrative += `*Please select at least one numeric series under the Graph Settings to output statistical narratives.*`;
    return narrative;
  }

  const insights: string[] = [];

  safeYKeys.forEach((key) => {
    // Collect numeric values corresponding to each Y coordinate
    const entries = data.map((item, i) => {
      const label = item[safeXKey] !== undefined && item[safeXKey] !== null && String(item[safeXKey]).trim() !== ''
        ? String(item[safeXKey])
        : `Point ${i + 1}`;
      
      const rawVal = item[key];
      const parsedNum = robustParseNumberServer(rawVal);

      return {
        x: label,
        y: parsedNum
      };
    }).filter(entry => !isNaN(entry.y));

    if (entries.length === 0) {
      insights.push(`#### 📈 Series: ${key}\n* **Coordinates**: Contains non-numeric values; statistical overview was excluded for this specific factor.`);
      return;
    }

    const values = entries.map(e => e.y);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    
    // Find min and max values with matching visual coordinates
    let maxEntry = entries[0];
    let minEntry = entries[0];
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].y > maxEntry.y) maxEntry = entries[i];
      if (entries[i].y < minEntry.y) minEntry = entries[i];
    }

    // Trend calculation comparing start and end records
    const startValue = entries[0].y;
    const endValue = entries[entries.length - 1].y;
    const diff = endValue - startValue;
    let trendWord = "stable / consistent";
    let pctStr = "";
    
    if (startValue !== 0) {
      const pct = (diff / Math.abs(startValue)) * 100;
      pctStr = ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
      if (pct > 5) trendWord = "growth pattern 📈";
      else if (pct < -5) trendWord = "downward retraction 📉";
    } else if (diff > 0) {
      trendWord = "upward pattern 📈";
    } else if (diff < 0) {
      trendWord = "downward shift 📉";
    }

    insights.push(`#### 📈 Series: ${key}
* **Trend & Directionality**: Shows a clean **${trendWord}** transitioning from \`${startValue.toLocaleString()}\` to \`${endValue.toLocaleString()}\`${pctStr} sequentially.
* **Maximum Output (Peak)**: Achieved of **${maxEntry.y.toLocaleString()}** situated at coordinate value \`${maxEntry.x}\`.
* **Minimum Point (Bottom)**: Dropped down to **${minEntry.y.toLocaleString()}** logged at coordinate value \`${minEntry.x}\`.
* **Benchmark Center**: Operating average hovers roughly around **${avg.toLocaleString(undefined, {maximumFractionDigits: 2})}** across the recorded samples.`);
  });

  narrative += insights.join("\n\n") + "\n\n";

  // Logical strategy insights
  narrative += `### 💡 Operational Takeaways\n`;
  if (safeYKeys.length > 1) {
    narrative += `* **Multivariate Relational Analysis**: You are currently overlapping **${safeYKeys.length} series** (${safeYKeys.join(', ')}). Analyze peak intersection coordinates to identify potential synchronicity or operational correlations.\n`;
  } else if (safeYKeys.length === 1) {
    narrative += `* **Univariate Tracking**: Isolating ${safeYKeys[0]} gives clean focused results. Consider dragging/selecting more numeric lines from Settings to study co-variance.\n`;
  }
  
  const midIndex = Math.floor(data.length / 2);
  const midCoord = data[midIndex]?.[safeXKey] || 'midpoint';
  narrative += `* **Anomaly Action Plan**: Pay special attention to coordinates near \`${midCoord}\`. Evaluate any external business factors, seasonal disruptions, or tracking shifts that occurred at that time.\n\n`;
  narrative += `--- \n`;
  narrative += `*⚡ Note: AI Studio free tier limits limit neural processing speeds occasionally. We seamlessly generated this rule-based analytical brief to ensure you have continuous explanation support!*`;

  return narrative;
}

// Simple memory cache to prevent spamming the Gemini API and conserve quota (max 20 requests/day limit)
interface CachedNarrative {
  isAI: boolean;
  summary: string;
  suggestedXTitle?: string;
  suggestedYTitle?: string;
  suggestedChartTitle?: string;
}
const geminiCache = new Map<string, CachedNarrative>();

// API endpoint for analyzing visual datasets / images via multimodal Gemini
app.post("/api/analyze-image", async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing uploaded image data." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "Gemini API key is missing. Please configure secrets to enable dynamic visual OCR and data parsing." });
    }

    // Standard supported multimodal formats in Gemini or PDF documents
    const supportedMimes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
    let finalMimeType = mimeType || "image/jpeg";

    if (!supportedMimes.includes(finalMimeType)) {
      if (image.startsWith("iVBORw0KGgo")) {
        finalMimeType = "image/png";
      } else if (image.startsWith("/9j/")) {
        finalMimeType = "image/jpeg";
      } else if (image.startsWith("UklGR")) {
        finalMimeType = "image/webp";
      } else {
        finalMimeType = "image/jpeg";
      }
    }

    const ai = getGeminiClient();

    const prompt = `You are an expert multimodal visual data analyst and presentation designer. 
The user has uploaded a visual image (such as a screenshot of a spreadsheet, database view, analytics dashboard, receipt, ledger, bar/line chart, infographic, or general photo).

Your goal is to:
1. Examine the image carefully. If it is a slide, screenshot, chart, or grid containing tabular/quantitative records: extract the real columns and rows with exact numeric values into "extractedData" and define their schemas inside "extractedColumns".
2. If it is a generic photo, poster, scenery, or screenshot without concrete data grids: generate a structured numerical trend tracking different visual categories/components, pixilation density, colors intensity, or objects detected in sequence, so we can draw a beautiful quantitative plot representing the image (e.g. tracking key scenery features or object groupings).
3. Recommend the perfect Chart Type (one of: 'line', 'bar', 'area', 'pie', 'radar').
4. Map the independent variable column name as "recommendedXAxisKey", and find the primary tracking metrics for "recommendedYAxisKeys" (1 to 2 series).
5. Suggest presentation-ready, beautiful English custom labels for:
   - "suggestedXTitle": A clean axis label describing the domain scale clearly (e.g. "Monthly Interval" or "Identified Subject Category").
   - "suggestedYTitle": A clean axis label for the measurements (e.g. "Relative Frequency / Value" or "Revenue ($ USD)").
   - "suggestedChartTitle": A highly descriptive, tailored main title capturing what this visual data model conveys. DO NOT make it a generic string. Use information from the image (e.g., "extracted Customer Trends" or "Marketing Performance Graph Extraction").
6. Provide an elegant, comprehensive Markdown narrative and insights block ("story") in clean, fluent natural English explaining:
   - What the uploaded image is and what it represents.
   - The primary trends, peak milestones, key numbers, and anomalies you extracted.
   - Any professional business/strategy takeaways or decisions.
   - A short explanation of how you mapped the extracted metrics to the visual chart coordinates.
   - Make the storytelling friendly, objective, structured, and completely clear of any binary or parsing telemetry.

Return a raw JSON object matching this schema exactly:`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: finalMimeType,
            data: image
          }
        },
        {
          text: prompt
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extractedData: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                description: "Key-value mapping of field names to values. Numeric values must be numbers."
              },
              description: "Array of extracted data points (minimum 3 records)."
            },
            extractedColumns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, description: "Must be: string or number." },
                  isUniqueId: { type: Type.BOOLEAN }
                },
                required: ["name", "type", "isUniqueId"]
              }
            },
            recommendedChartType: {
              type: Type.STRING,
              description: "Must be exactly: line, bar, area, pie, or radar."
            },
            recommendedXAxisKey: {
              type: Type.STRING
            },
            recommendedYAxisKeys: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            suggestedChartTitle: {
              type: Type.STRING
            },
            suggestedXTitle: {
              type: Type.STRING
            },
            suggestedYTitle: {
              type: Type.STRING
            },
            story: {
              type: Type.STRING,
              description: "Markdown report in plain English explaining the details extracted from the image."
            }
          },
          required: [
            "extractedData",
            "extractedColumns",
            "recommendedChartType",
            "recommendedXAxisKey",
            "recommendedYAxisKeys",
            "suggestedChartTitle",
            "suggestedXTitle",
            "suggestedYTitle",
            "story"
          ]
        }
      }
    });

    const responseText = response.text || "{}";
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText.trim());
    } catch (parseErr) {
      console.error("Failed to parse visual intelligence output from Gemini JSON response", parseErr);
      return res.status(500).json({ error: "Gemini extracted data but the response shape was non-standard. Please try again." });
    }

    return res.json(parsedResponse);
  } catch (error: any) {
    console.error("[Multimodal visual analysis error]", error?.message || error);
    return res.status(500).json({ error: error.message || "Failed to process image data." });
  }
});

// API endpoint for analyzing data and communicating it in natural English
app.post("/api/analyze-data", async (req, res) => {
  try {
    const { data, xAxisKey, yAxisKeys, chartType } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Missing or invalid dataset." });
    }

    const safeXKey = xAxisKey || 'Index';
    const safeYKeys = Array.isArray(yAxisKeys) ? yAxisKeys : [];
    const safeChart = chartType || 'line';

    // Construct a lightweight unique key representing the current visualization settings and data shape
    const firstRowPart = JSON.stringify(data[0] || 'empty');
    const lastRowPart = JSON.stringify(data[data.length - 1] || 'empty');
    const cacheKey = `${safeXKey}:${safeYKeys.sort().join(',')}:${safeChart}:${data.length}:${firstRowPart}:${lastRowPart}`;

    // Return the cached result immediately if it exists in memory
    if (geminiCache.has(cacheKey)) {
      return res.json(geminiCache.get(cacheKey));
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Rule-based fallback summary if no API key is set
      const localNarrative = generateRuleBasedNarrative(data, safeXKey, safeYKeys, safeChart);
      const resultObj: CachedNarrative = {
        isAI: false,
        summary: localNarrative,
        suggestedXTitle: cleanFieldName(safeXKey),
        suggestedYTitle: safeYKeys.map(cleanFieldName).join(' & '),
        suggestedChartTitle: `${safeYKeys.map(cleanFieldName).join(' & ')} by ${cleanFieldName(safeXKey)} Trends`
      };
      geminiCache.set(cacheKey, resultObj);
      return res.json(resultObj);
    }

    // Limit data sent to Gemini to keep it fast and prevent token bloat
    const sampleData = data.slice(0, 100).map(row => {
      const cleanItem: any = {};
      cleanItem[safeXKey] = row[safeXKey];
      safeYKeys.forEach(key => {
        cleanItem[key] = row[key];
      });
      return cleanItem;
    });

    const prompt = `You are an expert data analyst. The user has uploaded a dataset and is visualizing it using a ${safeChart} chart.
We have selected '${safeXKey}' as the X-Axis and the following series as the Y-Axis: ${safeYKeys.join(', ')}.

Here is a sample of the structured dataset (up to first 100 records) to analyze:
${JSON.stringify(sampleData, null, 2)}

Your goal is to perform a detailed analysis of the dataset AND recommend highly professional, unique, and context-specific labels and titles for this visualization.
The titles shouldn't just be the raw column headers; they should look polished, clear, and presentation-ready (for example, if X is 'Date' or 'day', recommend something like 'Timeline (Daily Interval)' or 'Reporting Period'. If Y is 'Sign_Ups', recommend something like 'New Member Sign-Ups' or 'Total Registrations').
The overall chart title should be highly descriptive and relate to the visual insights from the data (for example, 'Customer Monetization & Growth Analysis Q2' or 'Campaign Sign-Up Performance').

You must return a raw JSON object containing these 4 fields:
1. "summary": A beautiful, highly intelligent Markdown narrative summary. IMPORTANT Directive: You MUST start the summary with a short, beautifully formatted section titled "### 🏷️ Identified Visual Labels & Rationale". In this section, clearly state the EXACT, descriptive titles you have identified and recommended for the X-axis, the Y-axis, and the overall Chart, alongside a 1-sentence analytical reason why these exact label suggestions fit the values and intervals shown in the dataset. Then, proceed with the key trends, peaks, anomalies, outliers, and business insights.
2. "suggestedXTitle": A professional, non-generic title for the X-axis based on the column name and data values.
3. "suggestedYTitle": A professional, non-generic title for the Y-axis based on the column name(s) and data values.
4. "suggestedChartTitle": A descriptive, professional main title for the whole chart that relates to what the uploaded data conveys.`;

    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: "Markdown data analysis summary of trends, outliers and business conclusions."
              },
              suggestedXTitle: {
                type: Type.STRING,
                description: "A tailored, descriptive name for the X axis (e.g. 'Timeline (Daily Interval)') based on raw field name and values."
              },
              suggestedYTitle: {
                type: Type.STRING,
                description: "A tailored, descriptive name for the mapped Y axes (e.g. 'Daily Revenue ($ USD)') based on raw field name and values."
              },
              suggestedChartTitle: {
                type: Type.STRING,
                description: "A gorgeous, descriptive, context-specific main title for the entire chart dashboard representing what the uploaded data means."
              }
            },
            required: ["summary", "suggestedXTitle", "suggestedYTitle", "suggestedChartTitle"]
          }
        }
      });

      const responseText = response.text || "{}";
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText.trim());
      } catch (err) {
        console.warn("Could not parse output as JSON, returning fallback raw format.", err);
        parsedResponse = {
          summary: responseText || "No summary generated from Gemini.",
          suggestedXTitle: cleanFieldName(safeXKey),
          suggestedYTitle: safeYKeys.map(cleanFieldName).join(" & "),
          suggestedChartTitle: `${safeYKeys.map(cleanFieldName).join(' & ')} by ${cleanFieldName(safeXKey)} Analysis`
        };
      }

      const resultObj: CachedNarrative = {
        isAI: true,
        summary: parsedResponse.summary || responseText,
        suggestedXTitle: parsedResponse.suggestedXTitle || cleanFieldName(safeXKey),
        suggestedYTitle: parsedResponse.suggestedYTitle || safeYKeys.map(cleanFieldName).join(" & "),
        suggestedChartTitle: parsedResponse.suggestedChartTitle || `${safeYKeys.map(cleanFieldName).join(' & ')} by ${cleanFieldName(safeXKey)} Analysis`
      };
      geminiCache.set(cacheKey, resultObj);
      return res.json(resultObj);
    } catch (apiError: any) {
      // Quietly log the exception message to prevent flooding the log with heavy JSON tracebacks and stack errors
      const errorMessage = apiError?.message || String(apiError);
      const isQuotaExceeded = errorMessage.includes("Quota exceeded") || errorMessage.includes("429");
      
      console.log(`[Gemini API Info] Call reverted to rule-based fallback. Reason: ${isQuotaExceeded ? "Rate Limit/Quota (429) hit" : errorMessage}`);
      
      const localNarrative = generateRuleBasedNarrative(data, safeXKey, safeYKeys, safeChart);
      const warningContext = isQuotaExceeded 
        ? `\n\n*(💡 Notice: Gemini API daily rate limit was reached. We automatically built this rich heuristic analytical brief to ensure you have continuous explanation support!)*`
        : `\n\n*(💡 Notice: Gemini service was unavailable: ${errorMessage.slice(0, 150)}. Fell back to dynamic rules output!)*`;

      const fallbackResult: CachedNarrative = {
        isAI: false,
        summary: localNarrative + warningContext,
        suggestedXTitle: cleanFieldName(safeXKey),
        suggestedYTitle: safeYKeys.map(cleanFieldName).join(' & '),
        suggestedChartTitle: `${safeYKeys.map(cleanFieldName).join(' & ')} by ${cleanFieldName(safeXKey)} Trends`
      };
      
      // Cache the local fallback temporarily too, so that we don't spam the API again immediately on fast component re-renders
      geminiCache.set(cacheKey, fallbackResult);
      return res.json(fallbackResult);
    }
  } catch (error: any) {
    console.log("[Data analysis error]", error?.message || error);
    res.status(500).json({ error: error.message || "Failed to analyze data." });
  }
});

// Local rule-based fallback storyteller
function generateLocalStory(data: any[], columns: any[]): any {
  const numCols = columns.filter((c: any) => c.type === 'number').map((c: any) => c.name);
  const strCols = columns.filter((c: any) => c.type === 'string').map((c: any) => c.name);

  const bestX = strCols.find((name: string) => 
    name.toLowerCase().includes('date') || 
    name.toLowerCase().includes('day') || 
    name.toLowerCase().includes('name') || 
    name.toLowerCase().includes('region') || 
    name.toLowerCase().includes('campaign')
  ) || columns[0]?.name || '';

  const bestY = numCols.slice(0, 2);
  const chartType = bestX.toLowerCase().includes('region') || bestX.toLowerCase().includes('campaign') ? 'bar' : 'line';

  const title = `${bestY.map(cleanFieldName).join(' & ')} by ${cleanFieldName(bestX)} Overview`;
  
  const story = `### 📖 Dataset Analytical Overview
Welcome to your auto-generated dataset story!

After reviewing the structure of your uploaded file, we detected **${columns.length} active dimensions** mapped across **${data.length} records**.

* **Independent Axis**: We selected **${cleanFieldName(bestX)}** (\`${bestX}\`) to serve as the baseline scale for this graph.
* **Plotted Metrics**: We plotted **${bestY.map(cleanFieldName).join(' and ')}** as key indicators.
* **Layout Pairing**: A **${chartType} chart** was chosen to best illustrate these visual groupings.

#### 🎯 Strategic Action Plan
1. **Explore Trends**: Evaluate sequential shifts on your graph as coordinates progress.
2. **Review Highlights**: Look for peak anomalies or intersections in the active plotted variables.
3. **Verify Values**: Expand the Worksheet section below to check individual cells.`;

  return {
    recommendedChartType: chartType,
    recommendedXAxisKey: bestX,
    recommendedYAxisKeys: bestY,
    suggestedChartTitle: title,
    suggestedXTitle: cleanFieldName(bestX),
    suggestedYTitle: bestY.map(cleanFieldName).join(' & '),
    story: story
  };
}

// API endpoint for analyzing data structure and returning the ideal dashboard config and storytelling context
app.post("/api/recommend-config", async (req, res) => {
  try {
    const { data, columns } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Missing or invalid dataset." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallback = generateLocalStory(data, columns);
      return res.json(fallback);
    }

    // Limit data sample to keeps it ultra fast and within token limits
    const sampleData = data.slice(0, 50);

    const prompt = `You are a world-class professional visual data analyst, designer, and data-storyteller.
The user has just uploaded a brand new dataset with columns:
${JSON.stringify(columns, null, 2)}

Sample of the records (first 50):
${JSON.stringify(sampleData, null, 2)}

Your absolute highest goal is to analyze what this dataset is truly about (the underlying business or research story), and determine the optimal visual layout for illustrating it.

You must choose:
1. The most logical independent X Axis key from the columns list (often a date, category name, region, timeline, or timestamp).
2. The list of the most meaningful Y Axis coordinate keys (1 to 3 numeric variables to graph).
3. The ideal visual chart type: one of "line", "bar", "area", "pie", "radar".
   - Use "line" for sequential continuous trends or timelines.
   - Use "bar" for categorized comparisons or names.
   - Use "area" for stackable numeric volumes.
   - Use "pie" only for percentage slices or small relative parts of a whole.
   - Use "radar" for multivariate profile comparisons.
4. A highly descriptive, presentation-ready Main Chart Title (e.g., 'E-Commerce Subscription Gross Revenue Trends' or 'Campaign Active Sign-Ups Performance').
5. Professional Axis Labels for X and Y axes.
6. A beautiful, engaging Narrative Story (written directly to the user in conversational, friendly English) explaining:
   - What this dataset represents or measures (e.g. business operations, software logs, fitness metrics, grade distribution, etc.).
   - The real-world context and importance of this data story.
   - Why you configured the graph this way (why the X and Y axes correspond to each other).
   - What the user should look for when exploring this data.
   Write this narrative story in beautiful Markdown. Bold key highlights and use elegant paragraphs or bullet points where applicable.

You must return a raw JSON object matching this structure exactly:
{
  "recommendedChartType": "line",
  "recommendedXAxisKey": "RawColumnNameForX",
  "recommendedYAxisKeys": ["RawColumnNameForY1", "RawColumnNameForY2"],
  "suggestedChartTitle": "Descriptive Chart Title",
  "suggestedXTitle": "Friendly X Axis Title",
  "suggestedYTitle": "Friendly Y Axis Title",
  "story": "A beautiful, captivating overview of what this data is, its business context and goals..."
}
`;

    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendedChartType: {
                type: Type.STRING,
                description: "Must be exactly: line, bar, area, pie, or radar."
              },
              recommendedXAxisKey: {
                type: Type.STRING,
                description: "The name of the column for the independent X axis."
              },
              recommendedYAxisKeys: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "1 to 3 raw column names for the numerical Y values."
              },
              suggestedChartTitle: {
                type: Type.STRING,
                description: "A beautiful, corporate-ready main header for the chart."
              },
              suggestedXTitle: {
                type: Type.STRING,
                description: "A friendly, custom name for the X axis."
              },
              suggestedYTitle: {
                type: Type.STRING,
                description: "A friendly, custom name for the Y axis series."
              },
              story: {
                type: Type.STRING,
                description: "An elegant Markdown data story describing the dataset meaning and why the chart was chosen."
              }
            },
            required: [
              "recommendedChartType",
              "recommendedXAxisKey",
              "recommendedYAxisKeys",
              "suggestedChartTitle",
              "suggestedXTitle",
              "suggestedYTitle",
              "story"
            ]
          }
        }
      });

      const responseText = response.text || "{}";
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText.trim());
      } catch (err) {
        console.warn("Could not parse recommend-config output as JSON, returning fallback raw format.", err);
        parsedResponse = generateLocalStory(data, columns);
      }

      // Ensure keys recommended actually exist in columns, otherwise use fallback
      const colNames = columns.map((c: any) => c.name);
      if (!colNames.includes(parsedResponse.recommendedXAxisKey)) {
        parsedResponse.recommendedXAxisKey = columns[0]?.name || '';
      }
      parsedResponse.recommendedYAxisKeys = (parsedResponse.recommendedYAxisKeys || []).filter((k: string) => colNames.includes(k));
      if (parsedResponse.recommendedYAxisKeys.length === 0) {
        const numCol = columns.find((c: any) => c.type === 'number');
        parsedResponse.recommendedYAxisKeys = numCol ? [numCol.name] : [];
      }

      return res.json(parsedResponse);
    } catch (apiError: any) {
      console.log(`[Gemini recommend-config API Info] Reverted to local fallback: ${apiError?.message || apiError}`);
      const fallback = generateLocalStory(data, columns);
      return res.json(fallback);
    }
  } catch (error: any) {
    console.log("[Recommend config error]", error?.message || error);
    res.status(500).json({ error: error.message || "Failed to recommend configuration." });
  }
});

// Serve static assets or mount Vite dev middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start full-stack server:", err);
});
