/**
 * Consulta de Resultados — Visualizador Electoral Baja California 2021 — 2024
 * Suma de todas las secciones por Municipio, DL y DF.
 * Puntos: GOB_21, AYUNT_21, DIP_21, AYUNT_24, DIP_24
 */

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1jYoM_flncgvt0bEwm88FGwNUUVcMBVYmGBhsGxPNUAE/export?format=csv&gid=1473468940';

// Register ChartDataLabels plugin
if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

// Core Electoral Milestones (Points along X Axis)
const ELECTORAL_POINTS = [
  { key: 'GOB_21', label: '1. GOB_21 (Gob. 2021)' },
  { key: 'AYUNT_21', label: '2. AYUNT_21 (Ayunt. 2021)' },
  { key: 'DIP_21', label: '3. DIP_21 (Dip. 2021)' },
  { key: 'AYUNT_24', label: '4. AYUNT_24 (Ayunt. 2024)' },
  { key: 'DIP_24', label: '5. DIP_24 (Dip. 2024)' }
];

// Distinct Color Palettes for Municipalities
const MUNICIPALITY_COLORS = {
  'TIJUANA': '#6366f1',      // Indigo
  'MEXICALI': '#10b981',     // Emerald
  'ENSENADA': '#f59e0b',     // Amber
  'TECATE': '#ec4899',       // Pink
  'ROSARITO': '#06b6d4',      // Cyan
  'SAN QUINTIN': '#8b5cf6',   // Violet
  'SAN FELIPE': '#f97316'     // Orange
};

const SERIES_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', 
  '#8b5cf6', '#f97316', '#3b82f6', '#14b8a6', '#e11d48',
  '#84cc16', '#a855f7', '#0ea5e9', '#d97706', '#ef4444',
  '#64748b', '#22c55e', '#eab308'
];

// Application State
const state = {
  allRows: [],
  filteredRows: [],
  filters: {
    mun: 'ALL',
    dl: 'ALL',
    df: 'ALL',
    seccion: ''
  },
  groupMode: 'total', // 'total' (Suma Total) | 'mun' | 'dl' | 'df'
  activePoints: ['GOB_21', 'AYUNT_21', 'DIP_21', 'AYUNT_24', 'DIP_24'],
  chartInstance: null
};

// DOM References
const elements = {
  filterMun: document.getElementById('filter-mun'),
  filterDl: document.getElementById('filter-dl'),
  filterDf: document.getElementById('filter-df'),
  filterSeccion: document.getElementById('filter-seccion'),
  btnResetFilters: document.getElementById('btn-reset-filters'),
  activeSeccionesCount: document.getElementById('active-secciones-count'),
  filterSummaryCaption: document.getElementById('filter-summary-caption'),
  lineGroupMode: document.getElementById('line-group-mode'),
  pointChecks: document.querySelectorAll('.point-check'),
  inputTension: document.getElementById('input-tension'),
  tensionVal: document.getElementById('tension-val'),
  checkShowValues: document.getElementById('check-show-values'),
  checkFillArea: document.getElementById('check-fill-area'),
  checkGrid: document.getElementById('check-grid'),
  checkStepped: document.getElementById('check-stepped'),
  chartDisplayTitle: document.getElementById('chart-display-title'),
  chartDisplaySubtitle: document.getElementById('chart-display-subtitle'),
  chartCanvas: document.getElementById('mainChart'),
  btnResetZoom: document.getElementById('btn-reset-zoom'),
  btnSyncSheet: document.getElementById('btn-sync-sheet'),
  syncIcon: document.getElementById('sync-icon'),
  liveStatusPill: document.getElementById('live-status-pill'),
  liveStatusText: document.getElementById('live-status-text'),
  lastUpdateTime: document.getElementById('last-update-time'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  btnExportPng: document.getElementById('btn-export-png'),
  previewRowCount: document.getElementById('preview-row-count'),
  previewTbody: document.getElementById('preview-tbody'),
  tableSearchInput: document.getElementById('table-search-input'),
  loadingOverlay: document.getElementById('chart-loading-overlay'),
  loadingMsg: document.getElementById('loading-msg'),
  errorModal: document.getElementById('error-modal'),
  errorModalTitle: document.getElementById('error-modal-title'),
  errorModalBody: document.getElementById('error-modal-body'),
  btnCloseModal: document.getElementById('btn-close-modal')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  setupEventListeners();
  loadLiveSheetData();
});

