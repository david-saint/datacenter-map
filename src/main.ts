import 'mapbox-gl/dist/mapbox-gl.css';
import './style.css';

import { loadDataCenters } from './data.ts';
import { initMap } from './map.ts';
import { openPanel, closePanel } from './panel.ts';
import { renderLegend } from './legend.ts';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

if (!MAPBOX_TOKEN) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.innerHTML = `
      <div class="loading-content">
        <p class="loading-text" style="color:#f87171">Missing VITE_MAPBOX_TOKEN in .env</p>
      </div>`;
  }
  throw new Error('VITE_MAPBOX_TOKEN is not set');
}

// Start data fetch immediately (parallel with map init)
const dataPromise = loadDataCenters();

// Initialize map — data arrives via promise
initMap(MAPBOX_TOKEN, dataPromise, {
  onFeatureClick(props) {
    if (!props) {
      closePanel();
      return;
    }
    openPanel(props);
  },
});

// Once data resolves, render legend
dataPromise.then((geojson) => {
  renderLegend(geojson);
});
