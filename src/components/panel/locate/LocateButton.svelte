<script>
    import './LocateButton.css';
    import {onMount} from 'svelte';
    import {Loader, LocateFixed, LocateOff} from 'lucide-svelte';
    import {mapState} from '../../../stores/mapStore.svelte.js';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';
    import Point from '@arcgis/core/geometry/Point';
    import Graphic from '@arcgis/core/Graphic';
    import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
    import CIMSymbol from '@arcgis/core/symbols/CIMSymbol';

    let t = $derived(getT());

    let locating = $state(false);
    let error = $state(false);
    let tracking = $derived(mapState.tracking);
    let firstFix = false;

    onMount(async () => {
        if (navigator.permissions) {
            try {
                const status = await navigator.permissions.query({name: 'geolocation'});
                if (status.state === 'granted') {
                    // Aspetta che la view sia pronta
                    const waitForView = () => {
                        if (mapState.view) {
                            startTracking();
                        } else {
                            setTimeout(waitForView, 100);
                        }
                    };
                    waitForView();
                }
            } catch (_) {
                // permissions API non supportata, non fare nulla
            }
        }
    });

    function toggleTracking(event) {
        event.currentTarget?.blur();
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
                const heading = pos.coords.heading;
                addLocationGraphic(pt, heading);
                if (firstFix) {
                    // Su mobile sposta il centro visivo più in alto per non finire sotto la sidenav
                    if (window.innerWidth <= 540) {
                        view.padding = {bottom: Math.round(view.height * 0.4)};
                    }
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

    function addLocationGraphic(point, heading) {
        const layer = mapState.locationLayer;
        if (!layer) return;
        layer.removeAll();

        // Alone di accuratezza
        const halo = new Graphic({
            geometry: point,
            symbol: new SimpleMarkerSymbol({
                style: 'circle',
                color: [66, 133, 244, 0.15],
                size: 40,
                outline: {color: [66, 133, 244, 0.3], width: 1}
            })
        });

        // Punto blu centrale
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

        // Cono di direzione (heading)
        if (heading != null && !isNaN(heading)) {
            const directionCone = new Graphic({
                geometry: point,
                symbol: new CIMSymbol({
                    data: {
                        type: 'CIMSymbolReference',
                        symbol: {
                            type: 'CIMPointSymbol',
                            symbolLayers: [
                                {
                                    type: 'CIMVectorMarker',
                                    enable: true,
                                    anchorPoint: {x: 0, y: -3},
                                    anchorPointUnits: 'Relative',
                                    size: 28,
                                    rotation: heading,
                                    rotateClockwise: true,
                                    frame: {xmin: 0, ymin: 0, xmax: 20, ymax: 20},
                                    markerGraphics: [
                                        {
                                            type: 'CIMMarkerGraphic',
                                            geometry: {
                                                rings: [
                                                    [
                                                        [10, 20],
                                                        [3, 10],
                                                        [10, 12],
                                                        [17, 10],
                                                        [10, 20]
                                                    ]
                                                ]
                                            },
                                            symbol: {
                                                type: 'CIMPolygonSymbol',
                                                symbolLayers: [
                                                    {
                                                        type: 'CIMSolidFill',
                                                        enable: true,
                                                        color: [66, 133, 244, 100]
                                                    }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                })
            });
            layer.add(directionCone);
        }
    }
</script>

<button
        aria-label={tracking ? t.locate.stopLabel : t.locate.label}
        class="cai-locate-btn"
        class:active={tracking}
        class:error
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