function setupEventListeners() {
  // Filtro Municipio: Suma todas las secciones del municipio seleccionado
  elements.filterMun.addEventListener('change', (e) => {
    state.filters.mun = e.target.value;
    updateDlAndDfOptions();
    applyFilters();
  });

  // Filtro Distrito Local (DL): Suma todas las secciones del DL seleccionado
  elements.filterDl.addEventListener('change', (e) => {
    state.filters.dl = e.target.value;
    applyFilters();
  });

  // Filtro Distrito Federal (DF): Suma todas las secciones del DF seleccionado
  elements.filterDf.addEventListener('change', (e) => {
    state.filters.df = e.target.value;
    applyFilters();
  });

  // Filtro Sección Individual
  elements.filterSeccion.addEventListener('input', (e) => {
    state.filters.seccion = e.target.value.trim();
    applyFilters();
  });

  elements.btnResetFilters.addEventListener('click', resetFilters);

  // Modo de visualización
  elements.lineGroupMode.addEventListener('change', (e) => {
    state.groupMode = e.target.value;
    updateChart();
  });

  // Checkboxes de Puntos Electorales
  elements.pointChecks.forEach(chk => {
    chk.addEventListener('change', () => {
      state.activePoints = Array.from(elements.pointChecks)
        .filter(c => c.checked)
        .map(c => c.value);
      updateChart();
    });
  });

  // Controles Visuales
  elements.inputTension.addEventListener('input', (e) => {
    elements.tensionVal.textContent = e.target.value;
    updateChart();
  });
  elements.checkShowValues.addEventListener('change', updateChart);
  elements.checkFillArea.addEventListener('change', updateChart);
  elements.checkGrid.addEventListener('change', updateChart);
  elements.checkStepped.addEventListener('change', updateChart);

  // Zoom
  elements.btnResetZoom.addEventListener('click', () => {
    if (state.chartInstance) state.chartInstance.resetZoom();
  });

  // Botones de acción
  elements.btnSyncSheet.addEventListener('click', () => loadLiveSheetData(true));
  elements.btnExportCsv.addEventListener('click', exportFilteredCsv);
  elements.btnExportPng.addEventListener('click', exportChartPng);
  elements.tableSearchInput.addEventListener('input', renderTable);
  elements.btnCloseModal.addEventListener('click', () => elements.errorModal.classList.add('hidden'));
}

// Show / Hide Loading
function showLoading(msg = 'Cargando...') {
  elements.loadingMsg.textContent = msg;
  elements.loadingOverlay.classList.remove('hidden');
}
function hideLoading() {
  elements.loadingOverlay.classList.add('hidden');
}

function showModal(title, msg) {
  elements.errorModalTitle.textContent = title;
  elements.errorModalBody.textContent = msg;
  elements.errorModal.classList.remove('hidden');
}

// Load Live Data from Google Sheets
async function loadLiveSheetData(isManualRefresh = false) {
  showLoading('Descargando datos en vivo desde Google Sheets...');
  elements.syncIcon?.classList.add('animate-spin');

  // Intento 1: Servidor Flask API
  try {
    const res = await fetch('/api/get-live-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data && json.data.rows) {
        hideLoading();
        elements.syncIcon?.classList.remove('animate-spin');
        
        const timeStr = json.updated_at || new Date().toLocaleTimeString();
        elements.lastUpdateTime.textContent = `Actualizado en vivo: ${timeStr}`;
        elements.liveStatusText.textContent = json.source_label || 'En vivo desde Google Sheets';
        
        processLoadedRows(json.data.rows);
        
        if (isManualRefresh) {
          showModal('Datos Sincronizados', `Se leyeron en vivo ${json.data.rows.length.toLocaleString()} secciones directamente desde Google Sheets.`);
        }
        return;
      }
    }
  } catch (err) {}

  // Intento 2: Descarga Directa Client-Side
  try {
    Papa.parse(GOOGLE_SHEET_CSV_URL, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: function(results) {
        hideLoading();
        elements.syncIcon?.classList.remove('animate-spin');
        if (results.data && results.data.length > 0) {
          const nowStr = new Date().toLocaleTimeString();
          elements.lastUpdateTime.textContent = `Actualizado en vivo: ${nowStr}`;
          elements.liveStatusText.textContent = 'En vivo desde Google Sheets';
          processLoadedRows(results.data);
          if (isManualRefresh) {
            showModal('Datos Sincronizados', `Se descargaron en vivo ${results.data.length.toLocaleString()} secciones de Google Sheets.`);
          }
        } else {
          fallbackToLocalCache(isManualRefresh);
        }
      },
      error: function() {
        fallbackToLocalCache(isManualRefresh);
      }
    });
  } catch (e) {
    fallbackToLocalCache(isManualRefresh);
  }
}

