<script>
    import './BasemapSwitcher.css';
    import {mapState} from '../../../stores/mapStore.svelte.js';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';

    let t = $derived(getT());

    const STORAGE_KEY = 'cai-basemap';
    const DEFAULT_BASEMAP = 'osm';

    const basemapDefs = [
        {
            id: 'osm',
            labelKey: 'osm',
            thumbnail: 'https://js.arcgis.com/4.31/esri/images/basemap/osm.jpg'
        },
        {
            id: 'topo-vector',
            labelKey: 'topographic',
            thumbnail: 'https://js.arcgis.com/4.31/esri/images/basemap/topo-vector.jpg'
        },
        {
            id: 'terrain',
            labelKey: 'terrain',
            thumbnail: 'https://js.arcgis.com/4.31/esri/images/basemap/terrain.jpg'
        },
        {
            id: 'satellite',
            labelKey: 'satellite',
            thumbnail: 'https://js.arcgis.com/4.31/esri/images/basemap/satellite.jpg'
        },
    ];

    const saved = localStorage.getItem(STORAGE_KEY);
    let active = $state(basemapDefs.some(b => b.id === saved) ? saved : DEFAULT_BASEMAP);

    // Apply saved basemap when map becomes available
    $effect(() => {
        const view = mapState.view;
        if (view && active !== DEFAULT_BASEMAP) {
            view.map.basemap = active;
        }
    });

    function setBasemap(id) {
        const view = mapState.view;
        if (!view) return;
        active = id;
        view.map.basemap = id;
        localStorage.setItem(STORAGE_KEY, id);
    }
</script>

<div aria-label={t.section.basemap} class="cai-basemap-switcher" role="radiogroup">
    {#each basemapDefs as {id, labelKey, thumbnail}}
        <button
                class="cai-basemap-option"
                class:active={active === id}
                onclick={() => setBasemap(id)}
                role="radio"
                aria-checked={active === id}
                title={t.basemap[labelKey]}
        >
            <div class="cai-basemap-thumb-wrap">
                <img
                        src={thumbnail}
                        alt={t.basemap[labelKey]}
                        class="cai-basemap-thumb"
                        loading="lazy"
                />
            </div>
            <span class="cai-basemap-label">{t.basemap[labelKey]}</span>
        </button>
    {/each}
</div>

