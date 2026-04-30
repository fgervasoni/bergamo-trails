/** @type {{ view: import('@arcgis/core/views/MapView').default | null, sentieriLayer: any, rifugiLayer: any, locationLayer: any, tracking: boolean, watchId: number|null }} */
export const mapState = $state({ view: null, sentieriLayer: null, rifugiLayer: null, locationLayer: null, tracking: false, watchId: null });

export const uiState = $state({ panelOpen: true, settingsOpen: false });

export const popupState = $state({
    open: false,
    title: '',
    fields: []
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

export function openCustomPopup(title, fields) {
    if (window.innerWidth <= 540) {
        uiState.panelOpen = false;
    }
    popupState.title = title;
    popupState.fields = fields;
    popupState.open = true;
}

export function closeCustomPopup() {
    popupState.open = false;
    popupState.title = '';
    popupState.fields = [];
    clearHighlight();
}

