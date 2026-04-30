<script>
    import './SearchBar.css';
    import {Footprints, Home, MapPin, Mountain, Search, X} from 'lucide-svelte';
    import {
        clearHighlight,
        closeCustomPopup,
        mapState,
        openCustomPopup,
        setHighlight,
        uiState
    } from '../../../stores/mapStore.svelte.js';
    import {addressToLocations} from '@arcgis/core/rest/locator.js';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';
    import {buildPopupData} from '../../../utils/popupUtils.js';

    let t = $derived(getT());

    let query = $state('');
    let results = $state([]);
    let searching = $state(false);
    let showResults = $state(false);
    let searchTimeout = null;
    let inputEl;

    const GEOCODE_URL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';

    async function suggest(text) {
        const view = mapState.view;
        if (!view || !text.trim()) {
            results = [];
            showResults = false;
            return;
        }

        searching = true;
        try {
            const allResults = [];

            if (mapState.sentieriLayer) {
                const sentieriQuery = mapState.sentieriLayer.createQuery();
                sentieriQuery.where = `numero_cai LIKE '%${text.replace(/'/g, "''")}%'`;
                sentieriQuery.outFields = ['*'];
                sentieriQuery.returnGeometry = true;
                sentieriQuery.num = 5;
                try {
                    const sRes = await mapState.sentieriLayer.queryFeatures(sentieriQuery);
                    for (const f of sRes.features) {
                        allResults.push({
                            text: `${t.search.trail} ${f.attributes.numero_cai} (${f.attributes.difficolta || 'N/D'})`,
                            type: 'sentiero',
                            geometry: f.geometry,
                            feature: f,
                            layer: mapState.sentieriLayer
                        });
                    }
                } catch { /* ignore */
                }
            }

            if (mapState.rifugiLayer) {
                const rifugiQuery = mapState.rifugiLayer.createQuery();
                rifugiQuery.where = `UPPER(nome) LIKE '%${text.toUpperCase().replace(/'/g, "''")}%'`;
                rifugiQuery.outFields = ['*'];
                rifugiQuery.returnGeometry = true;
                rifugiQuery.num = 5;
                try {
                    const rRes = await mapState.rifugiLayer.queryFeatures(rifugiQuery);
                    for (const f of rRes.features) {
                        allResults.push({
                            text: `${f.attributes.nome}${f.attributes.quota ? ` (${f.attributes.quota}m)` : ''}`,
                            type: 'rifugio',
                            geometry: f.geometry,
                            feature: f,
                            layer: mapState.rifugiLayer
                        });
                    }
                } catch { /* ignore */
                }
            }

            if (mapState.vetteLayer) {
                const vetteQuery = mapState.vetteLayer.createQuery();
                vetteQuery.where = `UPPER(nome) LIKE '%${text.toUpperCase().replace(/'/g, "''")}%'`;
                vetteQuery.outFields = ['*'];
                vetteQuery.returnGeometry = true;
                vetteQuery.num = 5;
                try {
                    const vRes = await mapState.vetteLayer.queryFeatures(vetteQuery);
                    for (const f of vRes.features) {
                        allResults.push({
                            text: `${f.attributes.nome}${f.attributes.quota ? ` (${f.attributes.quota}m)` : ''}`,
                            type: 'vetta',
                            geometry: f.geometry,
                            feature: f,
                            layer: mapState.vetteLayer
                        });
                    }
                } catch { /* ignore */
                }
            }

            try {
                const geoResponse = await addressToLocations(GEOCODE_URL, {
                    address: {SingleLine: text},
                    location: view.center,
                    countryCode: 'IT',
                    outFields: ['Addr_type'],
                    maxLocations: 3
                });
                for (const r of geoResponse) {
                    allResults.push({
                        text: r.address,
                        type: 'indirizzo',
                        location: r.location
                    });
                }
            } catch { /* ignore */
            }

            results = allResults;
            showResults = results.length > 0;
        } catch {
            results = [];
        } finally {
            searching = false;
        }
    }

    function onInput() {
        clearTimeout(searchTimeout);
        if (query.trim().length >= 2) {
            searchTimeout = setTimeout(() => suggest(query), 300);
        } else {
            results = [];
            showResults = false;
        }
    }

    async function selectResult(result) {
        const view = mapState.view;
        if (!view) return;
        query = result.text;
        showResults = false;
        results = [];

        closeCustomPopup();

        if (result.geometry) {
            const goTarget = result.geometry.type === 'point'
                ? {target: result.geometry, zoom: 15}
                : result.geometry.extent.expand(1.5);

            await view.goTo(goTarget);

            if (result.feature && result.layer) {
                try {
                    const lv = await view.whenLayerView(result.layer);
                    await lv.whenOrOnce?.('updating', false) ?? true;
                    clearHighlight();
                    const oid = result.feature.attributes[result.layer.objectIdField] ?? result.feature.getObjectId?.();
                    if (oid != null) {
                        setHighlight(lv.highlight(oid));
                    } else {
                        setHighlight(lv.highlight(result.feature));
                    }
                } catch (e) {
                    console.error('Highlight error:', e);
                }

                const attrs = result.feature.attributes;
                const lTitle = result.layer?.title || '';
                const {title, fields, editable, featureId, layerTitle: lt} = buildPopupData(attrs, lTitle, t);
                const geom = result.feature.geometry;
                const coordinates = geom?.type === 'point'
                    ? {longitude: geom.longitude, latitude: geom.latitude}
                    : null;
                openCustomPopup(title, fields, {editable, featureId, layerTitle: lt, coordinates});
            }
        } else if (result.location) {
            if (window.innerWidth <= 540) uiState.panelOpen = false;
            view.goTo({center: result.location, zoom: 15});
        }
    }

    function clear() {
        query = '';
        results = [];
        showResults = false;
        inputEl?.focus();
    }

    function getIcon(type) {
        if (type === 'sentiero') return Footprints;
        if (type === 'rifugio') return Home;
        if (type === 'vetta') return Mountain;
        return MapPin;
    }

    function getTypeLabel(type) {
        if (type === 'sentiero') return t.search.trail;
        if (type === 'rifugio') return t.search.shelter;
        if (type === 'vetta') return t.search.peak;
        return t.search.address;
    }
</script>

<div class="cai-search-bar">
    <div class="cai-search-input-wrap">
        <Search size={16} strokeWidth={2}/>
        <input
                aria-label={t.search.placeholder}
                bind:this={inputEl}
                bind:value={query}
                onblur={() => setTimeout(() => showResults = false, 200)}
                onfocus={() => { if (results.length) showResults = true; }}
                oninput={onInput}
                placeholder={t.search.placeholder}
                type="text"
        />
        {#if query}
            <button class="cai-search-clear" onclick={clear} aria-label={t.search.clear}>
                <X size={14} strokeWidth={2}/>
            </button>
        {/if}
    </div>

    {#if showResults}
        <ul class="cai-search-results" role="listbox">
            {#each results as result}
                <li role="option">
                    <button class="cai-search-result-item" onclick={() => selectResult(result)}>
                        <svelte:component this={getIcon(result.type)} size={14} strokeWidth={2}/>
                        <div class="cai-search-result-text">
                            <span class="cai-search-result-name">{result.text}</span>
                            <span class="cai-search-result-type">{getTypeLabel(result.type)}</span>
                        </div>
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>