// Fallback a copia local
function fallbackToLocalCache(isManualRefresh) {
  Papa.parse('google_data.csv', {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function(results) {
      hideLoading();
      elements.syncIcon?.classList.remove('animate-spin');
      if (results.data && results.data.length > 0) {
        elements.lastUpdateTime.textContent = 'Copia local de respaldo';
        elements.liveStatusText.textContent = 'Modo Respaldo Local';
        processLoadedRows(results.data);
      }
    },
    error: function() {
      hideLoading();
      elements.syncIcon?.classList.remove('animate-spin');
      showModal('Error', 'No se pudo conectar a Google Sheets ni leer la copia local.');
    }
  });
}

// Normalizar y almacenar filas
function processLoadedRows(rows) {
  state.allRows = rows.map(r => {
    const cleanRow = {};
    for (let k in r) {
      const upperKey = k.trim().toUpperCase();
      let val = r[k];
      if (['DF', 'DL', 'SECCION', 'GOB_21', 'AYUNT_21', 'DIP_21', 'AYUNT_24', 'DIP_24'].includes(upperKey)) {
        val = parseInt(String(val).replace(/[\$,]/g, '').trim(), 10);
        if (isNaN(val)) val = 0;
      } else if (upperKey === 'MUN') {
        val = String(val).trim().toUpperCase();
      }
      cleanRow[upperKey] = val;
    }
    return cleanRow;
  });

  populateFilterOptions();
  applyFilters();
}

// Llenar opciones de Municipios, DL y DF
function populateFilterOptions() {
  const munMap = {};
  state.allRows.forEach(r => {
    const m = r.MUN || 'DESCONOCIDO';
    munMap[m] = (munMap[m] || 0) + 1;
  });

  const sortedMuns = Object.keys(munMap).sort((a, b) => munMap[b] - munMap[a]);

  elements.filterMun.innerHTML = `<option value="ALL">📍 Todos los Municipios (Total Estatal: ${state.allRows.length} secc.)</option>`;
  sortedMuns.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = `${m} (${munMap[m]} secciones sumadas)`;
    if (state.filters.mun === m) opt.selected = true;
    elements.filterMun.appendChild(opt);
  });

  updateDlAndDfOptions();
}

// Actualizar opciones de DL y DF según Municipio
function updateDlAndDfOptions() {
  const currentMun = state.filters.mun;
  const filteredForOptions = currentMun === 'ALL' 
    ? state.allRows 
    : state.allRows.filter(r => r.MUN === currentMun);

  const dls = Array.from(new Set(filteredForOptions.map(r => r.DL).filter(Boolean))).sort((a,b) => a - b);
  const dfs = Array.from(new Set(filteredForOptions.map(r => r.DF).filter(Boolean))).sort((a,b) => a - b);

  // Si el DL actual no existe en el municipio seleccionado, restablecer a ALL
  if (state.filters.dl !== 'ALL' && !dls.includes(parseInt(state.filters.dl, 10))) {
    state.filters.dl = 'ALL';
  }
  // Si el DF actual no existe en el municipio seleccionado, restablecer a ALL
  if (state.filters.df !== 'ALL' && !dfs.includes(parseInt(state.filters.df, 10))) {
    state.filters.df = 'ALL';
  }

  elements.filterDl.innerHTML = `<option value="ALL">Todos los DL (${dls.length} distritos)</option>`;
  dls.forEach(dl => {
    const count = filteredForOptions.filter(r => r.DL === dl).length;
    const opt = document.createElement('option');
    opt.value = dl;
    opt.textContent = `DL ${dl} (${count} secciones sumadas)`;
    if (String(state.filters.dl) === String(dl)) opt.selected = true;
    elements.filterDl.appendChild(opt);
  });

  elements.filterDf.innerHTML = `<option value="ALL">Todos los DF (${dfs.length} distritos)</option>`;
  dfs.forEach(df => {
    const count = filteredForOptions.filter(r => r.DF === df).length;
    const opt = document.createElement('option');
    opt.value = df;
    opt.textContent = `DF ${df} (${count} secciones sumadas)`;
    if (String(state.filters.df) === String(df)) opt.selected = true;
    elements.filterDf.appendChild(opt);
  });
}

