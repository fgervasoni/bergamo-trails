<script>
    import './LocateButton.css';
    import {Loader, LocateFixed, LocateOff} from 'lucide-svelte';
    import {mapState} from '../../../stores/mapStore.svelte.js';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';
    import Graphic from '@arcgis/core/Graphic';
    import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
    import Point from '@arcgis/core/geometry/Point';

    let t = $derived(getT());

    let locating = $state(false);
    let error = $state(false);
    let tracking = $derived(mapState.tracking);
    let firstFix = false;

    function toggleTracking() {
        if (tracking) {
            stopTracking();
        } else {
            startTracking();
        }
    }

    function startTracking() {
        const view = mapState.view;
        if (!view || locating) return;
        if (!navigator.geolocation) {
            error = true;
            return;
        }

        locating = true;
        error = false;
        firstFix = true;

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const pt = new Point({longitude: pos.coords.longitude, latitude: pos.coords.latitude});
                addLocationGraphic(pt);
                if (firstFix) {
                    view.goTo({center: pt, zoom: 15});
                    firstFix = false;
                }
                locating = false;
                mapState.tracking = true;
            },
            () => {
                error = true;
                locating = false;
                mapState.tracking = false;
                mapState.watchId = null;
                setTimeout(() => error = false, 3000);
            },
            {enableHighAccuracy: true, timeout: 10000, maximumAge: 2000}
        );

        mapState.watchId = watchId;
    }

    function stopTracking() {
        if (mapState.watchId != null) {
            navigator.geolocation.clearWatch(mapState.watchId);
            mapState.watchId = null;
        }
        mapState.tracking = false;
        const layer = mapState.locationLayer;
        if (layer) layer.removeAll();
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
        aria-label={tracking ? t.locate.stopLabel : t.locate.label}
        class="cai-locate-btn"
        class:error
        class:active={tracking}
        disabled={locating}
        onclick={toggleTracking}
        title={error ? t.locate.errorTitle : (tracking ? t.locate.stopTitle : t.locate.title)}
>
    {#if locating}
        <Loader size={16} strokeWidth={2} class="cai-spinning"/>
    {:else if tracking}
        <LocateOff size={16} strokeWidth={2}/>
    {:else}
        <LocateFixed size={16} strokeWidth={2}/>
    {/if}
</button>

