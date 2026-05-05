<script>
    import './CustomPopup.css';
    import {Pencil, Trash2, X, Check, Loader, MapPinPlus, Home, Mountain} from 'lucide-svelte';
    import {closeCustomPopup, mapState, popupState, refreshLayer} from '../../stores/mapStore.svelte.js';
    import {getT} from '../../assets/i18n/i18n.svelte.js';
    import {updateRifugio, updateVetta, deleteRifugio, deleteVetta, fetchNearbyPois} from '../../services/trailsService.js';
    import {getModel, castValue, inputTypeFor} from '../../models/schema.js';
    import {authState} from '../../stores/authStore.svelte.js';
    import Graphic from '@arcgis/core/Graphic';
    import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
    import Point from '@arcgis/core/geometry/Point';

    let t = $derived(getT());

    let visible = $state(false);
    let closing = $state(false);
    let editing = $state(false);
    let saving = $state(false);
    let deleting = $state(false);
    let confirmingDelete = $state(false);
    let pickingLocation = $state(false);
    let saveStatus = $state(''); // '' | 'success' | 'error' | 'deleted' | 'deleteError'

    let cachedTitle = $state('');
    let cachedFields = $state([]);
    let cachedEditable = $state(false);
    let cachedFeatureId = $state(null);
    let cachedLayerTitle = $state('');
    let cachedCoordinates = $state(null);

    /** Copia editabile dei valori durante la modifica */
    let editValues = $state({});
    let editCoords = $state(null); // { latitude, longitude } — null = non modificate
    let clickHandler = null;
    let previewGraphic = null;

    /** Nearby POIs (solo per sentieri) */
    let nearbyPois = $state(null); // { rifugi: [], vette: [] }
    let nearbyLoading = $state(false);

    $effect(() => {
        if (popupState.open) {
            cachedTitle = popupState.title;
            cachedFields = popupState.fields;
            cachedEditable = popupState.editable;
            cachedFeatureId = popupState.featureId;
            cachedLayerTitle = popupState.layerTitle;
            cachedCoordinates = popupState.coordinates;
            editing = false;
            saving = false;
            deleting = false;
            confirmingDelete = false;
            saveStatus = '';
            closing = false;
            visible = true;
            nearbyPois = null;
            nearbyLoading = false;

            // Carica POI vicini per sentieri
            if (popupState.layerTitle === 'Sentieri' && popupState.featureId) {
                loadNearbyPois(popupState.featureId);
            }
        } else if (visible && !closing) {
            closing = true;
            setTimeout(() => {
                visible = false;
                closing = false;
                editing = false;
                confirmingDelete = false;
                nearbyPois = null;
            }, 220);
        }
    });

    async function loadNearbyPois(sentieroId) {
        nearbyLoading = true;
        const data = await fetchNearbyPois(sentieroId);
        nearbyPois = data;
        nearbyLoading = false;
    }

    function goToPoi(poi) {
        const view = mapState.view;
        if (!view || !poi.longitude || !poi.latitude) return;
        view.goTo({ center: [poi.longitude, poi.latitude], zoom: 15 }, { duration: 600 });
    }

    function dismiss() {
        stopPicking();
        cleanupPreview();
        closing = true;
        setTimeout(() => {
            visible = false;
            closing = false;
            editing = false;
            confirmingDelete = false;
            closeCustomPopup();
        }, 220);
    }

    function startEdit() {
        editValues = {};
        const model = getModel(cachedLayerTitle);
        for (const field of cachedFields) {
            let val = field.value ?? '';
            // Per campi numerici, rimuovi suffissi di formattazione (es. "1650 m" → "1650")
            const def = model?.fields[field.key];
            if (def && (def.type === 'integer' || def.type === 'bigint') && typeof val === 'string') {
                val = val.replace(/[^\d\-]/g, '');
            }
            editValues[field.key] = val;
        }
        editCoords = null;
        saveStatus = '';
        confirmingDelete = false;
        editing = true;
    }

    function cancelEdit() {
        editing = false;
        saveStatus = '';
        confirmingDelete = false;
        stopPicking();
        cleanupPreview();
        editCoords = null;
    }

    function startPicking() {
        const view = mapState.view;
        if (!view) return;
        pickingLocation = true;
        view.container.style.cursor = 'crosshair';

        clickHandler = view.on('click', (event) => {
            event.stopPropagation();
            const pt = event.mapPoint;
            editCoords = { latitude: pt.latitude, longitude: pt.longitude };

            // Preview marker
            cleanupPreview();
            const layer = mapState.locationLayer;
            if (layer) {
                previewGraphic = new Graphic({
                    geometry: new Point({ longitude: pt.longitude, latitude: pt.latitude }),
                    symbol: new SimpleMarkerSymbol({
                        style: 'diamond',
                        color: [255, 215, 0, 0.9],
                        size: 14,
                        outline: { color: '#333', width: 2 }
                    })
                });
                layer.add(previewGraphic);
            }
            stopPicking();
        });
    }

    function stopPicking() {
        pickingLocation = false;
        if (clickHandler) {
            clickHandler.remove();
            clickHandler = null;
        }
        const view = mapState.view;
        if (view) view.container.style.cursor = '';
    }

    function cleanupPreview() {
        const layer = mapState.locationLayer;
        if (layer && previewGraphic) {
            layer.remove(previewGraphic);
            previewGraphic = null;
        }
    }

    async function saveEdit() {
        if (!cachedFeatureId || saving) return;
        saving = true;
        saveStatus = '';

        const model = getModel(cachedLayerTitle);
        const updates = {};
        for (const field of cachedFields) {
            const def = model?.fields[field.key];
            if (!def || !def.editable) continue;
            let val = editValues[field.key];
            if (typeof val === 'string') val = val.trim();
            if ((def.type === 'integer' || def.type === 'bigint') && typeof val === 'string') {
                val = val.replace(/[^\d\-]/g, '');
            }
            updates[field.key] = castValue(val, def);
        }

        // Aggiorna coordinate se l'utente ha selezionato un nuovo punto
        if (editCoords) {
            updates.geom = `SRID=4326;POINT(${editCoords.longitude} ${editCoords.latitude})`;
        }

        try {
            const updateFn = cachedLayerTitle === 'Vette' ? updateVetta : updateRifugio;
            const result = await updateFn(cachedFeatureId, updates);
            if (result) {
                cachedFields = cachedFields.map(f => ({
                    ...f,
                    value: formatDisplayValue(f.key, updates[f.key])
                }));
                if (editCoords) {
                    cachedCoordinates = { ...editCoords };
                }
                cleanupPreview();
                saveStatus = 'success';
                // Refresh layer sulla mappa
                await refreshLayer(cachedLayerTitle);
                setTimeout(() => {
                    editing = false;
                    saveStatus = '';
                }, 1200);
            } else {
                saveStatus = 'error';
            }
        } catch {
            saveStatus = 'error';
        } finally {
            saving = false;
        }
    }

    async function handleDelete() {
        if (!cachedFeatureId || deleting) return;
        if (!confirmingDelete) {
            confirmingDelete = true;
            return;
        }
        deleting = true;
        saveStatus = '';

        try {
            const deleteFn = cachedLayerTitle === 'Vette' ? deleteVetta : deleteRifugio;
            const success = await deleteFn(cachedFeatureId);
            if (success) {
                saveStatus = 'deleted';
                await refreshLayer(cachedLayerTitle);
                setTimeout(() => dismiss(), 1200);
            } else {
                saveStatus = 'deleteError';
                confirmingDelete = false;
            }
        } catch {
            saveStatus = 'deleteError';
            confirmingDelete = false;
        } finally {
            deleting = false;
        }
    }

    function formatDisplayValue(key, value) {
        if (value == null || value === '') return null;
        if (key === 'quota') return `${value} m`;
        return String(value);
    }
