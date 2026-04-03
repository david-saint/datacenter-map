# Frontier AI Data Centers — Interactive Map Visualization

## Context

Epoch AI publishes a dataset of ~25 frontier AI data centers (planned, under-construction, operational) for top AI labs and cloud providers. The user wants to visualize this on a Mapbox GL JS map as a polished, portfolio-quality dashboard. The project is greenfield — only a `.env` with a Mapbox token and raw CSV data exist.

## Aesthetic Direction

**Industrial Command Center** — a dark, atmospheric dashboard that evokes a global infrastructure monitoring console. Near-black background with vibrant, brand-colored data points that glow like power sources on a dark map. Glassmorphism panels with backdrop blur. Typography: **JetBrains Mono** for data/numbers (monospace = infrastructure feel), **DM Sans** for headings/labels (geometric, modern). Not generic dark mode — intentional, high-contrast, data-forward.

## Tech Stack

- **Vite** (already indicated by `.env` prefix `VITE_`)
- **Vanilla JS** (no framework needed for ~25 data points + single page)
- **Mapbox GL JS v3** (dark-v11 base style)
- **PapaParse** (robust CSV parsing for multiline quoted fields)
- **Google Fonts** (JetBrains Mono + DM Sans)

## Data Pipeline

The CSV at `data_centers/data_centers.csv` has these key columns:

- `Name`, `Owner`, `Users`, `Country`, `Address`, `Latitude`, `Longitude`
- `Current H100 equivalents`, `Current power (MW)`, `Current total capital cost (2025 USD billions)`
- `Notes`, `Selected Sources`, `Project`, `Investors`, `Construction companies`, `Energy companies`

**Parsing challenges:**

1. **DMS coordinates** like `41°41'36"N` / `86°27'39"W` — convert to decimal degrees
2. **Confidence tags** like `Amazon #confident`, `OpenAI #likely` — strip and store separately
3. **Multiline fields** in Notes/Sources — PapaParse handles RFC 4180
4. **Leading spaces** in some coordinate values — trim before parsing
5. **Zero-value entries** (8 data centers) = planned/under-construction status

**Output:** GeoJSON FeatureCollection with cleaned properties.

## File Structure

```
datacenter-map/
  index.html              # Entry point — map container, panel, legend
  package.json            # vite, mapbox-gl, papaparse
  vite.config.js          # Minimal config
  src/
    main.js               # Entry — orchestrates initialization
    map.js                # Map init, layers, interactions
    data.js               # CSV parsing, DMS conversion, GeoJSON output
    panel.js              # Slide-in detail panel
    legend.js             # Color/size legend
    constants.js          # Owner colors, config
    style.css             # Full dark theme styling
  public/
    data_centers.csv      # Copy of CSV for fetch access
```

## Map Visualization

### Base Map

- Style: `mapbox://styles/mapbox/dark-v11`
- Initial view: `fitBounds` on all data points with padding (shows global extent — US, China, UAE)
- Fog/atmosphere enabled for depth
- Navigation controls (zoom, compass)

### Layers (bottom to top)

1. **Glow layer** — large, low-opacity circles behind each point (radius ~2x main circle). Creates "power emanation" effect. Color matches owner. Opacity 0.15.

2. **Operational circles** — `filter: ['>', ['get', 'h100_equivalents'], 0]`. Radius driven by `sqrt(h100_equivalents)` mapped to 8–45px range. Color by owner via `match` expression. Semi-transparent fill (0.7) + 1.5px white stroke.

3. **Planned/under-construction rings** — `filter: ['==', ['get', 'h100_equivalents'], 0]`. Hollow circles (fill opacity 0, stroke only). Fixed 8px radius. Dashed or pulsing animation.

4. **Labels** — `symbol` layer at `minzoom: 5`. Short name, white text with dark halo.

### Owner Color Palette (brand-inspired, dark-bg optimized)

| Owner        | Color     |
| ------------ | --------- |
| Amazon       | `#FF9900` |
| Meta         | `#0668E1` |
| Microsoft    | `#00BCF2` |
| xAI          | `#E8E8E8` |
| Google Cloud | `#34A853` |
| Oracle       | `#F80000` |
| Alibaba      | `#FF6A00` |
| Fluidstack   | `#8B5CF6` |
| Vantage      | `#84CC16` |
| QTS          | `#EC4899` |
| Coreweave    | `#EAB308` |
| Default      | `#6B7280` |

### Circle Sizing

```js
'circle-radius': [
  'interpolate', ['linear'],
  ['sqrt', ['get', 'h100_equivalents']],
  0, 8,        // ~18K H100eq → 8px
  134, 12,     // ~18K
  400, 25,     // ~160K
  828, 45      // ~686K (largest)
]
```