function resetFilters() {
  state.filters.mun = 'ALL';
  state.filters.dl = 'ALL';
  state.filters.df = 'ALL';
  state.filters.seccion = '';

  elements.filterMun.value = 'ALL';
  elements.filterDl.value = 'ALL';
  elements.filterDf.value = 'ALL';
  elements.filterSeccion.value = '';

  updateDlAndDfOptions();
  applyFilters();
}

// Aplicar filtros: Asegura que se sumen todas las secciones que cumplen con el filtro
function applyFilters() {
  const { mun, dl, df, seccion } = state.filters;

  state.filteredRows = state.allRows.filter(r => {
    if (mun !== 'ALL' && r.MUN !== mun) return false;
    if (dl !== 'ALL' && String(r.DL) !== String(dl)) return false;
    if (df !== 'ALL' && String(r.DF) !== String(df)) return false;
    if (seccion && String(r.SECCION) !== seccion) return false;
    return true;
  });

  // Actualizar conteos
  const totalCount = state.filteredRows.length;
  elements.activeSeccionesCount.textContent = totalCount.toLocaleString();
  elements.previewRowCount.textContent = `${totalCount.toLocaleString()} secciones sumadas`;

  // Actualizar Título y subtítulo
  updateTitles();

  // Calcular la suma de votos para cada elección y actualizar gráfica y tarjetas
  updateKpiCards();
  updateChart();
  renderTable();
}

function updateTitles() {
  const count = state.filteredRows.length.toLocaleString();
  let titleParts = [];
  let captionText = '';

  if (state.filters.mun !== 'ALL') {
    titleParts.push(`Municipio: ${state.filters.mun}`);
    captionText += `Suma de todas las secciones del municipio de ${state.filters.mun}`;
  }
  if (state.filters.dl !== 'ALL') {
    titleParts.push(`Distrito Local ${state.filters.dl}`);
    captionText += (captionText ? ', ' : '') + `Distrito Local ${state.filters.dl}`;
  }
  if (state.filters.df !== 'ALL') {
    titleParts.push(`Distrito Federal ${state.filters.df}`);
    captionText += (captionText ? ', ' : '') + `Distrito Federal ${state.filters.df}`;
  }
  if (state.filters.seccion) {
    titleParts.push(`Sección ${state.filters.seccion}`);
    captionText = `Sección individual ${state.filters.seccion}`;
  }

  if (titleParts.length === 0) {
    elements.chartDisplayTitle.textContent = `Suma Total de Secciones: Todos los Municipios (${count} secc.)`;
    elements.chartDisplaySubtitle.textContent = `Suma acumulada de todas las 2,254 secciones electorales de Baja California`;
    elements.filterSummaryCaption.textContent = `Sumando todas las 2,254 secciones del estado.`;
  } else {
    elements.chartDisplayTitle.textContent = `Suma Total de Votos: ${titleParts.join(' | ')}`;
    elements.chartDisplaySubtitle.textContent = `Suma total calculada sobre ${count} secciones electorales`;
    elements.filterSummaryCaption.textContent = `Sumando votos de ${count} secciones (${captionText}).`;
  }
}