</script>

{#if visible}
    <div class="cai-popup-card" class:cai-popup-closing={closing}>
        <div class="cai-popup-header">
            <span class="cai-popup-title">{cachedTitle}</span>
            <div class="cai-popup-header-actions">
                {#if cachedEditable && !editing && authState.user}
                    <button class="cai-popup-edit" onclick={startEdit} aria-label={t.popup.edit} title={t.popup.edit}>
                        <Pencil size={13} strokeWidth={2}/>
                    </button>
                    <button class="cai-popup-delete-btn" onclick={handleDelete} aria-label={t.popup.delete} title={t.popup.delete}>
                        <Trash2 size={13} strokeWidth={2}/>
                    </button>
                {/if}
                <button class="cai-popup-close" onclick={dismiss} aria-label={t.popup.close}>
                    <X size={14} strokeWidth={2}/>
                </button>
            </div>
        </div>
        <div class="cai-popup-body">
            {#if confirmingDelete && !editing}
                <div class="cai-popup-confirm-delete">
                    <span class="cai-popup-confirm-text">{t.popup.deleteConfirm}</span>
                    <div class="cai-popup-edit-actions">
                        {#if saveStatus === 'deleted'}
                            <span class="cai-popup-save-status success">{t.popup.deleteSuccess}</span>
                        {:else if saveStatus === 'deleteError'}
                            <span class="cai-popup-save-status error">{t.popup.deleteError}</span>
                        {/if}
                        <button class="cai-popup-btn cancel" onclick={() => confirmingDelete = false} disabled={deleting}>
                            {t.popup.cancel}
                        </button>
                        <button class="cai-popup-btn delete" onclick={handleDelete} disabled={deleting}>
                            {#if deleting}
                                <Loader size={14} strokeWidth={2} class="cai-spinning"/>
                                {t.popup.deleting}
                            {:else}
                                <Trash2 size={14} strokeWidth={2}/>
                                {t.popup.delete}
                            {/if}
                        </button>
                    </div>
                </div>
            {:else if editing}
                <!-- Modalità editing -->
                {#each cachedFields as field}
                    {@const model = getModel(cachedLayerTitle)}
                    {@const def = model?.fields[field.key]}
                    <div class="cai-popup-field cai-popup-field-edit">
                        <label class="cai-popup-field-label" for="edit-{field.key}">{field.label}</label>
                        <input
                            id="edit-{field.key}"
                            class="cai-popup-input"
                            type={def ? inputTypeFor(def) : 'text'}
                            bind:value={editValues[field.key]}
                            placeholder="—"
                            disabled={saving}
                        />
                    </div>
                {/each}
                <!-- Coordinate: pick on map -->
                {#if cachedCoordinates}
                    <div class="cai-popup-coords-section">
                        <span class="cai-popup-field-label">{t.popup.coordinates}</span>
                        <span class="cai-popup-coords-value">
                            {#if editCoords}
                                {editCoords.latitude.toFixed(5)}, {editCoords.longitude.toFixed(5)}
                            {:else}
                                {cachedCoordinates.latitude.toFixed(5)}, {cachedCoordinates.longitude.toFixed(5)}
                            {/if}
                        </span>
                        <button
                            class="cai-popup-pick-btn"
                            class:active={pickingLocation}
                            onclick={startPicking}
                            disabled={saving}
                            type="button"
                        >
                            <MapPinPlus size={14} strokeWidth={2}/>
                            {editCoords ? t.popup.changePosition : t.popup.pickPosition}
                        </button>
                    </div>
                {/if}
                <div class="cai-popup-edit-actions">
                    {#if saveStatus === 'success'}
                        <span class="cai-popup-save-status success">{t.popup.saveSuccess}</span>
                    {:else if saveStatus === 'error'}
                        <span class="cai-popup-save-status error">{t.popup.saveError}</span>
                    {/if}
                    <button class="cai-popup-btn cancel" onclick={cancelEdit} disabled={saving}>
                        {t.popup.cancel}
                    </button>
                    <button class="cai-popup-btn save" onclick={saveEdit} disabled={saving}>
                        {#if saving}
                            <Loader size={14} strokeWidth={2} class="cai-spinning"/>
                        {:else}
                            <Check size={14} strokeWidth={2}/>
                        {/if}
                        {saving ? t.popup.saving : t.popup.save}
                    </button>
                </div>
            {:else}
                <!-- Modalità lettura -->
                {#each cachedFields as field}
                    <div class="cai-popup-field">
                        <span class="cai-popup-field-label">{field.label}</span>
                        <span class="cai-popup-field-value">{field.value ?? '—'}</span>
                    </div>
                {/each}
                {#if cachedCoordinates}
                    <div class="cai-popup-field">
                        <span class="cai-popup-field-label">{t.popup.coordinates}</span>
                        <span class="cai-popup-field-value cai-popup-coords-value">
                            {cachedCoordinates.latitude.toFixed(5)}, {cachedCoordinates.longitude.toFixed(5)}
                        </span>
                    </div>
                {/if}
                <!-- Nelle vicinanze (solo sentieri) -->
                {#if cachedLayerTitle === 'Sentieri'}
                    <div class="cai-popup-nearby-section">
                        <span class="cai-popup-field-label">{t.nearby.title}</span>
                        {#if nearbyLoading}
                            <div class="cai-popup-nearby-loading">
                                <Loader size={14} strokeWidth={2} class="cai-spinning"/>
                                <span>{t.nearby.loading}</span>
                            </div>
                        {:else if nearbyPois && (nearbyPois.rifugi.length > 0 || nearbyPois.vette.length > 0)}
                            <div class="cai-popup-nearby-list">
                                {#each nearbyPois.rifugi as poi}
                                    <button class="cai-popup-nearby-item" onclick={() => goToPoi(poi)} type="button">
                                        <Home size={12} strokeWidth={2} class="cai-nearby-icon shelter"/>
                                        <span class="cai-popup-nearby-name">{poi.nome}</span>
                                        {#if poi.quota}
                                            <span class="cai-popup-nearby-quota">{poi.quota}{t.nearby.meters}</span>
                                        {/if}
                                        <span class="cai-popup-nearby-distance">{poi.distanza_m}{t.nearby.meters}</span>
                                    </button>
                                {/each}
                                {#each nearbyPois.vette as poi}
                                    <button class="cai-popup-nearby-item" onclick={() => goToPoi(poi)} type="button">
                                        <Mountain size={12} strokeWidth={2} class="cai-nearby-icon peak"/>
                                        <span class="cai-popup-nearby-name">{poi.nome}</span>
                                        {#if poi.quota}
                                            <span class="cai-popup-nearby-quota">{poi.quota}{t.nearby.meters}</span>
                                        {/if}
                                        <span class="cai-popup-nearby-distance">{poi.distanza_m}{t.nearby.meters}</span>
                                    </button>
                                {/each}
                            </div>
                        {:else if nearbyPois}
                            <span class="cai-popup-nearby-empty">{t.nearby.noResults}</span>
                        {/if}
                    </div>
                {/if}
            {/if}
        </div>
    </div>
{/if}