## UI Components

### Header Bar

- Fixed top, 56px height, dark glass background (`rgba(10,10,10,0.85)` + backdrop-blur)
- Title: "Frontier AI Data Centers"
- Subtitle: "Source: Epoch AI — {count} facilities tracked"

### Detail Panel (right slide-in)

- 400px wide, full height, dark glass background
- Triggered by clicking a data center circle
- Content:
  - Name (large heading)
  - Status badge: Operational (green) / Under Construction (amber) / Planned (gray)
  - Owner + confidence indicator
  - Users list + confidence
  - H100 Equivalents (formatted with commas)
  - Power (MW), Capital Cost ($B)
  - Country, Address
  - Project, Investors, Construction/Energy companies
  - Notes (collapsible)
  - Sources (parsed markdown links → clickable `<a>` tags)
- Close button + click-outside-to-close
- `flyTo` animation on the map when panel opens

### Legend (bottom-left overlay)

- Owner color dots with labels
- Size reference (3 circles: small/medium/large with H100eq values)
- Status: filled = operational, ring = planned
- Collapsible on mobile

## Skills to Load

Load these skills during implementation for guidance:

1. **`/frontend-design`** — Load at the start of implementation for design quality, typography, color, and motion guidance. Apply throughout all phases.
2. **`/mapbox-data-visualization-patterns`** — Load when building circle layers and data-driven styling (Phase 3).
3. **`/mapbox-style-patterns`** — Load when configuring the dark base map and layer styling (Phase 3).
4. **`/mapbox-web-integration-patterns`** — Load when initializing the map with vanilla JS + Vite (Phase 3).
5. **`/mapbox-web-performance-patterns`** — Load when optimizing layer rendering and data loading (Phase 3).
6. **`/mapbox-cartography`** — Load when choosing colors, visual hierarchy, and legend design (Phase 3–4).

## Implementation Phases

### Phase 1: Scaffolding

Skills: `/frontend-design`

1. `npm init -y`, install `vite`, `mapbox-gl`, `papaparse`
2. Create `vite.config.js`
3. Create `index.html` with map container + structural divs
4. Create `src/style.css` with full-viewport dark layout, fonts, panel/legend styles
5. Copy CSV to `public/`

### Phase 2: Data Pipeline (`src/data.js`)

1. `parseDMS(str)` — handles degrees°minutes'seconds"N/S/E/W with decimals and whitespace
2. `parseConfidence(str)` — returns `{ value, confidence }` from tagged strings
3. `loadDataCenters()` — fetch CSV, PapaParse, transform to GeoJSON FeatureCollection

### Phase 3: Map + Layers (`src/map.js`)

Skills: `/mapbox-web-integration-patterns`, `/mapbox-data-visualization-patterns`, `/mapbox-style-patterns`, `/mapbox-web-performance-patterns`, `/mapbox-cartography`

1. Init map with dark-v11, parallel data fetch
2. On `load`: add GeoJSON source, glow layer, operational circles, planned rings, labels
3. `fitBounds` to data extent
4. Hover: cursor pointer + feature highlight
5. Click: open detail panel + `flyTo`

### Phase 4: Panel + Legend (`src/panel.js`, `src/legend.js`)

Skills: `/frontend-design`, `/mapbox-cartography`

1. Panel rendering with all metadata fields
2. Markdown link parsing for sources
3. Legend with owner colors, size scale, status types
4. Open/close animations

### Phase 5: Polish

Skills: `/frontend-design`

1. Pulse animation on planned data centers
2. Responsive layout (panel below on mobile)
3. Loading state
4. Epoch AI attribution (CC-BY license requirement)

## Key Files to Modify/Create

- `index.html` — NEW
- `package.json` — NEW
- `vite.config.js` — NEW
- `src/main.js` — NEW
- `src/map.js` — NEW
- `src/data.js` — NEW
- `src/panel.js` — NEW
- `src/legend.js` — NEW
- `src/constants.js` — NEW
- `src/style.css` — NEW
- `public/data_centers.csv` — COPY from `data_centers/`

## Verification

1. `npm install && npm run dev` — app starts without errors
2. Map loads with dark style, all ~25 data centers visible
3. Circles sized correctly (New Carlisle largest, Pryor smallest among operational)
4. Colors match owner assignments
5. Planned sites show as hollow rings (Hyperion, Stargate UAE, etc.)
6. Click any circle → panel slides in with correct metadata
7. Legend displays all owners and size scale
8. Responsive: works on mobile viewport
9. DMS conversion verified: spot-check a few coordinates against known locations
