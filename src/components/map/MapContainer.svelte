<script>
    import './MapContainer.css';
    import {onDestroy, onMount} from 'svelte';
    import Map from '@arcgis/core/Map';
    import MapView from '@arcgis/core/views/MapView';
    import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
    import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
    import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
    import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
    import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
    import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
    import {
        clearHighlight,
        mapState,
        openCustomPopup,
        setHighlight,
        setRefreshLayerFn
    } from '../../stores/mapStore.svelte.js';
    import {getT} from '../../assets/i18n/i18n.svelte.js';
    import {fetchRifugi, fetchSentieri, fetchVette} from '../../services/trailsService.js';
    import {buildPopupData} from '../../utils/popupUtils.js';

    let t = $derived(getT());

    let {
        onReady = () => {
        }
    } = $props();
    let container;

    /**
     * Crea un Blob URL da un oggetto GeoJSON per alimentare un GeoJSONLayer ArcGIS.
     */
    function geojsonToUrl(geojson) {
        const blob = new Blob([JSON.stringify(geojson)], {type: 'application/json'});
        return URL.createObjectURL(blob);
    }

    onMount(async () => {
        const map = new Map({basemap: 'osm'});

        const view = new MapView({
            container,
            map,
            center: [9.67, 45.7],
            zoom: 10,
            popupEnabled: false,
            padding: window.innerWidth <= 540 ? {bottom: 200} : {right: 0}
        });

        view.ui.components = [];

        // ── Carica dati da Supabase ──────────────────────────────
        const [sentieriGeoJSON, rifugiGeoJSON, vetteGeoJSON] = await Promise.all([
            fetchSentieri(),
            fetchRifugi(),
            fetchVette()
        ]);

        // ── Sentieri (GeoJSON) ───────────────────────────────────
        const sentieriRenderer = new UniqueValueRenderer({
            field: 'difficolta',
            defaultSymbol: new SimpleLineSymbol({color: '#999999', width: 2.5}),
            uniqueValueInfos: [
                {value: 'T', symbol: new SimpleLineSymbol({color: '#ff0000', width: 2.5})},
                {value: 'E', symbol: new SimpleLineSymbol({color: '#0070ff', width: 2.5})},
                {value: 'EE', symbol: new SimpleLineSymbol({color: '#ff8c00', width: 2.5})},
                {value: 'EEA', symbol: new SimpleLineSymbol({color: '#8b0000', width: 2.5})},
            ]
        });

        const sentieriLayer = sentieriGeoJSON
            ? new GeoJSONLayer({
                url: geojsonToUrl(sentieriGeoJSON),
                title: 'Sentieri',
                outFields: ['*'],
                renderer: sentieriRenderer
            })
            : null;

        // ── Rifugi (GeoJSON) ─────────────────────────────────────
        const rifugiRenderer = new SimpleRenderer({
            symbol: new SimpleMarkerSymbol({
                style: 'circle',
                color: '#2d6a4f',
                size: 10,
                outline: {color: 'white', width: 1.5}
            })
        });

        const rifugiLayer = rifugiGeoJSON
            ? new GeoJSONLayer({
                url: geojsonToUrl(rifugiGeoJSON),
                title: 'Rifugi',
                outFields: ['*'],
                renderer: rifugiRenderer
            })
            : null;

        if (sentieriLayer) map.add(sentieriLayer);
        if (rifugiLayer) map.add(rifugiLayer);

        // ── Vette (GeoJSON) ──────────────────────────────────────
        const vetteRenderer = new SimpleRenderer({
            symbol: new SimpleMarkerSymbol({
                style: 'triangle',
                color: '#e76f51',
                size: 10,
                outline: {color: 'white', width: 1.5}
            })
        });

        const vetteLayer = vetteGeoJSON
            ? new GeoJSONLayer({
                url: geojsonToUrl(vetteGeoJSON),
                title: 'Vette',
                outFields: ['*'],
                renderer: vetteRenderer
            })
            : null;

        if (vetteLayer) map.add(vetteLayer);

        const locationLayer = new GraphicsLayer({title: 'Posizione'});
        map.add(locationLayer);

        await view.when();
        if (sentieriLayer) await sentieriLayer.when();

        view.goTo({center: [9.67, 45.7], zoom: 11});

        // Click handler dinamico — legge i layer correnti da mapState (sopravvive ai refresh)
        view.on('click', async (event) => {
            const clickLayers = [mapState.sentieriLayer, mapState.rifugiLayer, mapState.vetteLayer].filter(Boolean);
            const response = await view.hitTest(event, {include: clickLayers});
            const result = response.results[0];
            if (result?.type === 'graphic') {
                const graphic = result.graphic;
                const lv = await view.whenLayerView(graphic.layer);
                clearHighlight();
                setHighlight(lv.highlight(graphic));

                const {
                    title,
                    fields,
                    editable,
                    featureId,
                    layerTitle
                } = buildPopupData(graphic.attributes, graphic.layer?.title, t);
                // Estrai coordinate per punti (rifugi, vette)
                const geom = graphic.geometry;
                const coordinates = geom?.type === 'point'
                    ? {longitude: geom.longitude, latitude: geom.latitude}
                    : null;
                openCustomPopup(title, fields, {editable, featureId, layerTitle, coordinates});
            }
        });

        mapState.view = view;
        mapState.sentieriLayer = sentieriLayer;
        mapState.rifugiLayer = rifugiLayer;
        mapState.vetteLayer = vetteLayer;
        mapState.locationLayer = locationLayer;

        // ── Refresh layer callback ───────────────────────────────
        setRefreshLayerFn(async (layerTitle) => {
            const fetchMap = {
                Sentieri: {fetch: fetchSentieri, rendererFn: () => sentieriRenderer, stateKey: 'sentieriLayer'},
                Rifugi: {fetch: fetchRifugi, rendererFn: () => rifugiRenderer, stateKey: 'rifugiLayer'},
                Vette: {fetch: fetchVette, rendererFn: () => vetteRenderer, stateKey: 'vetteLayer'}
            };
            const cfg = fetchMap[layerTitle];
            if (!cfg) return;

            const geojson = await cfg.fetch();
            if (!geojson) return;

            // Rimuovi il vecchio layer
            const oldLayer = mapState[cfg.stateKey];
            if (oldLayer) map.remove(oldLayer);

            // Crea un nuovo GeoJSONLayer
            const newLayer = new GeoJSONLayer({
                url: geojsonToUrl(geojson),
                title: layerTitle,
                outFields: ['*'],
                renderer: cfg.rendererFn()
            });
            map.add(newLayer);
            mapState[cfg.stateKey] = newLayer;
        });

        onReady();
    });


    onDestroy(() => {
        clearHighlight();
        if (mapState.watchId != null) {
            navigator.geolocation.clearWatch(mapState.watchId);
            mapState.watchId = null;
            mapState.tracking = false;
        }
        mapState.view?.destroy();
        mapState.view = null;
    });
</script>

<div bind:this={container} class="cai-map-container"></div>

