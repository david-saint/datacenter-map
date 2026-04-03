import mapboxgl from 'mapbox-gl';
import type { DataCenterCollection } from './data.ts';
import { ownerColorExpression, MARKER_SIZE, MAP_CONFIG } from './constants.ts';

let map: mapboxgl.Map | null = null;
let hoveredFeatureId: number | null = null;

export interface MapCallbacks {
  onFeatureClick: (props: Record<string, unknown> | null, coords?: [number, number]) => void;
}

// ── SDF icon generation ──

/** Create a filled-circle SDF image (white on transparent, for icon-color tinting). */
function createCircleIcon(size: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r = size / 2;
  ctx.beginPath();
  ctx.arc(r, r, r - 1, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

/** Create a filled-square SDF image (white on transparent, with slight rounding). */
function createSquareIcon(size: number): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const inset = 1;
  const corner = 2;
  ctx.beginPath();
  ctx.roundRect(inset, inset, size - inset * 2, size - inset * 2, corner);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

/**
 * Initialize the map. Data fetch happens in parallel (passed as promise).
 */
export function initMap(
  token: string,
  dataPromise: Promise<DataCenterCollection>,
  callbacks: MapCallbacks,
): mapboxgl.Map {
  mapboxgl.accessToken = token;

  map = new mapboxgl.Map({
    container: 'map',
    style: MAP_CONFIG.style,
    center: [0, 20],
    zoom: 2,
    minZoom: MAP_CONFIG.minZoom,
    maxZoom: MAP_CONFIG.maxZoom,
    projection: 'globe',
    antialias: false,
  });

  map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

  map.on('load', async () => {
    if (!map) return;

    // Atmosphere / fog
    map.setFog({
      color: 'rgba(8, 8, 12, 1)',
      'high-color': 'rgba(20, 20, 35, 1)',
      'horizon-blend': 0.08,
      'space-color': 'rgba(3, 3, 6, 1)',
      'star-intensity': 0.4,
    });

    // Register SDF icons for marker shapes
    const iconPx = 20;
    map.addImage('marker-circle', createCircleIcon(iconPx), { sdf: true });
    map.addImage('marker-square', createSquareIcon(iconPx), { sdf: true });

    const geojson = await dataPromise;

    addLayers(geojson);
    fitToData(geojson);
    setupInteractions(callbacks.onFeatureClick);

    const countEl = document.getElementById('facility-count');
    if (countEl) countEl.textContent = String(geojson.features.length);

    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  });

  return map;
}

/**
 * Add all visualization layers.
 *
 * Layer stack (bottom → top):
 *   1. dc-glow    — large blurred halo, radius = compute scale
 *   2. dc-hitarea — invisible 18px circle for click/hover target
 *   3. dc-markers — uniform small icons (circle = operational, square = planned)
 *   4. dc-labels  — text labels at higher zoom
 */
function addLayers(geojson: DataCenterCollection): void {
  if (!map) return;

  geojson.features.forEach((f, i) => { f.id = i; });

  map.addSource('datacenters', {
    type: 'geojson',
    data: geojson as GeoJSON.FeatureCollection,
    generateId: false,
  });

  // ── 1. Glow — large, blurred, radius = compute scale ──
  map.addLayer({
    id: 'dc-glow',
    type: 'circle',
    source: 'datacenters',
    filter: ['>', ['get', 'h100_equivalents'], 0],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'],
        ['sqrt', ['get', 'h100_equivalents']],
        0, 20,
        134, 30,
        400, 55,
        828, 90,
      ] as mapboxgl.ExpressionSpecification,
      'circle-color': ownerColorExpression(),
      'circle-opacity': 0.10,
      'circle-blur': 0.8,
    },
  });

  // ── 2. Hit area — invisible larger circle for easier click/hover ──
  map.addLayer({
    id: 'dc-hitarea',
    type: 'circle',
    source: 'datacenters',
    paint: {
      'circle-radius': 18,
      'circle-color': 'transparent',
      'circle-opacity': 0,
    },
  });

  // ── 3. Markers — uniform small icons, shape = status ──
  map.addLayer({
    id: 'dc-markers',
    type: 'symbol',
    source: 'datacenters',
    layout: {
      'icon-image': [
        'case',
        ['>', ['get', 'h100_equivalents'], 0],
        'marker-circle',
        'marker-square',
      ] as mapboxgl.ExpressionSpecification,
      'icon-size': MARKER_SIZE / 20, // icon is 20px, we want MARKER_SIZE px
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-color': ownerColorExpression(),
      'icon-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1.0,
        0.9,
      ] as mapboxgl.ExpressionSpecification,
    },
  });

  // ── 4. Labels at higher zoom ──
  map.addLayer({
    id: 'dc-labels',
    type: 'symbol',
    source: 'datacenters',
    minzoom: 5,
    layout: {
      'text-field': ['get', 'name'] as mapboxgl.ExpressionSpecification,
      'text-size': 11,
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-offset': [0, 1.4] as [number, number],
      'text-anchor': 'top',
      'text-max-width': 12,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#d4d4d8',
      'text-halo-color': 'rgba(5, 5, 7, 0.9)',
      'text-halo-width': 1.5,
    },
  });
}

