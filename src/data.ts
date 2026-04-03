import Papa from 'papaparse';

// ── Types ──

export interface ConfidenceTagged {
  value: string;
  confidence: 'confident' | 'likely' | 'speculative' | null;
}

export interface SourceLink {
  title: string;
  url: string;
}

export interface DataCenterProperties {
  name: string;
  owner: string;
  owner_confidence: string | null;
  users: string[];
  users_detail: ConfidenceTagged[];
  h100_equivalents: number;
  power_mw: number;
  capital_cost_b: number;
  status: 'operational' | 'planned';
  country: string;
  address: string;
  project: ConfidenceTagged;
  investors: string;
  construction_companies: string;
  energy_companies: string;
  notes: string;
  sources: SourceLink[];
  sources_raw: string;
}

export interface DataCenterFeature extends GeoJSON.Feature<GeoJSON.Point, DataCenterProperties> {
  id?: number;
}

export type DataCenterCollection = GeoJSON.FeatureCollection<GeoJSON.Point, DataCenterProperties>;

// ── Parsing helpers ──

/**
 * Parse DMS coordinates like: 41°41'36"N, 86°27'39"W
 * Handles decimal seconds, leading/trailing whitespace, and various quote styles.
 */
export function parseDMS(str: string | undefined | null): number | null {
  if (!str || typeof str !== 'string') return null;
  str = str.trim();

  // Try decimal first — if it's already a plain number
  const plain = parseFloat(str);
  if (!isNaN(plain) && /^-?\d+(\.\d+)?$/.test(str.trim())) {
    return plain;
  }

  // DMS pattern: 41°41'36"N or 41°41'36.123"N
  // Handle curly/straight quotes, escaped double-quotes (CSV)
  const dmsRegex = /(-?\d+)[°]\s*(\d+)[′']\s*([\d.]+)[″"]\s*([NSEWnsew])/;
  const match = str.match(dmsRegex);
  if (!match) return null;

  const deg = parseFloat(match[1]);
  const min = parseFloat(match[2]);
  const sec = parseFloat(match[3]);
  const dir = match[4].toUpperCase();

  let decimal = Math.abs(deg) + min / 60 + sec / 3600;
  if (dir === 'S' || dir === 'W') decimal = -decimal;
  if (deg < 0) decimal = -decimal;

  return decimal;
}

/**
 * Parse confidence-tagged strings like "Amazon #confident" → { value, confidence }
 */
export function parseConfidence(str: string | undefined | null): ConfidenceTagged {
  if (!str || typeof str !== 'string') return { value: '', confidence: null };
  str = str.trim();

  const tagMatch = str.match(/#(confident|likely|speculative)\s*$/i);
  if (tagMatch) {
    return {
      value: str.replace(/#(confident|likely|speculative)\s*$/i, '').trim(),
      confidence: tagMatch[1].toLowerCase() as ConfidenceTagged['confidence'],
    };
  }
  return { value: str, confidence: null };
}

/**
 * Parse the Users field, which may have multiple comma-separated tagged entries.
 */
function parseUsersList(str: string | undefined | null): ConfidenceTagged[] {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').map((s) => parseConfidence(s.trim())).filter((u) => u.value);
}

/**
 * Parse markdown-style links from the Selected Sources field.
 */
function parseSources(str: string | undefined | null): SourceLink[] {
  if (!str) return [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const results: SourceLink[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(str)) !== null) {
    results.push({ title: m[1], url: m[2] });
  }
  return results;
}

/**
 * Determine status from H100 equivalents:
 * 0 = planned/under-construction, >0 = operational
 */
function deriveStatus(h100: number): 'operational' | 'planned' {
  return h100 > 0 ? 'operational' : 'planned';
}

// ── CSV row type ──

interface CsvRow {
  Name?: string;
  Owner?: string;
  Users?: string;
  'Current H100 equivalents'?: string;
  'Current power (MW)'?: string;
  'Current total capital cost (2025 USD billions)'?: string;
  Country?: string;
  Address?: string;
  Latitude?: string;
  Longitude?: string;
  Notes?: string;
  'Selected Sources'?: string;
  Project?: string;
  Investors?: string;
  'Construction companies'?: string;
  'Energy companies'?: string;
}

/**
 * Load CSV, parse, and return GeoJSON FeatureCollection.
 */
export async function loadDataCenters(): Promise<DataCenterCollection> {
  const response = await fetch('/data_centers.csv');
  const csvText = await response.text();

  return new Promise<DataCenterCollection>((resolve, reject) => {
    Papa.parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete(results: Papa.ParseResult<CsvRow>) {
        const features: DataCenterFeature[] = [];

        for (const row of results.data) {
          const lat = parseDMS(row['Latitude']);
          const lng = parseDMS(row['Longitude']);

          if (lat === null || lng === null) {
            console.warn('Skipping row with unparseable coordinates:', row['Name'], row['Latitude'], row['Longitude']);
            continue;
          }

          const h100 = parseFloat(row['Current H100 equivalents'] ?? '0') || 0;
          const power = parseFloat(row['Current power (MW)'] ?? '0') || 0;
          const cost = parseFloat(row['Current total capital cost (2025 USD billions)'] ?? '0') || 0;

          const owner = parseConfidence(row['Owner']);
          const users = parseUsersList(row['Users']);
          const sources = parseSources(row['Selected Sources']);

          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            properties: {
              name: (row['Name'] ?? '').trim(),
              owner: owner.value,
              owner_confidence: owner.confidence,
              users: users.map((u) => u.value),
              users_detail: users,
              h100_equivalents: h100,
              power_mw: power,
              capital_cost_b: cost,
              status: deriveStatus(h100),
              country: (row['Country'] ?? '').trim(),
              address: (row['Address'] ?? '').trim(),
              project: parseConfidence(row['Project']),
              investors: (row['Investors'] ?? '').trim(),
              construction_companies: (row['Construction companies'] ?? '').trim(),
              energy_companies: (row['Energy companies'] ?? '').trim(),
              notes: (row['Notes'] ?? '').trim(),
              sources,
              sources_raw: (row['Selected Sources'] ?? '').trim(),
            },
          });
        }

        resolve({
          type: 'FeatureCollection',
          features,
        });
      },
      error(err: Error) {
        reject(err);
      },
    });
  });
}
