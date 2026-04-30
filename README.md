# Bergamo Trails — Sentieri e Rifugi

Mappa interattiva dei sentieri e rifugi del **Club Alpino Italiano — Sezione di Bergamo**.  
Progressive Web App installabile, accessibile da desktop e dispositivi mobili.

![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![ArcGIS](https://img.shields.io/badge/ArcGIS_JS-5-2C7AC3?logo=esri&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)

---

## Funzionalità

- **Visualizzazione sentieri** con classificazione per difficoltà (T, E, EE, EEA)
- **Visualizzazione rifugi** con dettagli (nome, quota, proprietà)
- **Ricerca** per numero sentiero CAI, nome rifugio o indirizzo italiano
- **Geolocalizzazione** dell'utente sulla mappa
- **Popup interattivo** con informazioni dettagliate al click o alla ricerca
- **Highlight** delle feature selezionate
- **Cambio mappa base** (Topografica, Satellite, Stradale)
- **Legenda** sempre visibile
- **Tema chiaro / scuro / sistema** con persistenza
- **Multilingua** (Italiano 🇮🇹 / English 🇬🇧)
- **Responsive** — pannello laterale su desktop, bottom sheet su mobile
- **Installabile** come PWA con supporto offline

---

## Tech Stack

| Tecnologia                                                          | Versione | Utilizzo                  |
|---------------------------------------------------------------------|----------|---------------------------|
| [Svelte](https://svelte.dev)                                        | 5        | Framework UI (runes mode) |
| [Vite](https://vitejs.dev)                                          | 6        | Build tool e dev server   |
| [ArcGIS Maps SDK for JS](https://developers.arcgis.com/javascript/) | 5        | Mappa, layer, geocoding   |
| [Lucide Svelte](https://lucide.dev)                                 | 1.x      | Icone SVG                 |

---

## Struttura del Progetto

```
src/
├── App.svelte                         # Layout principale (panel, loading, settings)
├── App.css                            # Stili panel, footer, impostazioni
├── global.css                         # CSS custom properties (tema chiaro/scuro), reset
├── main.js                            # Entry point
│
├── assets/
│   └── i18n/                          # Localizzazione
│       ├── i18n.svelte.js             # Store i18n ($state)
│       ├── it.json                    # Stringhe italiano
│       └── en.json                    # Stringhe inglese
│
├── components/
│   ├── map/
│   │   ├── MapContainer.svelte        # Mappa Esri, GeoJSONLayer da Supabase, click handler
│   │   └── MapContainer.css
│   │
│   ├── panel/
│   │   ├── search/
│   │   │   ├── SearchBar.svelte       # Ricerca sentieri, rifugi, indirizzi
│   │   │   └── SearchBar.css
│   │   ├── locate/
│   │   │   ├── LocateButton.svelte    # Pulsante geolocalizzazione
│   │   │   └── LocateButton.css
│   │   ├── basemap/
│   │   │   ├── BasemapSwitcher.svelte # Selezione mappa base
│   │   │   └── BasemapSwitcher.css
│   │   └── legend/
│   │       ├── Legend.svelte          # Legenda sentieri e rifugi
│   │       └── Legend.css
│   │
│   └── popup/
│       ├── CustomPopup.svelte         # Card popup glassmorphism
│       └── CustomPopup.css
│
└── stores/
    ├── mapStore.svelte.js             # Stato mappa, popup, highlight
    └── themeStore.svelte.js           # Stato tema (light/dark/system)

public/
├── manifest.json                      # PWA manifest
├── service-worker.js                  # Service worker per caching
├── offline.html                       # Pagina offline
├── favicon.png
└── images/icons/                      # Icone PWA (32–512px + maskable)
```

---

## Getting Started

### Prerequisiti

- [Node.js](https://nodejs.org) ≥ 18

### Installazione

```bash
git clone <repo-url>
cd Cai-pwa
npm install
```

### Sviluppo

```bash
npm run dev
```

L'app sarà disponibile su [http://localhost:5173](http://localhost:5173).

### Build di produzione

```bash
npm run build
npm run preview   # anteprima locale del build
```

I file di output vengono generati nella cartella `dist/`.

---

## Dati

I dati geografici provengono dal servizio cartografico **Maggioli S.p.A.** per conto di **CAI Bergamo** e sono serviti tramite **Supabase (PostGIS)** in formato GeoJSON.

Il geocoding degli indirizzi utilizza
il [World Geocoding Service](https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer) di Esri.

---

## Deploy

Il progetto include la configurazione per **Netlify** (`netlify.toml`).  
Basta collegare il repository a Netlify e il deploy avverrà automaticamente.

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

---

## Licenza

Questo progetto è a uso privato. I dati cartografici sono di proprietà di CAI Bergamo / Maggioli S.p.A.
