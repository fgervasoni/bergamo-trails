<script>
    import './AddFeature.css';
    import {Crosshair, Home, Loader, MapPinPlus, Mountain, Navigation, Plus, Route, SquareCheck, Undo2, X} from 'lucide-svelte';
    import {mapState} from '../../../stores/mapStore.svelte.js';
    import {refreshLayer, triggerRequestsRefresh} from '../../../stores/mapStore.svelte.js';
    import {authState, isAdmin} from '../../../stores/authStore.svelte.js';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';
    import {insertRifugio, insertVetta, insertSentiero, fetchTrailRouteSegment} from '../../../services/trailsService.js';
    import {orsQuotaState} from '../../../stores/mapStore.svelte.js';
    import {submitRequest} from '../../../services/requestsService.js';
    import {getModel, castValue, DIFFICOLTA_VALUES} from '../../../models/schema.js';
    import Graphic from '@arcgis/core/Graphic';
    import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
    import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
    import Point from '@arcgis/core/geometry/Point';
    import Polyline from '@arcgis/core/geometry/Polyline';

    let t = $derived(getT());

    let featureType = $state(''); // '' | 'rifugio' | 'vetta' | 'sentiero'
    let formValues = $state({});
    let saving = $state(false);
    let saveStatus = $state(''); // '' | 'success' | 'error'
    let pickingLocation = $state(false);
    let selectedPoint = $state(null);
    let clickHandler = null;
    let previewGraphic = null;
    let gpsLoading = $state(false);

    // Trail drawing state
    let trailPoints = $state([]);
    let routedSegments = $state([]); // Array di segmenti routed [[lon,lat][], ...]
    let routedTrailCoords = $state([]);
    let drawingTrail = $state(false);
    let trailPreviewGraphics = $state([]);
    let routingLoading = $state(false);

    let currentLayerTitle = $derived(
        featureType === 'rifugio' ? 'Rifugi' :
        featureType === 'vetta' ? 'Vette' :
        featureType === 'sentiero' ? 'Sentieri' : ''
    );
    let currentModel = $derived(currentLayerTitle ? getModel(currentLayerTitle) : null);
    let fieldLabels = $derived(t.popup.fieldLabels || {});

    const featureOptions = [
        {type: 'rifugio', icon: Home, layerTitle: 'Rifugi'},
        {type: 'vetta', icon: Mountain, layerTitle: 'Vette'},
        {type: 'sentiero', icon: Route, layerTitle: 'Sentieri'}
    ];

    let isPointFeature = $derived(featureType === 'rifugio' || featureType === 'vetta');
    let isTrailFeature = $derived(featureType === 'sentiero');

    function startAdd(type) {
        featureType = type;
        formValues = {};
        saveStatus = '';
        selectedPoint = null;
        trailPoints = [];
        routedSegments = [];
        routedTrailCoords = [];
        const layerTitle = type === 'rifugio' ? 'Rifugi' : type === 'vetta' ? 'Vette' : 'Sentieri';
        const model = getModel(layerTitle);
        if (model) {
            for (const [key, def] of Object.entries(model.fields)) {
                if (def.editable && !model.hidden.has(key)) {
                    formValues[key] = '';
                }
            }
        }
    }

    function cancelAdd() {
        featureType = '';
        formValues = {};
        saveStatus = '';
        selectedPoint = null;
        trailPoints = [];
        routedSegments = [];
        routedTrailCoords = [];
        stopPicking();
        stopDrawing();
        clearAllPreviews();
    }

    function clearAllPreviews() {
        const layer = mapState.previewLayer;
        if (layer && previewGraphic) {
            layer.remove(previewGraphic);
            previewGraphic = null;
        }
        if (layer) {
            for (const g of trailPreviewGraphics) {
                layer.remove(g);
            }
        }
        trailPreviewGraphics = [];
    }

    // --- Point picking (for rifugio/vetta) ---
    function startPicking() {
        const view = mapState.view;
        if (!view) return;
        pickingLocation = true;
        view.container.style.cursor = 'crosshair';

        clickHandler = view.on('click', (event) => {
            event.stopPropagation();
            const pt = event.mapPoint;
            selectedPoint = {longitude: pt.longitude, latitude: pt.latitude};
            showPointPreview(pt.longitude, pt.latitude);
            stopPicking();
        });
    }

    function showPointPreview(longitude, latitude) {
        const layer = mapState.previewLayer;
        if (layer && previewGraphic) layer.remove(previewGraphic);
        previewGraphic = new Graphic({
            geometry: new Point({longitude, latitude}),
            symbol: new SimpleMarkerSymbol({
                style: 'diamond',
                color: [255, 215, 0, 0.9],
                size: 14,
                outline: {color: '#333', width: 2}
            })
        });
        if (layer) layer.add(previewGraphic);
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

    // --- Use current GPS position ---
    function useCurrentPosition() {
        if (!navigator.geolocation) {
            saveStatus = 'error';
            return;
        }
        gpsLoading = true;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const {longitude, latitude} = position.coords;
                selectedPoint = {longitude, latitude};
                showPointPreview(longitude, latitude);
                gpsLoading = false;
                // Center map on position
                const view = mapState.view;
                if (view) {
                    view.goTo({center: [longitude, latitude], zoom: 15}, {duration: 600});
                }
            },
            () => {
                gpsLoading = false;
                alert(t.addFeature.gpsNotAvailable);
            },
            {enableHighAccuracy: true, timeout: 10000}
        );
    }

    // --- Trail drawing (for sentiero) ---
    function startDrawing() {
        const view = mapState.view;
        if (!view) return;
        drawingTrail = true;
        view.container.style.cursor = 'crosshair';

        clickHandler = view.on('click', (event) => {
            event.stopPropagation();
            const pt = event.mapPoint;
            const newPoint = {longitude: pt.longitude, latitude: pt.latitude};
            trailPoints = [...trailPoints, newPoint];

            // Routing solo dell'ultimo segmento, senza bloccare
            if (trailPoints.length >= 2) {
                const prevPoint = trailPoints[trailPoints.length - 2];
                routeLastSegment(prevPoint, newPoint, trailPoints.length - 2);
            } else {
                drawPreview();
            }
        });
    }

    function stopDrawing() {
        drawingTrail = false;
        if (clickHandler) {
            clickHandler.remove();
            clickHandler = null;
        }
        const view = mapState.view;
        if (view) view.container.style.cursor = '';
    }

    function undoLastTrailPoint() {
        if (trailPoints.length > 0) {
            trailPoints = trailPoints.slice(0, -1);
            routedSegments = routedSegments.slice(0, trailPoints.length > 0 ? trailPoints.length - 1 : 0);
            rebuildRoutedCoords();
            drawPreview();
        }
    }

    function toStraightCoords(points) {
        return points.map(p => [p.longitude, p.latitude]);
    }

    /**
     * Calcola il routing per l'ultimo segmento aggiunto.
     * Mostra subito una linea dritta come preview, poi aggiorna con il routing.
     */
    async function routeLastSegment(start, end, segmentIndex) {
        // Segmento dritto come base
        const straight = [[start.longitude, start.latitude], [end.longitude, end.latitude]];
        routedSegments[segmentIndex] = straight;
        rebuildRoutedCoords();
        drawPreview();

        // Se quota esaurita, non tentare il routing
        if (orsQuotaState.exhausted) return;

        // Calcola routing reale in background
        routingLoading = true;
        try {
            const routed = await fetchTrailRouteSegment(start, end);
            if (routed && routed.length >= 2) {
                if (segmentIndex < routedSegments.length) {
                    routedSegments[segmentIndex] = routed;
                    rebuildRoutedCoords();
                    drawPreview();
                }
            }
        } catch (_) {
            // Mantiene fallback dritto
        } finally {
            routingLoading = false;
        }
    }

    function rebuildRoutedCoords() {
        let merged = [];
        for (const segment of routedSegments) {
            if (!segment || segment.length === 0) continue;
            if (merged.length === 0) {
                merged = [...segment];
            } else {
                // Evita duplicati al punto di giunzione
                const [lastLon, lastLat] = merged[merged.length - 1];
                const [firstLon, firstLat] = segment[0];
                if (Math.abs(lastLon - firstLon) < 1e-8 && Math.abs(lastLat - firstLat) < 1e-8) {
                    merged = [...merged, ...segment.slice(1)];
                } else {
                    merged = [...merged, ...segment];
                }
            }
        }
        routedTrailCoords = merged;
    }

    function drawPreview() {
        const layer = mapState.previewLayer;
        if (!layer) return;

        // Remove old previews
        for (const g of trailPreviewGraphics) {
            layer.remove(g);
        }
        trailPreviewGraphics = [];

        // Draw waypoint markers
        for (const pt of trailPoints) {
            const g = new Graphic({
                geometry: new Point({longitude: pt.longitude, latitude: pt.latitude}),
                symbol: new SimpleMarkerSymbol({
                    style: 'circle',
                    color: [255, 140, 0, 0.9],
                    size: 8,
                    outline: {color: '#333', width: 1.5}
                })
            });
            layer.add(g);
            trailPreviewGraphics = [...trailPreviewGraphics, g];
        }

        // Draw line
        const pathCoords = routedTrailCoords.length >= 2
            ? routedTrailCoords
            : toStraightCoords(trailPoints);

        if (pathCoords.length >= 2) {
            const lineGraphic = new Graphic({
                geometry: new Polyline({paths: [pathCoords]}),
                symbol: new SimpleLineSymbol({
                    color: [230, 111, 81, 0.9],
                    width: 3,
                    style: 'dash'
                })
            });
            layer.add(lineGraphic);
            trailPreviewGraphics = [...trailPreviewGraphics, lineGraphic];
        }
    }

    function finishDrawing() {
        stopDrawing();
    }

    // --- Save ---
    async function handleSave() {
        if (saving) return;

        if (isPointFeature && !selectedPoint) return;
        if (isTrailFeature && trailPoints.length < 2) return;

        saving = true;
        saveStatus = '';

        const model = getModel(currentLayerTitle);
        const record = {};

        if (model) {
            for (const [key, def] of Object.entries(model.fields)) {
                if (def.editable && !model.hidden.has(key)) {
                    record[key] = castValue(formValues[key], def);
                }
            }
        }

        // Geometry
        if (isPointFeature) {
            record.geom = `SRID=4326;POINT(${selectedPoint.longitude} ${selectedPoint.latitude})`;
        } else if (isTrailFeature) {
            const coords = routedTrailCoords.length >= 2
                ? routedTrailCoords
                : toStraightCoords(trailPoints);
            const coordsStr = coords.map(([lon, lat]) => `${lon} ${lat}`).join(',');
            record.geom = `SRID=4326;LINESTRING(${coordsStr})`;
        }

        try {
            if (isAdmin()) {
                // Admin: inserisci direttamente
                let insertFn;
                if (featureType === 'rifugio') insertFn = insertRifugio;
                else if (featureType === 'vetta') insertFn = insertVetta;
                else insertFn = insertSentiero;

                const result = await insertFn(record);
                if (result) {
                    saveStatus = 'success';
                    clearAllPreviews();
                    await refreshLayer(currentLayerTitle);
                    setTimeout(() => {
                        cancelAdd();
                    }, 1500);
                } else {
                    saveStatus = 'error';
                }
            } else {
                // Utente normale: invia richiesta
                const result = await submitRequest(
                    'create', currentLayerTitle, record, null, authState.user?.email
                );
                if (result.success) {
                    saveStatus = 'requested';
                    clearAllPreviews();
                    triggerRequestsRefresh();
                    setTimeout(() => {
                        cancelAdd();
                    }, 2500);
                } else {
                    saveStatus = 'error';
                }
            }
        } catch {
            saveStatus = 'error';
        } finally {
            saving = false;
        }
    }
