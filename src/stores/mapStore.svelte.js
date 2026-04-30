/** @type {{ view: import('@arcgis/core/views/MapView').default | null, sentieriLayer: any, rifugiLayer: any, locationLayer: any, tracking: boolean, watchId: number|null }} */
export const mapState = $state({ view: null, sentieriLayer: null, rifugiLayer: null, vetteLayer: null, locationLayer: null, tracking: false, watchId: null });

/** Callback per il refresh dei layer — impostato da MapContainer */
let _refreshLayerFn = null;

export function setRefreshLayerFn(fn) {
    _refreshLayerFn = fn;
}

/**
 * Ricarica un layer specifico da Supabase.
 * @param {'Rifugi' | 'Vette' | 'Sentieri'} layerTitle
 */
export async function refreshLayer(layerTitle) {
    if (_refreshLayerFn) await _refreshLayerFn(layerTitle);
}

export const uiState = $state({ panelOpen: true, settingsOpen: false });

export const popupState = $state({
    open: false,
    title: '',
    fields: [],
    editable: false,
    featureId: null,
    layerTitle: '',
    coordinates: null  // { longitude, latitude } per punti editabili
});

/** Highlight handle — plain variable (no proxy) per compatibilità con Esri */
let _highlightHandle = null;

export function setHighlight(handle) {
    _highlightHandle = handle;
}

export function clearHighlight() {
    if (_highlightHandle) {
        _highlightHandle.remove();
        _highlightHandle = null;
    }
}

export function openCustomPopup(title, fields, { editable = false, featureId = null, layerTitle = '', coordinates = null } = {}) {
    if (window.innerWidth <= 540) {
        uiState.panelOpen = false;
    }
    popupState.title = title;
    popupState.fields = fields;
    popupState.editable = editable;
    popupState.featureId = featureId;
    popupState.layerTitle = layerTitle;
    popupState.coordinates = coordinates;
    popupState.open = true;
}

export function closeCustomPopup() {
    popupState.open = false;
    popupState.title = '';
    popupState.fields = [];
    popupState.editable = false;
    popupState.featureId = null;
    popupState.layerTitle = '';
    popupState.coordinates = null;
    clearHighlight();
}