// Calcular la SUMA de todas las secciones para cada punto electoral
function updateKpiCards() {
  const rows = state.filteredRows;
  
  const totals = {};
  ELECTORAL_POINTS.forEach(pt => {
    // Suma exacta de todas las secciones filtradas
    const sum = rows.reduce((acc, r) => acc + (r[pt.key] || 0), 0);
    totals[pt.key] = sum;

    // Actualizar valor en el panel de checkboxes
    const badge = document.getElementById(`pt-val-${pt.key}`);
    if (badge) badge.textContent = sum.toLocaleString() + ' votos';
  });

  // Mostrar la SUMA en las 5 tarjetas KPI
  document.getElementById('kpi-gob21').textContent = totals['GOB_21'].toLocaleString();
  document.getElementById('kpi-ayunt21').textContent = totals['AYUNT_21'].toLocaleString();
  document.getElementById('kpi-dip21').textContent = totals['DIP_21'].toLocaleString();
  document.getElementById('kpi-ayunt24').textContent = totals['AYUNT_24'].toLocaleString();
  document.getElementById('kpi-dip24').textContent = totals['DIP_24'].toLocaleString();

  // Deltas porcentuales vs elección anterior
  renderDelta('delta-ayunt21', totals['AYUNT_21'], totals['GOB_21']);
  renderDelta('delta-dip21', totals['DIP_21'], totals['AYUNT_21']);
  renderDelta('delta-ayunt24', totals['AYUNT_24'], totals['DIP_21']);
  renderDelta('delta-dip24', totals['DIP_24'], totals['AYUNT_24']);
}

function renderDelta(elemId, currentVal, prevVal) {
  const elem = document.getElementById(elemId);
  if (!elem) return;
  if (!prevVal || prevVal === 0) {
    elem.textContent = '—';
    elem.className = 'text-[10px] text-slate-500 mt-0.5';
    return;
  }
  const diff = currentVal - prevVal;
  const pct = ((diff / prevVal) * 100).toFixed(1);
  const sign = diff >= 0 ? '+' : '';

  elem.textContent = `${sign}${pct}% vs ant.`;
  elem.className = diff >= 0 
    ? 'text-[10px] font-semibold text-emerald-400 mt-0.5' 
    : 'text-[10px] font-semibold text-rose-400 mt-0.5';
}

// Inicializar Chart.js con soporte de DataLabels (números sobre los puntos)
function initChart() {
  const ctx = elements.chartCanvas.getContext('2d');

  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 28,
          bottom: 10,
          left: 10,
          right: 15
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        // Plugin de etiquetas directas sobre los puntos
        datalabels: {
          display: function() {
            return elements.checkShowValues ? elements.checkShowValues.checked : true;
          },
          align: 'top',
          offset: 8,
          color: '#ffffff',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          borderColor: '#4f46e5',
          borderWidth: 1,
          borderRadius: 6,
          padding: {
            top: 3,
            bottom: 3,
            left: 6,
            right: 6
          },
          font: {
            size: 11,
            weight: 'bold',
            family: 'monospace'
          },
          formatter: function(value) {
            return value !== null && value !== undefined ? Number(value).toLocaleString() : '0';
          }
        },
        legend: {
          position: 'top',
          labels: {
            color: '#cbd5e1',
            font: { size: 12, weight: 'bold', family: 'system-ui' },
            usePointStyle: true,
            boxWidth: 8,
            padding: 14
          }
        },
        tooltip: {
          backgroundColor: '#090d16',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: function(ctx) {
              const val = ctx.parsed.y;
              const formatted = val !== null ? val.toLocaleString() : '0';
              return ` ${ctx.dataset.label}: ${formatted} votos totales sumados`;
            }
          }
        },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x'
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#1e293b' },
          ticks: {
            color: '#f1f5f9',
            font: { size: 12, weight: 'bold' }
          }
        },
        y: {
          grid: { color: '#1e293b' },
          ticks: {
            color: '#94a3b8',
            font: { size: 11 },
            callback: (v) => formatK(v)
          },
          title: {
            display: true,
            text: 'Suma Total de Votos',
            color: '#94a3b8',
            font: { size: 11, weight: 'bold' }
          }
        }
      }
    }
  });
}

function formatK(num) {
  if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(0) + 'k';
  return num;
}

function hexToRgba(hex, alpha = 0.2) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    c = '0x' + c.join('');
    return `rgba(${[(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',')},${alpha})`;
  }
  return hex;
}

