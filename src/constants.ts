import type { ExpressionSpecification } from 'mapbox-gl';

/**
 * Owner color palette — brand-inspired, optimized for dark backgrounds
 */
export const OWNER_COLORS: Record<string, string> = {
  'Amazon':       '#FF9900',
  'Meta':         '#0668E1',
  'Microsoft':    '#00BCF2',
  'xAI':          '#E8E8E8',
  'Google Cloud': '#34A853',
  'Oracle':       '#F80000',
  'Alibaba':      '#FF6A00',
  'Fluidstack':   '#8B5CF6',
  'Vantage':      '#84CC16',
  'QTS':          '#EC4899',
  'Coreweave':    '#EAB308',
  'G42':          '#10B981',
};

export const DEFAULT_COLOR = '#6B7280';

/**
 * Build a Mapbox match expression for owner → color
 */
export function ownerColorExpression(): ExpressionSpecification {
  const entries = Object.entries(OWNER_COLORS).flat();
  return ['match', ['get', 'owner'], ...entries, DEFAULT_COLOR] as ExpressionSpecification;
}

/**
 * Uniform marker size (px) — all markers are the same small size.
 */
export const MARKER_SIZE = 10;

/**
 * Map configuration
 */
export const MAP_CONFIG = {
  style: 'mapbox://styles/mapbox/dark-v11' as const,
  minZoom: 1,
  maxZoom: 18,
  padding: { top: 80, bottom: 60, left: 60, right: 60 },
};
