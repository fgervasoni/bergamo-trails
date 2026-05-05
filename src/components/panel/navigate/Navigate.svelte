<script>
    import './Navigate.css';
    import {Navigation, Home, Mountain, Loader, X} from 'lucide-svelte';
    import {mapState, clearHighlight, setHighlight, openCustomPopup, closeCustomPopup} from '../../../stores/mapStore.svelte.js';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';
    import {fetchTrailsToDestination} from '../../../services/trailsService.js';
    import {buildPopupData} from '../../../utils/popupUtils.js';
    import LocateButton from '../locate/LocateButton.svelte';

    let t = $derived(getT());

    let { locateButtonRef = $bindable(null) } = $props();

    let query = $state('');
    let results = $state([]);
    let searching = $state(false);
    let showResults = $state(false);
    let searchTimeout = null;

    let selectedDestination = $state(null);
    let trails = $state(null);
    let trailsLoading = $state(false);
    let activeTrailId = $state(null);
    let expanded = $derived(!!selectedDestination);

    const DIRECT_THRESHOLD = 100; // metri
    let directTrails = $derived(trails?.filter(t => t.distanza_m <= DIRECT_THRESHOLD) ?? []);
    let indirectTrails = $derived(trails?.filter(t => t.distanza_m > DIRECT_THRESHOLD) ?? []);

    async function searchDestinations(text) {
        if (!text.trim()) {
            results = [];
            showResults = false;
            return;
        }

        searching = true;
        const allResults = [];

        try {
            if (mapState.rifugiLayer) {
                const rQuery = mapState.rifugiLayer.createQuery();
                rQuery.where = `LOWER(nome) LIKE '%${text.toLowerCase().replace(/'/g, "''")}%'`;
                rQuery.outFields = ['*'];
                rQuery.returnGeometry = true;
                rQuery.num = 5;
                const rRes = await mapState.rifugiLayer.queryFeatures(rQuery);
                for (const f of rRes.features) {
                    allResults.push({
                        id: f.attributes.id,
                        text: f.attributes.nome,
                        type: 'rifugio',
                        quota: f.attributes.quota,
                        geometry: f.geometry
                    });
                }
            }

            if (mapState.vetteLayer) {
                const vQuery = mapState.vetteLayer.createQuery();
                vQuery.where = `LOWER(nome) LIKE '%${text.toLowerCase().replace(/'/g, "''")}%'`;
                vQuery.outFields = ['*'];
                vQuery.returnGeometry = true;
                vQuery.num = 5;
                const vRes = await mapState.vetteLayer.queryFeatures(vQuery);
                for (const f of vRes.features) {
                    allResults.push({
                        id: f.attributes.id,
                        text: f.attributes.nome,
                        type: 'vetta',
                        quota: f.attributes.quota,
                        geometry: f.geometry
                    });
                }
            }
        } catch (e) {
            console.error('Errore ricerca destinazioni:', e);
        }

        results = allResults;
        showResults = allResults.length > 0;
        searching = false;
    }

    function onInput() {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => searchDestinations(query), 300);
    }

    async function selectDestination(result) {
        selectedDestination = {
            id: result.id,
            nome: result.text,
            type: result.type,
            quota: result.quota
        };
        query = '';
        results = [];
        showResults = false;

        const view = mapState.view;
        if (view && result.geometry) {
            view.goTo({target: result.geometry, zoom: 14}, {duration: 600});
        }

        // Highlight del rifugio/vetta selezionato e apri popup
        clearHighlight();
        const layer = result.type === 'rifugio' ? mapState.rifugiLayer : mapState.vetteLayer;
        const layerTitle = result.type === 'rifugio' ? 'Rifugi' : 'Vette';
        if (view && layer) {
            try {
                const q = layer.createQuery();
                q.where = `id = ${result.id}`;
                q.returnGeometry = true;
                const res = await layer.queryFeatures(q);
                if (res.features.length > 0) {
                    const feature = res.features[0];
                    const lv = await view.whenLayerView(layer);
                    setHighlight(lv.highlight(feature));

                    // Apri popup
                    const {title, fields, editable, featureId} = buildPopupData(feature.attributes, layerTitle, t);
                    const geom = feature.geometry;
                    const coordinates = geom?.type === 'point'
                        ? {longitude: geom.longitude, latitude: geom.latitude}
                        : null;
                    openCustomPopup(title, fields, {editable, featureId, layerTitle, coordinates});
                }
            } catch (_) {}
        }

        trailsLoading = true;
        trails = null;
        const data = await fetchTrailsToDestination(result.type, result.id);
        trails = data;
        trailsLoading = false;
    }

    function clearDestination() {
        selectedDestination = null;
        trails = null;
        query = '';
        activeTrailId = null;
        clearHighlight();
        closeCustomPopup();
    }

    async function highlightTrail(trailId) {
        const view = mapState.view;
        const layer = mapState.sentieriLayer;
        if (!view || !layer) return;

        activeTrailId = trailId;
        clearHighlight();

        const q = layer.createQuery();
        q.where = `id = ${trailId}`;
        q.returnGeometry = true;

        const res = await layer.queryFeatures(q);
        if (res.features.length > 0) {
            const feature = res.features[0];
            const lv = await view.whenLayerView(layer);
            setHighlight(lv.highlight(feature));
        }
    }

    function getDifficultyColor(diff) {
        switch (diff) {
            case 'T': return '#ff0000';
            case 'E': return '#0070ff';
            case 'EE': return '#ff8c00';
            case 'EEA': return '#8b0000';
            default: return '#999999';
        }
    }
