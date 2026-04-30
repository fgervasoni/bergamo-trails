<script>
    import './AddFeature.css';
    import {Home, Loader, MapPinPlus, Mountain, Plus, X} from 'lucide-svelte';
    import {mapState} from '../../../stores/mapStore.svelte.js';
    import {refreshLayer} from '../../../stores/mapStore.svelte.js';
    import {authState} from '../../../stores/authStore.svelte.js';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';
    import {insertRifugio, insertVetta} from '../../../services/trailsService.js';
    import {getModel, castValue} from '../../../models/schema.js';
    import Graphic from '@arcgis/core/Graphic';
    import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
    import Point from '@arcgis/core/geometry/Point';

    let t = $derived(getT());

    let featureType = $state(''); // '' | 'rifugio' | 'vetta'
    let formValues = $state({});
    let saving = $state(false);
    let saveStatus = $state(''); // '' | 'success' | 'error'
    let pickingLocation = $state(false);
    let selectedPoint = $state(null);
    let clickHandler = null;
    let previewGraphic = null;

    let currentLayerTitle = $derived(featureType === 'rifugio' ? 'Rifugi' : featureType === 'vetta' ? 'Vette' : '');
    let currentModel = $derived(currentLayerTitle ? getModel(currentLayerTitle) : null);
    let fieldLabels = $derived(t.popup.fieldLabels || {});

    const featureOptions = [
        {type: 'rifugio', icon: Home, layerTitle: 'Rifugi'},
        {type: 'vetta', icon: Mountain, layerTitle: 'Vette'}
    ];

    function startAdd(type) {
        featureType = type;
        formValues = {};
        saveStatus = '';
        selectedPoint = null;
        // Pre-fill form keys from model
        const layerTitle = type === 'rifugio' ? 'Rifugi' : 'Vette';
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
        stopPicking();
    }

    function startPicking() {
        const view = mapState.view;
        if (!view) return;
        pickingLocation = true;
        view.container.style.cursor = 'crosshair';

        clickHandler = view.on('click', (event) => {
            event.stopPropagation();
            const pt = event.mapPoint;
            selectedPoint = {longitude: pt.longitude, latitude: pt.latitude};

            // Show preview marker
            const layer = mapState.locationLayer;
            if (layer && previewGraphic) layer.remove(previewGraphic);
            previewGraphic = new Graphic({
                geometry: new Point({longitude: pt.longitude, latitude: pt.latitude}),
                symbol: new SimpleMarkerSymbol({
                    style: 'diamond',
                    color: [255, 215, 0, 0.9],
                    size: 14,
                    outline: {color: '#333', width: 2}
                })
            });
            if (layer) layer.add(previewGraphic);

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

    async function handleSave() {
        if (!selectedPoint || saving) return;
        saving = true;
        saveStatus = '';

        const layerTitle = featureType === 'rifugio' ? 'Rifugi' : 'Vette';
        const model = getModel(layerTitle);
        const record = {};

        // Cast dei valori dal form
        if (model) {
            for (const [key, def] of Object.entries(model.fields)) {
                if (def.editable && !model.hidden.has(key)) {
                    record[key] = castValue(formValues[key], def);
                }
            }
        }

        // Aggiunta geometria in formato WKT
        record.geom = `SRID=4326;POINT(${selectedPoint.longitude} ${selectedPoint.latitude})`;

        try {
            const insertFn = featureType === 'rifugio' ? insertRifugio : insertVetta;
            const result = await insertFn(record);
            if (result) {
                saveStatus = 'success';
                // Clean up preview
                const layer = mapState.locationLayer;
                if (layer && previewGraphic) {
                    layer.remove(previewGraphic);
                    previewGraphic = null;
                }
                // Refresh del layer sulla mappa
                await refreshLayer(currentLayerTitle);
                setTimeout(() => {
                    cancelAdd();
                }, 1500);
            } else {
                saveStatus = 'error';
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
                            <input
                                id="add-{key}"
                                class="cai-add-input"
                                type={def.type === 'integer' || def.type === 'bigint' ? 'number' : 'text'}
                                bind:value={formValues[key]}
                                disabled={saving}
                                placeholder="—"
                            />
                        </div>
                    {/each}
                {/if}

                <div class="cai-add-location">
                    <label class="cai-add-field-label">{t.addFeature.position}</label>
                    {#if selectedPoint}
                        <span class="cai-add-coords">
                            {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
                        </span>
                    {/if}
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
                </div>

                {#if saveStatus === 'success'}
                    <span class="cai-add-status success">{t.popup.saveSuccess}</span>
                {:else if saveStatus === 'error'}
                    <span class="cai-add-status error">{t.popup.saveError}</span>
                {/if}

                <button
                    class="cai-add-save-btn"
                    onclick={handleSave}
                    disabled={saving || !selectedPoint}
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






