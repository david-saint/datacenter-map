import type { ConfidenceTagged, SourceLink } from './data.ts';

/**
 * Detail panel for individual data center info.
 */

const panelEl = document.getElementById('detail-panel')!;
const panelContent = document.getElementById('panel-content')!;
const panelClose = document.getElementById('panel-close')!;

let isOpen = false;

/**
 * Open the panel with feature properties.
 */
export function openPanel(props: Record<string, unknown>): void {
  if (!props) {
    closePanel();
    return;
  }

  panelContent.innerHTML = renderPanel(props);
  panelEl.classList.remove('panel-closed');
  panelEl.classList.add('panel-open');
  isOpen = true;

  // Bind notes toggle
  const notesToggle = panelContent.querySelector('.panel-notes-toggle');
  if (notesToggle) {
    notesToggle.addEventListener('click', () => {
      notesToggle.classList.toggle('expanded');
      const content = notesToggle.nextElementSibling;
      content?.classList.toggle('expanded');
    });
  }
}

/**
 * Close the panel.
 */
export function closePanel(): void {
  panelEl.classList.remove('panel-open');
  panelEl.classList.add('panel-closed');
  isOpen = false;
}

export function isPanelOpen(): boolean {
  return isOpen;
}

// Close button
panelClose.addEventListener('click', closePanel);

// Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isOpen) closePanel();
});

/**
 * Render the full panel HTML.
 */
function renderPanel(props: Record<string, unknown>): string {
  const status = (props.status as string) || 'planned';
  const statusLabel = status === 'operational' ? 'Operational' : 'Planned / Under Construction';
  const statusClass = status === 'operational' ? 'operational' : 'planned';

  const h100 = typeof props.h100_equivalents === 'string'
    ? parseFloat(props.h100_equivalents)
    : ((props.h100_equivalents as number) || 0);
  const power = typeof props.power_mw === 'string'
    ? parseFloat(props.power_mw)
    : ((props.power_mw as number) || 0);
  const cost = typeof props.capital_cost_b === 'string'
    ? parseFloat(props.capital_cost_b)
    : ((props.capital_cost_b as number) || 0);

  // Parse JSON fields that Mapbox stringifies
  let usersDetail = props.users_detail as ConfidenceTagged[] | string;
  if (typeof usersDetail === 'string') {
    try { usersDetail = JSON.parse(usersDetail) as ConfidenceTagged[]; } catch { usersDetail = []; }
  }

  let sources = props.sources as SourceLink[] | string;
  if (typeof sources === 'string') {
    try { sources = JSON.parse(sources) as SourceLink[]; } catch { sources = []; }
  }

  let project: ConfidenceTagged;
  const rawProject = props.project;
  if (typeof rawProject === 'string') {
    try { project = JSON.parse(rawProject) as ConfidenceTagged; } catch { project = { value: rawProject, confidence: null }; }
  } else {
    project = (rawProject as ConfidenceTagged) ?? { value: '', confidence: null };
  }

  const sections: string[] = [];

  // ── Header ──
  sections.push(`
    <h2 class="panel-name">${esc(props.name as string)}</h2>
    <div class="panel-status ${statusClass}">
      <span class="panel-status-dot"></span>
      ${statusLabel}
    </div>
  `);

  // ── Key metrics ──
  if (status === 'operational') {
    sections.push(`
      <div class="panel-section">
        ${power ? `
        <div class="panel-field">
          <div class="panel-label">Power</div>
          <div class="panel-value large">${formatNumber(power)} MW</div>
        </div>` : ''}
        <div class="panel-field">
          <div class="panel-label">H100 Equivalents</div>
          <div class="panel-value mono">${formatNumber(h100)}</div>
        </div>
        ${cost ? `
        <div class="panel-field">
          <div class="panel-label">Capital Cost</div>
          <div class="panel-value mono">$${cost.toFixed(2)}B</div>
        </div>` : ''}
      </div>
    `);
  }

  // ── Ownership ──
  const usersArr = Array.isArray(usersDetail) ? usersDetail : [];
  const proj = project as ConfidenceTagged;
  sections.push(`
    <div class="panel-section">
      <div class="panel-field">
        <div class="panel-label">Owner</div>
        <div class="panel-value">${esc(props.owner as string)}${confidenceBadge(props.owner_confidence as string | null)}</div>
      </div>
      ${usersArr.length ? `
      <div class="panel-field">
        <div class="panel-label">Users</div>
        <div class="panel-value">${usersArr.map((u: ConfidenceTagged) =>
          `${esc(u.value)}${confidenceBadge(u.confidence)}`
        ).join(', ')}</div>
      </div>` : ''}
      ${proj && proj.value ? `
      <div class="panel-field">
        <div class="panel-label">Project</div>
        <div class="panel-value">${esc(proj.value)}${confidenceBadge(proj.confidence)}</div>
      </div>` : ''}
      ${props.investors ? `
      <div class="panel-field">
        <div class="panel-label">Investors</div>
        <div class="panel-value">${esc(props.investors as string)}</div>
      </div>` : ''}
    </div>
  `);

  // ── Location ──
  sections.push(`
    <div class="panel-section">
      <div class="panel-field">
        <div class="panel-label">Country</div>
        <div class="panel-value">${esc(props.country as string)}</div>
      </div>
      ${props.address ? `
      <div class="panel-field">
        <div class="panel-label">Address</div>
        <div class="panel-value" style="font-size:12px">${esc(props.address as string)}</div>
      </div>` : ''}
    </div>
  `);

  // ── Infrastructure ──
  if (props.construction_companies || props.energy_companies) {
    sections.push(`
      <div class="panel-section">
        ${props.construction_companies ? `
        <div class="panel-field">
          <div class="panel-label">Construction</div>
          <div class="panel-value">${esc(props.construction_companies as string)}</div>
        </div>` : ''}
        ${props.energy_companies ? `
        <div class="panel-field">
          <div class="panel-label">Energy</div>
          <div class="panel-value">${esc(props.energy_companies as string)}</div>
        </div>` : ''}
      </div>
    `);
  }

  // ── Notes (collapsible) ──
  if (props.notes) {
    sections.push(`
      <div class="panel-section">
        <button class="panel-notes-toggle">
          <span class="arrow">&#9654;</span> Notes
        </button>
        <div class="panel-notes-content">
          <div class="panel-notes-text">${esc(props.notes as string)}</div>
        </div>
      </div>
    `);
  }

  // ── Sources ──
  const sourcesArr = Array.isArray(sources) ? sources : [];
  if (sourcesArr.length) {
    sections.push(`
      <div class="panel-section">
        <div class="panel-section-title">Sources</div>
        <div class="panel-sources">
          ${sourcesArr.map((s: SourceLink) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join('')}
        </div>
      </div>
    `);
  }

  return sections.join('');
}

function confidenceBadge(confidence: string | null): string {
  if (!confidence) return '';
  return `<span class="panel-confidence">#${confidence}</span>`;
}

function formatNumber(n: number): string {
  if (!n || n === 0) return '0';
  return Math.round(n).toLocaleString('en-US');
}

function esc(str: string | undefined | null): string {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
