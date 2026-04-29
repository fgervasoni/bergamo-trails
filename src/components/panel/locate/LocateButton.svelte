<script>
    import './LocateButton.css';
    import {Loader, LocateFixed} from 'lucide-svelte';
    import {mapState} from '../../../stores/mapStore.svelte.js';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';
    import Graphic from '@arcgis/core/Graphic';
    import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
    import Point from '@arcgis/core/geometry/Point';

    let t = $derived(getT());

    let locating = $state(false);
    let error = $state(false);

    function locate() {
        const view = mapState.view;
        if (!view || locating) return;
        if (!navigator.geolocation) {
            error = true;
            return;
        }

        locating = true;
        error = false;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const pt = new Point({longitude: pos.coords.longitude, latitude: pos.coords.latitude});
                addLocationGraphic(pt);
                view.goTo({center: pt, zoom: 15});
                locating = false;
            },
            () => {
                error = true;
                locating = false;
                setTimeout(() => error = false, 3000);
            },
            {enableHighAccuracy: true, timeout: 10000}
        );
    }

    function addLocationGraphic(point) {
        const layer = mapState.locationLayer;
        if (!layer) return;
        layer.removeAll();
        const halo = new Graphic({
            geometry: point,
            symbol: new SimpleMarkerSymbol({
                style: 'circle',
                color: [66, 133, 244, 0.15],
                size: 40,
                outline: {color: [66, 133, 244, 0.3], width: 1}
            })
        });
        const dot = new Graphic({
            geometry: point,
            symbol: new SimpleMarkerSymbol({
                style: 'circle',
                color: [66, 133, 244, 0.9],
                size: 14,
                outline: {color: 'white', width: 2.5}
            })
        });
        layer.addMany([halo, dot]);
    }
</script>

<button
        aria-label={t.locate.label}
        class="cai-locate-btn"
        class:error
        disabled={locating}
        onclick={locate}
        title={error ? t.locate.errorTitle : t.locate.title}
>
    {#if locating}
        <Loader size={16} strokeWidth={2} class="cai-spinning"/>
    {:else}
        <LocateFixed size={16} strokeWidth={2}/>
    {/if}
</button>

