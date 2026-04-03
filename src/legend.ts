import type { DataCenterCollection } from './data.ts';
import { OWNER_COLORS } from './constants.ts';
import { applyFilters } from './map.ts';

const hiddenOwners = new Set<string>();
const hiddenStatuses = new Set<string>();

/**
 * Render the legend into #legend-body.
 * Owner and status items are clickable to toggle visibility.
 */
export function renderLegend(geojson: DataCenterCollection): void {
  const body = document.getElementById('legend-body');
  if (!body) return;

  // Determine which owners appear in the data
  const ownersInData = new Set<string>();
  for (const f of geojson.features) {
    if (f.properties.owner) ownersInData.add(f.properties.owner);
  }

  // ── Owner Colors ──
  const ownerItems = Object.entries(OWNER_COLORS)
    .filter(([name]) => ownersInData.has(name))
    .map(([name, color]) => `
      <div class="legend-item legend-filterable" data-filter-type="owner" data-filter-value="${name}">
        <span class="legend-dot" style="background:${color}"></span>
        <span class="legend-label">${name}</span>
      </div>
    `)
    .join('');

  // ── Status (circle = operational, square = planned) ──
  const statusItems = `
    <div class="legend-item legend-filterable" data-filter-type="status" data-filter-value="operational">
      <span class="legend-dot" style="background:rgba(255,255,255,0.7);width:7px;height:7px"></span>
      <span class="legend-label">Operational</span>
    </div>
    <div class="legend-item legend-filterable" data-filter-type="status" data-filter-value="planned">
      <span class="legend-square" style="background:rgba(255,255,255,0.7)"></span>
      <span class="legend-label">Planned</span>
    </div>
  `;

  body.innerHTML = `
    <div class="legend-section">
      <div class="legend-section-title">Owner</div>
      ${ownerItems}
    </div>
    <div class="legend-section">
      <div class="legend-section-title">Status</div>
      ${statusItems}
    </div>
  `;

  // Set max-height for animation
  body.style.maxHeight = body.scrollHeight + 'px';

  // ── Click-to-filter ──
  body.querySelectorAll('.legend-filterable').forEach((el) => {
    el.addEventListener('click', () => {
      const type = (el as HTMLElement).dataset.filterType!;
      const value = (el as HTMLElement).dataset.filterValue!;

      if (type === 'owner') {
        if (hiddenOwners.has(value)) {
          hiddenOwners.delete(value);
          el.classList.remove('legend-hidden');
        } else {
          hiddenOwners.add(value);
          el.classList.add('legend-hidden');
        }
      } else if (type === 'status') {
        if (hiddenStatuses.has(value)) {
          hiddenStatuses.delete(value);
          el.classList.remove('legend-hidden');
        } else {
          hiddenStatuses.add(value);
          el.classList.add('legend-hidden');
        }
      }

      applyFilters(hiddenOwners, hiddenStatuses);
    });
  });

  // ── Toggle ──
  const toggle = document.getElementById('legend-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const isCollapsed = body.classList.toggle('collapsed');
      toggle.classList.toggle('collapsed', isCollapsed);
    });
  }
}
