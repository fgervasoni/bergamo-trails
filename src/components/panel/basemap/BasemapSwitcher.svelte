<script>
    import './BasemapSwitcher.css';
    import {Map, Mountain, Satellite} from 'lucide-svelte';
    import {mapState} from '../../../stores/mapStore.svelte.js';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';

    let t = $derived(getT());

    const STORAGE_KEY = 'cai-basemap';
    const DEFAULT_BASEMAP = 'topo-vector';

    const basemapDefs = [
        {id: 'topo-vector', labelKey: 'topographic', Icon: Mountain},
        {id: 'satellite', labelKey: 'satellite', Icon: Satellite},
        {id: 'streets-navigation-vector', labelKey: 'streets', Icon: Map},
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
    {#each basemapDefs as {id, labelKey, Icon}}
        <button
                class="cai-basemap-option"
                class:active={active === id}
                onclick={() => setBasemap(id)}
                role="radio"
                aria-checked={active === id}
                title={t.basemap[labelKey]}
        >
            <Icon size={16} strokeWidth={2}/>
            <span>{t.basemap[labelKey]}</span>
        </button>
    {/each}
</div>