// Actualizar la Gráfica con la SUMA de todas las secciones
function updateChart() {
  if (!state.chartInstance) return;

  const rows = state.filteredRows;
  const tension = parseFloat(elements.inputTension.value);
  const fillArea = elements.checkFillArea.checked;
  const showGrid = elements.checkGrid.checked;
  const isStepped = elements.checkStepped.checked;

  const activePointDefs = ELECTORAL_POINTS.filter(pt => state.activePoints.includes(pt.key));
  const labels = activePointDefs.map(pt => pt.label);

  const datasets = [];

  if (rows.length === 0) {
    state.chartInstance.data.labels = labels;
    state.chartInstance.data.datasets = [];
    state.chartInstance.update();
    return;
  }

  // MODO 1 (PREDETERMINADO): LÍNEA PRINCIPAL CON LA SUMA TOTAL DE TODAS LAS SECCIONES
  if (state.groupMode === 'total') {
    // Para cada punto (GOB_21, etc.), se calcula la suma exacta de todas las filas filtradas
    const sumValues = activePointDefs.map(pt => {
      return rows.reduce((acc, r) => acc + (r[pt.key] || 0), 0);
    });

    let seriesLabel = `Suma Total: ${rows.length.toLocaleString()} secciones`;
    if (state.filters.mun !== 'ALL') {
      seriesLabel = `Suma ${state.filters.mun} (${rows.length.toLocaleString()} secciones)`;
    } else if (state.filters.dl !== 'ALL') {
      seriesLabel = `Suma Distrito Local ${state.filters.dl} (${rows.length.toLocaleString()} secciones)`;
    } else if (state.filters.df !== 'ALL') {
      seriesLabel = `Suma Distrito Federal ${state.filters.df} (${rows.length.toLocaleString()} secciones)`;
    }

    const lineColor = state.filters.mun !== 'ALL' 
      ? (MUNICIPALITY_COLORS[state.filters.mun] || '#6366f1')
      : '#6366f1';

    datasets.push({
      label: seriesLabel,
      data: sumValues,
      borderColor: lineColor,
      backgroundColor: fillArea ? hexToRgba(lineColor, 0.22) : 'transparent',
      fill: fillArea,
      tension: tension,
      stepped: isStepped,
      borderWidth: 3.5,
      pointRadius: 6,
      pointHoverRadius: 9,
      pointBackgroundColor: lineColor,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2
    });
  }

  // MODO 2: COMPARATIVA POR MUNICIPIO (Suma de secciones de cada municipio)
  else if (state.groupMode === 'mun') {
    const muns = Array.from(new Set(rows.map(r => r.MUN).filter(Boolean))).sort();

    muns.forEach(mun => {
      const munRows = rows.filter(r => r.MUN === mun);
      const munColor = MUNICIPALITY_COLORS[mun] || SERIES_COLORS[datasets.length % SERIES_COLORS.length];

      // Suma de todas las secciones pertenecientes a este municipio
      const sumValues = activePointDefs.map(pt => {
        return munRows.reduce((acc, r) => acc + (r[pt.key] || 0), 0);
      });

      datasets.push({
        label: `${mun} (Suma de ${munRows.length} secc.)`,
        data: sumValues,
        borderColor: munColor,
        backgroundColor: fillArea ? hexToRgba(munColor, 0.12) : 'transparent',
        fill: fillArea,
        tension: tension,
        stepped: isStepped,
        borderWidth: 2.8,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: munColor,
        pointBorderColor: '#0f172a',
        pointBorderWidth: 1.5
      });
    });
  }

  // MODO 3: COMPARATIVA POR DISTRITO LOCAL (Suma de secciones de cada DL)
  else if (state.groupMode === 'dl') {
    const dls = Array.from(new Set(rows.map(r => r.DL).filter(Boolean))).sort((a,b) => a - b);

    dls.forEach((dl, idx) => {
      const dlRows = rows.filter(r => r.DL === dl);
      const dlColor = SERIES_COLORS[idx % SERIES_COLORS.length];

      // Suma de todas las secciones pertenecientes a este DL
      const sumValues = activePointDefs.map(pt => {
        return dlRows.reduce((acc, r) => acc + (r[pt.key] || 0), 0);
      });

      datasets.push({
        label: `DL ${dl} (Suma de ${dlRows.length} secc.)`,
        data: sumValues,
        borderColor: dlColor,
        backgroundColor: fillArea ? hexToRgba(dlColor, 0.12) : 'transparent',
        fill: fillArea,
        tension: tension,
        stepped: isStepped,
        borderWidth: 2.5,
        pointRadius: 4.5,
        pointHoverRadius: 7,
        pointBackgroundColor: dlColor,
        pointBorderColor: '#0f172a',
        pointBorderWidth: 1.5
      });
    });
  }

  // MODO 4: COMPARATIVA POR DISTRITO FEDERAL (Suma de secciones de cada DF)
  else if (state.groupMode === 'df') {
    const dfs = Array.from(new Set(rows.map(r => r.DF).filter(Boolean))).sort((a,b) => a - b);

    dfs.forEach((df, idx) => {
      const dfRows = rows.filter(r => r.DF === df);
      const dfColor = SERIES_COLORS[idx % SERIES_COLORS.length];

      // Suma de todas las secciones pertenecientes a este DF
      const sumValues = activePointDefs.map(pt => {
        return dfRows.reduce((acc, r) => acc + (r[pt.key] || 0), 0);
      });

      datasets.push({
        label: `DF ${df} (Suma de ${dfRows.length} secc.)`,
        data: sumValues,
        borderColor: dfColor,
        backgroundColor: fillArea ? hexToRgba(dfColor, 0.12) : 'transparent',
        fill: fillArea,
        tension: tension,
        stepped: isStepped,
        borderWidth: 2.5,
        pointRadius: 4.5,
        pointHoverRadius: 7,
        pointBackgroundColor: dfColor,
        pointBorderColor: '#0f172a',
        pointBorderWidth: 1.5
      });
    });
  }

  state.chartInstance.data.labels = labels;
  state.chartInstance.data.datasets = datasets;
  state.chartInstance.options.scales.x.grid.display = showGrid;
  state.chartInstance.options.scales.y.grid.display = showGrid;
  state.chartInstance.update();
}

