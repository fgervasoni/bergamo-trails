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
    let enabled = $state(false); // true dopo che l'utente accetta il tracciamento
    let firstFix = false;
    let lastHeading = null;
    let lastPosition = null;
    let deviceHeading = null;
    let orientationListener = null;
    let startedByUser = false;
    let showPrompt = $state(false);

    onMount(() => {
        const granted = localStorage.getItem('cai-tracking-granted');
        if (granted) {
            // L'utente ha già accettato in una sessione precedente
            enabled = true;
            const waitForView = () => {
                if (mapState.view) {
                    startDeviceOrientationSilent();
                    startTracking();
                } else {
                    setTimeout(waitForView, 100);
                }
            };
            waitForView();
        } else {
            // Mostra il prompt al primo accesso
            showPrompt = true;
        }
    });

    function acceptTracking() {
        showPrompt = false;
        enabled = true;
        localStorage.setItem('cai-tracking-granted', '1');
        startedByUser = true;
        startTracking();
    }

    function declineTracking() {
        showPrompt = false;
        enabled = false;
    }

    function toggleTracking(event) {
        event.currentTarget?.blur();
        if (tracking) {
            stopTracking();
        } else {
            startedByUser = true;
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

        // Start device orientation (compass) — only request permission if triggered by user gesture
        if (startedByUser) {
            startDeviceOrientation();
            startedByUser = false;
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const pt = new Point({longitude: pos.coords.longitude, latitude: pos.coords.latitude});
                let heading = pos.coords.heading;

                // Priorità: giroscopio > GPS heading > calcolo da posizione
                if (deviceHeading != null) {
                    heading = deviceHeading;
                } else if (heading == null || isNaN(heading)) {
                    heading = computeHeading(pt);
                } else {
                    lastHeading = heading;
                }
                lastPosition = pt;

                addLocationGraphic(pt, heading ?? lastHeading);
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
        lastHeading = null;
        lastPosition = null;
        deviceHeading = null;
        stopDeviceOrientation();
        const layer = mapState.locationLayer;
        if (layer) layer.removeAll();
    }

    /** Avvia l'ascolto della bussola tramite DeviceOrientationEvent (mobile) */
    function startDeviceOrientation() {
        if (orientationListener) return;

        const handler = createOrientationHandler();

        // iOS 13+ richiede permesso esplicito (DEVE essere in un user gesture callstack)
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then((state) => {
                if (state === 'granted') {
                    localStorage.setItem('cai-orientation-granted', '1');
                    window.addEventListener('deviceorientation', handler, true);
                    orientationListener = handler;
                }
            }).catch(() => {
            });
        } else if (typeof DeviceOrientationEvent !== 'undefined') {
            window.addEventListener('deviceorientation', handler, true);
            orientationListener = handler;
        }
    }

    /**
     * Avvia il giroscopio senza richiedere il permesso (per accessi successivi).
     * Su iOS il permesso è per-sessione e richiede sempre un gesto utente,
     * quindi su iOS non lo avviamo in automatico.
     */
    function startDeviceOrientationSilent() {
        if (orientationListener) return;
        if (typeof DeviceOrientationEvent === 'undefined') return;

        // Su iOS, requestPermission è obbligatorio ogni sessione — skip su auto-start
        if (typeof DeviceOrientationEvent.requestPermission === 'function') return;

        // Android e altri browser: basta aggiungere il listener
        const handler = createOrientationHandler();
        window.addEventListener('deviceorientation', handler, true);
        orientationListener = handler;
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

    /**
     * Calcola heading dalla posizione precedente (bearing in gradi).
     * Utile su desktop dove pos.coords.heading è spesso null.
     */
    function computeHeading(currentPt) {
        if (!lastPosition) return null;
        const dLon = (currentPt.longitude - lastPosition.longitude);
        const dLat = (currentPt.latitude - lastPosition.latitude);
        // Ignora spostamenti troppo piccoli (rumore GPS)
        if (Math.abs(dLon) < 0.00001 && Math.abs(dLat) < 0.00001) return lastHeading;
        const rad = Math.atan2(dLon, dLat);
        const deg = (rad * 180 / Math.PI + 360) % 360;
        lastHeading = deg;
        return deg;
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

{#if showPrompt}
    <div class="cai-locate-prompt">
        <button class="cai-locate-prompt-btn" onclick={acceptTracking} aria-label={t.locate.label}>
            <LocateFixed size={16} strokeWidth={2}/>
        </button>
    </div>
{:else if enabled}
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
{:else}
    <button
            aria-label={t.locate.label}
            class="cai-locate-btn"
            onclick={() => { enabled = true; localStorage.setItem('cai-tracking-granted', '1'); startedByUser = true; startTracking(); }}
            title={t.locate.title}
    >
        <LocateFixed size={16} strokeWidth={2}/>
    </button>
{/if}