/**
 * Fit the map viewport to contain all data points.
 */
function fitToData(geojson: DataCenterCollection): void {
  if (!map || !geojson.features.length) return;

  const bounds = new mapboxgl.LngLatBounds();
  geojson.features.forEach((f) => {
    bounds.extend(f.geometry.coordinates as [number, number]);
  });

  map.fitBounds(bounds, {
    padding: MAP_CONFIG.padding,
    maxZoom: 6,
    duration: 1400,
    easing: (t: number) => 1 - Math.pow(1 - t, 3),
  });
}

/**
 * Setup hover + click interactions.
 */
function setupInteractions(onFeatureClick: MapCallbacks['onFeatureClick']): void {
  if (!map) return;

  const interactiveLayers = ['dc-hitarea'];

  for (const layerId of interactiveLayers) {
    map.on('mousemove', layerId, (e) => {
      if (!map || !e.features?.length) return;
      map.getCanvas().style.cursor = 'pointer';

      const feature = e.features[0];
      if (hoveredFeatureId !== null) {
        map.setFeatureState({ source: 'datacenters', id: hoveredFeatureId }, { hover: false });
      }
      hoveredFeatureId = feature.id as number;
      map.setFeatureState({ source: 'datacenters', id: hoveredFeatureId }, { hover: true });
    });

    map.on('mouseleave', layerId, () => {
      if (!map) return;
      map.getCanvas().style.cursor = '';
      if (hoveredFeatureId !== null) {
        map.setFeatureState({ source: 'datacenters', id: hoveredFeatureId }, { hover: false });
        hoveredFeatureId = null;
      }
    });

    map.on('click', layerId, (e) => {
      if (!map || !e.features?.length) return;
      const feature = e.features[0];
      const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];

      map.flyTo({
        center: coords,
        zoom: Math.max(map.getZoom(), 7),
        duration: 1000,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        offset: [window.innerWidth > 768 ? -180 : 0, 0] as [number, number],
      });

      onFeatureClick(feature.properties as Record<string, unknown>, coords);
    });
  }

  // Click on map background → close panel
  map.on('click', (e) => {
    if (!map) return;
    const features = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
    if (!features.length) {
      onFeatureClick(null);
    }
  });
}

export function getMap(): mapboxgl.Map | null {
  return map;
}

/** All layer IDs that should respect owner/status filters. */
const FILTERED_LAYERS = ['dc-glow', 'dc-hitarea', 'dc-markers', 'dc-labels'];

/**
 * Apply combined owner + status filter to all data layers.
 * hiddenOwners: set of owner names to hide.
 * hiddenStatuses: set of status values ("operational" | "planned") to hide.
 * If both sets are empty, all features are shown.
 */
export function applyFilters(hiddenOwners: Set<string>, hiddenStatuses: Set<string>): void {
  if (!map) return;

  const conditions: mapboxgl.ExpressionSpecification[] = [];

  if (hiddenOwners.size > 0) {
    // Show only owners NOT in the hidden set
    conditions.push([
      '!', ['in', ['get', 'owner'], ['literal', [...hiddenOwners]]],
    ] as mapboxgl.ExpressionSpecification);
  }

  if (hiddenStatuses.size > 0) {
    // "operational" = h100_equivalents > 0, "planned" = h100_equivalents == 0
    if (hiddenStatuses.has('operational') && !hiddenStatuses.has('planned')) {
      conditions.push(['==', ['get', 'h100_equivalents'], 0] as mapboxgl.ExpressionSpecification);
    } else if (hiddenStatuses.has('planned') && !hiddenStatuses.has('operational')) {
      conditions.push(['>', ['get', 'h100_equivalents'], 0] as mapboxgl.ExpressionSpecification);
    } else {
      // Both hidden — show nothing
      conditions.push(['literal', false] as unknown as mapboxgl.ExpressionSpecification);
    }
  }

  // Combine into a single 'all' filter, or null to show everything
  const filter: mapboxgl.ExpressionSpecification | null =
    conditions.length === 0 ? null
    : conditions.length === 1 ? conditions[0]
    : ['all', ...conditions] as mapboxgl.ExpressionSpecification;

  for (const layerId of FILTERED_LAYERS) {
    if (!map.getLayer(layerId)) continue;

    if (layerId === 'dc-glow') {
      // Glow already has a base filter for h100 > 0
      const base: mapboxgl.ExpressionSpecification = ['>', ['get', 'h100_equivalents'], 0];
      map.setFilter(layerId, filter ? ['all', base, filter] as mapboxgl.ExpressionSpecification : base);
    } else {
      map.setFilter(layerId, filter);
    }
  }
}