</script>

{#if authState.user}
    <div class="cai-add-feature">
        {#if !featureType}
            <span class="cai-section-label">{t.addFeature.title}</span>
            <div class="cai-add-buttons">
                {#each featureOptions as opt}
                    <button class="cai-add-type-btn" onclick={() => startAdd(opt.type)}>
                        <svelte:component this={opt.icon} size={16} strokeWidth={2}/>
                        <span>{t.addFeature[opt.type]}</span>
                    </button>
                {/each}
            </div>
        {:else}
            <div class="cai-add-form-header">
                <span class="cai-section-label">
                    <Plus size={14} strokeWidth={2}/>
                    {t.addFeature[featureType]}
                </span>
                <button class="cai-add-cancel-btn" onclick={cancelAdd} aria-label={t.popup.cancel}>
                    <X size={14} strokeWidth={2}/>
                </button>
            </div>

            <div class="cai-add-form">
                {#if currentModel}
                    {#each Object.entries(currentModel.fields).filter(([key, def]) => def.editable && !currentModel.hidden.has(key)) as [key, def]}
                        <div class="cai-add-field">
                            <label class="cai-add-field-label" for="add-{key}">
                                {fieldLabels[key] || key}
                            </label>
                            {#if key === 'difficolta' && isTrailFeature}
                                <select
                                    id="add-{key}"
                                    class="cai-add-input"
                                    bind:value={formValues[key]}
                                    disabled={saving}
                                >
                                    <option value="">—</option>
                                    {#each DIFFICOLTA_VALUES as val}
                                        <option value={val}>{val}</option>
                                    {/each}
                                </select>
                            {:else}
                                <input
                                    id="add-{key}"
                                    class="cai-add-input"
                                    type={def.type === 'integer' || def.type === 'bigint' ? 'number' : 'text'}
                                    bind:value={formValues[key]}
                                    disabled={saving}
                                    placeholder="—"
                                />
                            {/if}
                        </div>
                    {/each}
                {/if}

                <!-- Point location (rifugio/vetta) -->
                {#if isPointFeature}
                    <div class="cai-add-location">
                        <label class="cai-add-field-label">{t.addFeature.position}</label>
                        {#if selectedPoint}
                            <span class="cai-add-coords">
                                {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
                            </span>
                        {/if}
                        <div class="cai-add-location-buttons">
                            <button
                                class="cai-add-pick-btn"
                                class:active={pickingLocation}
                                onclick={startPicking}
                                disabled={saving}
                                type="button"
                            >
                                <MapPinPlus size={14} strokeWidth={2}/>
                                {selectedPoint ? t.addFeature.changePosition : t.addFeature.pickPosition}
                            </button>
                            <button
                                class="cai-add-pick-btn"
                                onclick={useCurrentPosition}
                                disabled={saving || gpsLoading}
                                type="button"
                            >
                                {#if gpsLoading}
                                    <Loader size={14} strokeWidth={2} class="cai-spinning"/>
                                {:else}
                                    <Navigation size={14} strokeWidth={2}/>
                                {/if}
                                {t.addFeature.useCurrentPosition}
                            </button>
                        </div>
                    </div>
                {/if}

                <!-- Trail drawing (sentiero) -->
                {#if isTrailFeature}
                    <div class="cai-add-location">
                        <label class="cai-add-field-label">{t.addFeature.trailDraw}</label>
                        {#if !isAdmin()}
                            <span class="cai-add-hint">{t.addFeature.trailDrawHint}</span>
                        {/if}
                        {#if trailPoints.length > 0}
                            <span class="cai-add-coords">
                                {t.addFeature.trailPoints.replace('{count}', trailPoints.length)}
                            </span>
                        {/if}
                        {#if routingLoading}
                            <span class="cai-add-status">{t.addFeature.trailRouting}</span>
                        {/if}
                        <div class="cai-add-location-buttons">
                            {#if !drawingTrail}
                                <button
                                    class="cai-add-pick-btn"
                                    onclick={startDrawing}
                                    disabled={saving}
                                    type="button"
                                >
                                    <Crosshair size={14} strokeWidth={2}/>
                                    {t.addFeature.pickPosition}
                                </button>
                            {:else}
                                <button
                                    class="cai-add-pick-btn active"
                                    onclick={finishDrawing}
                                    disabled={saving}
                                    type="button"
                                >
                                    <SquareCheck size={14} strokeWidth={2}/>
                                    {t.addFeature.finishTrail}
                                </button>
                            {/if}
                            {#if trailPoints.length > 0}
                                <button
                                    class="cai-add-pick-btn"
                                    onclick={undoLastTrailPoint}
                                    disabled={saving}
                                    type="button"
                                >
                                    <Undo2 size={14} strokeWidth={2}/>
                                    {t.addFeature.undoLastPoint}
                                </button>
                            {/if}
                        </div>
                        {#if trailPoints.length > 0 && trailPoints.length < 2}
                            <span class="cai-add-status error">{t.addFeature.trailMinPoints}</span>
                        {/if}
                        {#if orsQuotaState.exhausted}
                            <span class="cai-add-status error">{t.addFeature.routingExhausted}</span>
                        {/if}
                    </div>
                {/if}

                {#if saveStatus === 'success'}
                    <span class="cai-add-status success">{t.popup.saveSuccess}</span>
                {:else if saveStatus === 'requested'}
                    <span class="cai-add-status success">{t.request.submitted}</span>
                {:else if saveStatus === 'error'}
                    <span class="cai-add-status error">{t.popup.saveError}</span>
                {/if}

                <button
                    class="cai-add-save-btn"
                    onclick={handleSave}
                    disabled={saving || (isPointFeature && !selectedPoint) || (isTrailFeature && trailPoints.length < 2)}
                >
                    {#if saving}
                        <Loader size={14} strokeWidth={2} class="cai-spinning"/>
                        {t.popup.saving}
                    {:else}
                        <Plus size={14} strokeWidth={2}/>
                        {t.addFeature.add}
                    {/if}
                </button>
            </div>
        {/if}
    </div>
{/if}
