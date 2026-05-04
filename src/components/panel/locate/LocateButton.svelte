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
    let lastHeading = null;
    let lastPosition = null;
    let deviceHeading = null;
    let orientationListener = null;
    let orientationRequested = false; // true se il permesso è stato già richiesto da un gesto utente
    let startedByUser = false; // true se il tracking è stato avviato da un click

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
        if (orientationListener || orientationRequested) return;
        orientationRequested = true;

        const handler = (e) => {
            // webkitCompassHeading (iOS) o alpha (Android)
            let heading = null;
            if (e.webkitCompassHeading != null) {
                // iOS: webkitCompassHeading è già il bearing magnetico in gradi (0 = nord)
                heading = e.webkitCompassHeading;
            } else if (e.alpha != null) {
                // Android: alpha è la rotazione attorno all'asse Z
                // absolute=true significa che è relativo al nord magnetico
                heading = (360 - e.alpha) % 360;
            }
            if (heading != null && !isNaN(heading)) {
                deviceHeading = heading;
                // Aggiorna il cono in tempo reale se abbiamo una posizione
                if (lastPosition && mapState.tracking) {
                    addLocationGraphic(lastPosition, heading);
                }
            }
        };

        // iOS 13+ richiede permesso esplicito (DEVE essere in un user gesture callstack)
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then((state) => {
                if (state === 'granted') {
                    window.addEventListener('deviceorientation', handler, true);
                    orientationListener = handler;
                }
            }).catch(() => {
                orientationRequested = false;
            });
        } else if (typeof DeviceOrientationEvent !== 'undefined') {
            // Android e browser che non richiedono permesso
            window.addEventListener('deviceorientation', handler, true);
            orientationListener = handler;
        }
    }

    function stopDeviceOrientation() {
        if (orientationListener) {
            window.removeEventListener('deviceorientation', orientationListener, true);
            orientationListener = null;
        }
        orientationRequested = false;
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
                                                        color: [66, 133, 244, 50]
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

