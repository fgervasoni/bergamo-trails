<script>
    import './MapContainer.css';
    import {onDestroy, onMount} from 'svelte';
    import Map from '@arcgis/core/Map';
    import MapView from '@arcgis/core/views/MapView';
    import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
    import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
    import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
    import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
    import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
    import Graphic from '@arcgis/core/Graphic';
    import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
    import Point from '@arcgis/core/geometry/Point';
    import {clearHighlight, mapState, openCustomPopup, setHighlight} from '../../stores/mapStore.svelte.js';
    import {getT} from '../../assets/i18n/i18n.svelte.js';

    let t = $derived(getT());

    let {
        onReady = () => {
        }
    } = $props();
    let container;

    onMount(async () => {
        const map = new Map({basemap: 'topo-vector'});

        const view = new MapView({
            container,
            map,
            center: [9.67, 45.7],
            zoom: 10,
            popupEnabled: false,
            padding: window.innerWidth <= 540 ? {bottom: 200} : {right: 0}
        });

        view.ui.components = [];

        const sentieriRenderer = new UniqueValueRenderer({
            field: 'Difficolta',
            defaultSymbol: new SimpleLineSymbol({color: '#999999', width: 2.5}),
            uniqueValueInfos: [
                {value: 'T', symbol: new SimpleLineSymbol({color: '#ff0000', width: 2.5})},
                {value: 'E', symbol: new SimpleLineSymbol({color: '#0070ff', width: 2.5})},
                {value: 'EE', symbol: new SimpleLineSymbol({color: '#ff8c00', width: 2.5})},
                {value: 'EEA', symbol: new SimpleLineSymbol({color: '#8b0000', width: 2.5})},
            ]
        });

        const sentieriLayer = new FeatureLayer({
            url: 'https://cartografia01.maggioli.cloud/arcgis/rest/services/CAI_Bergamo/CAI/MapServer/1',
            title: 'Sentieri',
            minScale: 0,
            maxScale: 0,
            outFields: ['*'],
            renderer: sentieriRenderer
        });

        const rifugiRenderer = new SimpleRenderer({
            symbol: new SimpleMarkerSymbol({
                style: 'circle',
                color: '#2d6a4f',
                size: 10,
                outline: {color: 'white', width: 1.5}
            })
        });

        const rifugiLayer = new FeatureLayer({
            url: 'https://cartografia01.maggioli.cloud/arcgis/rest/services/CAI_Bergamo/CAI/MapServer/0',
            title: 'Rifugi',
            minScale: 0,
            maxScale: 0,
            outFields: ['*'],
            renderer: rifugiRenderer
        });

        map.addMany([sentieriLayer, rifugiLayer]);

        const locationLayer = new GraphicsLayer({title: 'Posizione'});
        map.add(locationLayer);

        await view.when();
        await sentieriLayer.when();

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const pt = new Point({longitude: pos.coords.longitude, latitude: pos.coords.latitude});
                    addLocationGraphic(locationLayer, pt);
                    view.goTo({center: pt, zoom: 15});
                },
                () => {
                    view.goTo({center: [9.67, 45.7], zoom: 11});
                },
                {enableHighAccuracy: true, timeout: 5000}
            );
        }

        view.on('click', async (event) => {
            const response = await view.hitTest(event, {include: [sentieriLayer, rifugiLayer]});
            const result = response.results[0];
            if (result?.type === 'graphic') {
                const graphic = result.graphic;
                const lv = await view.whenLayerView(graphic.layer);
                clearHighlight();
                setHighlight(lv.highlight(graphic));

                const {title, fields} = buildPopupData(graphic);
                openCustomPopup(title, fields);
            }
        });

        mapState.view = view;
        mapState.sentieriLayer = sentieriLayer;
        mapState.rifugiLayer = rifugiLayer;
        mapState.locationLayer = locationLayer;
        onReady();
    });

    function buildPopupData(graphic) {
        const attrs = graphic.attributes;
        const layer = graphic.layer;

        if (layer?.title === 'Sentieri') {
            return {
                title: `${t.popup.trail} ${attrs.NumeroCAI || ''}`,
                fields: [
                    {label: t.popup.caiNumber, value: attrs.NumeroCAI},
                    {label: t.popup.difficulty, value: attrs.Difficolta}
                ]
            };
        }
        if (layer?.title === 'Rifugi') {
            return {
                title: attrs.nome || t.search?.shelter || 'Rifugio',
                fields: [
                    {label: t.popup.name, value: attrs.nome},
                    {label: t.popup.ownership, value: attrs.propriet},
                    {label: t.popup.altitude, value: attrs.quota ? `${attrs.quota} m` : null}
                ]
            };
        }
        return {title: t.popup.details, fields: []};
    }

    function addLocationGraphic(layer, point) {
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

    onDestroy(() => {
        clearHighlight();
        mapState.view?.destroy();
        mapState.view = null;
    });
</script>

<div bind:this={container} class="cai-map-container"></div>