// Renderizar tabla con las secciones filtradas
function renderTable() {
  const query = elements.tableSearchInput.value.toLowerCase();
  
  const filtered = state.filteredRows.filter(r => {
    if (!query) return true;
    return (
      String(r.MUN).toLowerCase().includes(query) ||
      String(r.DL).includes(query) ||
      String(r.DF).includes(query) ||
      String(r.SECCION).includes(query)
    );
  }).slice(0, 100);

  elements.previewTbody.innerHTML = '';

  if (filtered.length === 0) {
    elements.previewTbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-slate-500">No hay secciones que coincidan con la búsqueda</td></tr>`;
    return;
  }

  filtered.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/70 transition border-b border-slate-800/40';
    tr.innerHTML = `
      <td class="p-2.5 font-sans font-semibold text-white">${r.MUN || '-'}</td>
      <td class="p-2.5 text-slate-400">DL ${r.DL}</td>
      <td class="p-2.5 text-slate-400">DF ${r.DF}</td>
      <td class="p-2.5 font-bold text-indigo-300">Sec. ${r.SECCION}</td>
      <td class="p-2.5 text-right font-mono text-slate-200">${(r.GOB_21 || 0).toLocaleString()}</td>
      <td class="p-2.5 text-right font-mono text-slate-200">${(r.AYUNT_21 || 0).toLocaleString()}</td>
      <td class="p-2.5 text-right font-mono text-slate-200">${(r.DIP_21 || 0).toLocaleString()}</td>
      <td class="p-2.5 text-right font-mono text-emerald-400 font-semibold">${(r.AYUNT_24 || 0).toLocaleString()}</td>
      <td class="p-2.5 text-right font-mono text-emerald-400 font-semibold">${(r.DIP_24 || 0).toLocaleString()}</td>
    `;
    elements.previewTbody.appendChild(tr);
  });
}

// Exportar CSV
function exportFilteredCsv() {
  if (state.filteredRows.length === 0) return;

  const csv = Papa.unparse(state.filteredRows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `consulta_resultados_${state.filters.mun}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// Exportar PNG
function exportChartPng() {
  if (!state.chartInstance) return;

  const canvas = elements.chartCanvas;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width * 2;
  tempCanvas.height = (canvas.height + 70) * 2;
  const ctx = tempCanvas.getContext('2d');
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height + 70);

  // Titles
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px system-ui';
  ctx.fillText(elements.chartDisplayTitle.textContent, 24, 30);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui';
  ctx.fillText(elements.chartDisplaySubtitle.textContent, 24, 48);

  // Draw chart
  ctx.drawImage(canvas, 0, 60);

  const a = document.createElement('a');
  const munTag = state.filters.mun !== 'ALL' ? state.filters.mun : 'GENERAL';
  a.download = `consulta-resultados-${munTag}-${new Date().toISOString().slice(0,10)}.png`;
  a.href = tempCanvas.toDataURL('image/png');
  a.click();
}
