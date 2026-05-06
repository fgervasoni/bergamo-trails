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
    let lastPosition = null;
    let deviceHeading = null;
    let orientationListener = null;

    onMount(async () => {
        // Avvia il GPS automaticamente se il permesso è già concesso
        if (navigator.permissions) {
            try {
                const status = await navigator.permissions.query({name: 'geolocation'});
                if (status.state === 'granted') {
                    const waitForView = () => {
                        if (mapState.view) {
                            startTracking();
                        } else {
                            setTimeout(waitForView, 100);
                        }
                    };
                    waitForView();
                }
            } catch (_) {}
        }

        // Ascolta il giroscopio se il permesso è già stato concesso in questa sessione
        listenForOrientation();
    });

    /**
     * Ascolta il giroscopio. Su Android basta aggiungere il listener.
     * Su iOS, il permesso viene gestito dal popup modale in App.svelte.
     * Questa funzione viene chiamata anche da fuori (dopo che il permesso è concesso).
     */
    export function listenForOrientation() {
        startOrientationAfterPermission();
    }

    /**
     * Chiamata dopo che il permesso iOS è stato concesso (dal popup modale).
     */
    export function startOrientationAfterPermission() {
        startOrientationListener();
    }

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
        // Ri-aggancia il giroscopio quando si riattiva il tracking.
        // Su iOS prova a richiedere/riusare il permesso durante il gesto utente.
        ensureOrientationForTracking();


        mapState.watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const pt = new Point({longitude: pos.coords.longitude, latitude: pos.coords.latitude});
                lastPosition = pt;

                addLocationGraphic(pt, deviceHeading);
                if (firstFix) {
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
    }

    async function ensureOrientationForTracking() {
        if (orientationListener) return;
        if (typeof DeviceOrientationEvent === 'undefined') return;

        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const state = await DeviceOrientationEvent.requestPermission();
                if (state !== 'granted') return;
            } catch (_) {
                return;
            }
        }

        startOrientationAfterPermission();
    }

    function startOrientationListener() {
        if (orientationListener) return;
        if (typeof DeviceOrientationEvent === 'undefined') return;
        const handler = createOrientationHandler();
        window.addEventListener('deviceorientation', handler, true);
        orientationListener = handler;
    }

    function stopTracking() {
        if (mapState.watchId != null) {
            navigator.geolocation.clearWatch(mapState.watchId);
            mapState.watchId = null;
        }
        mapState.tracking = false;
        lastPosition = null;
        deviceHeading = null;
        stopDeviceOrientation();
        const layer = mapState.locationLayer;
        if (layer) layer.removeAll();
    }


    function createOrientationHandler() {
        return (e) => {
            let heading = null;
            if (e.webkitCompassHeading != null) {
                heading = e.webkitCompassHeading;
            } else if (e.alpha != null) {
                heading = (360 - e.alpha) % 360;
            }
            if (heading != null && !isNaN(heading)) {
                deviceHeading = heading;
                if (lastPosition && mapState.tracking) {
                    addLocationGraphic(lastPosition, heading);
                }
            }
        };
    }

    function stopDeviceOrientation() {
        if (orientationListener) {
            window.removeEventListener('deviceorientation', orientationListener, true);
            orientationListener = null;
        }
    }

    function addLocationGraphic(point, heading) {
        const layer = mapState.locationLayer;
        if (!layer) return;
        layer.removeAll();

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

        layer.addMany([dot]);

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
                                    anchorPoint: {x: 0, y: 0},
                                    anchorPointUnits: 'Relative',
                                    size: 48,
                                    rotation: heading ?? 0,
                                    rotateClockwise: true,
                                    frame: {xmin: 0, ymin: 0, xmax: 100, ymax: 100},
                                    markerGraphics: [
                                        {
                                            type: 'CIMMarkerGraphic',
                                            geometry: {
                                                rings: [
                                                    (() => {
                                                        // Genera un arco di ~70 gradi con molti punti per un bordo liscio
                                                        const cx = 50, cy = 48, r = 48;
                                                        const startAngle = 40; // gradi (da verticale)
                                                        const endAngle = 100;
                                                        const steps = 20;
                                                        const pts = [[cx, cy]];
                                                        for (let i = 0; i <= steps; i++) {
                                                            const a = (startAngle + (endAngle - startAngle) * i / steps) * Math.PI / 180;
                                                            pts.push([
                                                                cx + r * Math.cos(a),
                                                                cy + r * Math.sin(a)
                                                            ]);
                                                        }
                                                        pts.push([cx, cy]);
                                                        return pts;
                                                    })()
                                                ]
                                            },
                                            symbol: {
                                                type: 'CIMPolygonSymbol',
                                                symbolLayers: [
                                                    {
                                                        type: 'CIMSolidFill',
                                                        enable: true,
                                                        color: [66, 133, 244, 80]
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