</script>

<div class="cai-navigate-floating" class:expanded>
    <!-- LocateButton sempre montato per evitare ri-mount e auto-tracking -->
    <div class="cai-navigate-locate-wrap" class:hidden={!!selectedDestination}>
        <LocateButton bind:this={locateButtonRef}/>
    </div>

    {#if selectedDestination}
        <div class="cai-navigate-destination">
            <div class="cai-navigate-dest-info">
                {#if selectedDestination.type === 'rifugio'}
                    <Home size={14} strokeWidth={2} class="cai-nav-icon shelter"/>
                {:else}
                    <Mountain size={14} strokeWidth={2} class="cai-nav-icon peak"/>
                {/if}
                <span class="cai-navigate-dest-name">{selectedDestination.nome}</span>
                {#if selectedDestination.quota}
                    <span class="cai-navigate-dest-quota">{selectedDestination.quota}m</span>
                {/if}
            </div>
            <button class="cai-navigate-clear" onclick={clearDestination} aria-label={t.navigate.clear}>
                <X size={14} strokeWidth={2}/>
            </button>
        </div>

        <div class="cai-navigate-trails-wrap">
            {#if trailsLoading}
                <div class="cai-navigate-loading">
                    <Loader size={14} strokeWidth={2} class="cai-spinning"/>
                    <span>{t.navigate.loading}</span>
                </div>
            {:else if trails && trails.length > 0}
                {#if directTrails.length > 0}
                    <span class="cai-navigate-group-label">{t.navigate.direct}</span>
                    <div class="cai-navigate-trails">
                        {#each directTrails as trail}
                            <button
                                class="cai-navigate-trail-item"
                                class:active={activeTrailId === trail.id}
                                onclick={() => highlightTrail(trail.id)}
                                type="button"
                            >
                                <span class="cai-navigate-trail-diff" style="background: {getDifficultyColor(trail.difficolta)}">
                                    {trail.difficolta || '?'}
                                </span>
                                <span class="cai-navigate-trail-name">
                                    {t.navigate.trail} {trail.numero_cai || '—'}
                                </span>
                            </button>
                        {/each}
                    </div>
                {/if}
                {#if indirectTrails.length > 0}
                    <span class="cai-navigate-group-label">{t.navigate.indirect}</span>
                    <div class="cai-navigate-trails">
                        {#each indirectTrails as trail}
                            <button
                                class="cai-navigate-trail-item"
                                class:active={activeTrailId === trail.id}
                                onclick={() => highlightTrail(trail.id)}
                                type="button"
                            >
                                <span class="cai-navigate-trail-diff" style="background: {getDifficultyColor(trail.difficolta)}">
                                    {trail.difficolta || '?'}
                                </span>
                                <span class="cai-navigate-trail-name">
                                    {t.navigate.trail} {trail.numero_cai || '—'}
                                </span>
                                <span class="cai-navigate-trail-distance" title={t.navigate.distanceHint}>{trail.distanza_m}m</span>
                            </button>
                        {/each}
                    </div>
                {/if}
            {:else if trails}
                <span class="cai-navigate-empty">{t.navigate.noTrails}</span>
            {/if}
        </div>
    {:else}
        <div class="cai-navigate-search">
            <div class="cai-navigate-input-wrap">
                <Navigation color="var(--text-muted)" size={14} strokeWidth={2} class="cai-navigate-search-icon"/>
                <input
                    class="cai-navigate-input"
                    type="text"
                    placeholder={t.navigate.placeholder}
                    bind:value={query}
                    oninput={onInput}
                    onfocus={() => { if (results.length) showResults = true; }}
                    onblur={() => setTimeout(() => showResults = false, 200)}
                />
            </div>
            {#if showResults}
                <ul class="cai-navigate-results">
                    {#each results as r}
                        <li>
                            <button class="cai-navigate-result-btn" onmousedown={() => selectDestination(r)} type="button">
                                {#if r.type === 'rifugio'}
                                    <Home size={12} strokeWidth={2} class="cai-nav-icon shelter"/>
                                {:else}
                                    <Mountain size={12} strokeWidth={2} class="cai-nav-icon peak"/>
                                {/if}
                                <span>{r.text}</span>
                                {#if r.quota}
                                    <span class="cai-navigate-result-quota">{r.quota}m</span>
                                {/if}
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    {/if}
</div>
