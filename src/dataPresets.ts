import { PresetDataset } from './types';

export const DATA_PRESETS: PresetDataset[] = [
  {
    id: 'web-analytics',
    name: '🚀 Web Traffic & Conversions',
    description: 'Weekly website user actions, bounce rate, and sign-ups over time.',
    format: 'csv',
    rawText: `Date,Page_Views,Unique_Visits,Sign_Ups,Bounce_Rate
2026-05-01,15200,8400,320,42.5
2026-05-02,16400,9100,410,40.1
2026-05-03,14800,8100,290,44.8
2026-05-04,18900,10500,490,38.2
2026-05-05,21200,12100,580,35.9
2026-05-06,24500,14300,710,33.4
2026-05-07,22100,12900,640,36.2
2026-05-08,19800,11200,530,37.8
2026-05-09,17300,9800,390,41.2
2026-05-10,16900,9400,350,42.0
2026-05-11,20400,11800,520,38.0
2026-05-12,23100,13200,610,35.1
2026-05-13,25900,15400,780,32.8
2026-05-14,24200,14100,690,34.5`
  },
  {
    id: 'sales-regions',
    name: '💰 Regional Sales Performance',
    description: 'Quarterly hardware sales revenue breakdown by international markets.',
    format: 'csv',
    rawText: `Region,Q1_Revenue,Q2_Revenue,Q3_Revenue,Q4_Revenue
North America,240000,285000,310000,395000
Europe,195000,210000,245000,320000
Asia-Pacific,310000,340000,385000,460000
Latin America,85000,98000,112000,145000
Middle East & Africa,62000,71000,78000,99000`
  },
  {
    id: 'campaign-roi',
    name: '📣 Digital Ads ROI Analysis',
    description: 'Marketing campaign performance, ad spend, and resulting absolute sales.',
    format: 'csv',
    rawText: `Campaign,Ad_Spend,Conversions,Acquisition_Cost,Revenue,ROI_Percent
Social Ads Alpha,4500,310,14.5,12400,175.5
Search Intent Beta,7200,480,15.0,19800,175.0
Video Pre-roll Gamma,12000,560,21.4,24500,104.1
Newsletter Delta,1500,190,7.9,5200,246.6
Influencer Outreach Epsilon,5000,240,20.8,9100,82.0
Retargeting Zeta,3200,290,11.0,11800,268.7`
  },
  {
    id: 'fitness-tracker',
    name: '🏃 Personal Fitness Tracker',
    description: 'Daily activity metrics including step counts, calories, and duration.',
    format: 'csv',
    rawText: `Day,Steps,Calories,Active_Minutes,Sleep_Hours
Monday,8450,2100,35,7.2
Tuesday,10200,2400,48,6.8
Wednesday,6120,1850,20,7.5
Thursday,11400,2600,62,6.5
Friday,9300,2250,42,7.0
Saturday,14100,3100,95,8.2
Sunday,12500,2800,80,8.0`
  }
];
