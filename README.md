# Bergamo Trails — Sentieri, Rifugi e Vette

Mappa interattiva dei sentieri, rifugi e vette del **Club Alpino Italiano — Sezione di Bergamo**.  
Progressive Web App installabile, accessibile da desktop e dispositivi mobili.

![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![ArcGIS](https://img.shields.io/badge/ArcGIS_JS-5-2C7AC3?logo=esri&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)

---

## Funzionalità

- **Visualizzazione sentieri** con classificazione per difficoltà (T, E, EE, EEA)
- **Visualizzazione rifugi** con dettagli (nome, quota, proprietà)
- **Visualizzazione vette** con quota e descrizione
- **Navigazione verso destinazione** — cerca un rifugio o una vetta e vedi i sentieri che lo raggiungono, divisi tra
  accesso diretto e tramite collegamento
- **Punti di interesse nelle vicinanze** — selezionando un sentiero vengono mostrati rifugi e vette vicini con distanza
- **Aggiunta nuovi punti** (rifugi, vette) da mappa o posizione GPS attuale
- **Tracciamento nuovi sentieri** con routing automatico su grafo OSM (OpenRouteService foot-hiking)
- **Sistema di richieste** — gli utenti non-admin inviano richieste di creazione, modifica ed eliminazione che vengono
  revisionate dall'admin
- **Motivazione obbligatoria per eliminazione** — le richieste di eliminazione richiedono una motivazione
- **Le mie richieste** — pannello per visualizzare lo stato delle proprie richieste con auto-refresh
- **Geolocalizzazione** con tracciamento continuo e bussola (giroscopio su mobile)
- **Popup interattivo** con modifica e eliminazione feature (utenti autenticati)
- **Autenticazione** con login/registrazione integrata
- **Pannello admin** per approvazione/rifiuto richieste pendenti
- **Cambio mappa base** (Topografica, Rilievo, Satellite, OpenStreetMap)
- **Legenda** sempre visibile
- **Tema chiaro / scuro / sistema** con persistenza
- **Multilingua** (Italiano 🇮🇹 / English 🇬🇧)
- **Responsive** — sidebar sempre visibile su desktop, bottom sheet su mobile
- **Installabile** come PWA con splash screen immediato e supporto offline

---

## Tech Stack

| Tecnologia                                                          | Versione | Utilizzo                     |
|---------------------------------------------------------------------|----------|------------------------------|
| [Svelte](https://svelte.dev)                                        | 5        | Framework UI (runes mode)    |
| [Vite](https://vitejs.dev)                                          | 6        | Build tool e dev server      |
| [ArcGIS Maps SDK for JS](https://developers.arcgis.com/javascript/) | 5        | Mappa, layer, geocoding      |
| [Supabase](https://supabase.com)                                    | 2.x      | Database PostGIS, auth e RLS |
| [OpenRouteService](https://openrouteservice.org)                    | v2       | Routing foot-hiking su OSM   |
| [Lucide Svelte](https://lucide.dev)                                 | 1.x      | Icone SVG                    |

---

## Architettura

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (PWA)                       │
│  Svelte 5 + Vite + ArcGIS Maps SDK                          │
├─────────────────────────────────────────────────────────────┤
│  Components                                                 │
│  ├── MapContainer        → Mappa Esri, GeoJSON layers       │
│  ├── CustomPopup         → Lettura/modifica/eliminazione    │
│  ├── AddFeature          → Creazione feature + routing OSM  │
│  ├── Navigate            → Ricerca sentieri verso POI       │
│  ├── AdminPanel          → Gestione richieste (admin)       │
│  ├── MyRequests          → Stato richieste (utente)         │
│  ├── Legend / Basemap    → UI legenda e mappa base          │
│  └── LocateButton        → GPS + bussola                    │
├─────────────────────────────────────────────────────────────┤
│  Services                                                   │
│  ├── trailsService       → CRUD + routing OpenRouteService  │
│  └── requestsService     → Submit/fetch/delete richieste    │
├─────────────────────────────────────────────────────────────┤
│  Stores ($state)                                            │
│  ├── mapStore            → Vista, layer, popup, UI, quota   │
│  ├── authStore           → Sessione utente, ruoli           │
│  └── themeStore          → Tema chiaro/scuro/sistema        │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
┌────────────────────────────┐  ┌───────────────────────────┐
│     Supabase (Backend)     │  │  OpenRouteService (API)   │
├────────────────────────────┤  ├───────────────────────────┤
│  Database (PostGIS)        │  │  Profilo: foot-hiking     │
│  ├── rifugi                │  │  Routing su grafo OSM     │
│  ├── sentieri              │  │  Rate limit: 2000/giorno  │
│  ├── vette                 │  │  Fallback: linea diretta  │
│  └── requests              │  └───────────────────────────┘
├────────────────────────────┤
│  Auth                      │
│  └── Email/password        │
├────────────────────────────┤
│  RLS Policies              │
│  ├── Admin: full access    │
│  ├── Utenti: own requests  │
│  └── Utenti: insert/delete │
├────────────────────────────┤
│  Functions (PostGIS)       │
│  ├── get_trails_to_dest    │
│  └── get_nearby_pois       │
└────────────────────────────┘
```

### Routing Sentieri (OpenRouteService)

Il tracciamento di nuovi sentieri utilizza l'API **OpenRouteService** con profilo `foot-hiking` per far seguire al
percorso il grafo stradale/sentieristico OpenStreetMap:

1. L'utente clicca waypoint sulla mappa
2. Per ogni coppia di punti consecutivi, viene richiesto il routing a ORS
3. La preview mostra immediatamente una linea dritta, poi si aggiorna con il percorso reale
4. Se la quota giornaliera è esaurita (HTTP 429), il tracciamento continua con linee dirette
5. L'admin vede il contatore `remaining/limit` accanto alla propria email

### Flusso Richieste (Utente non-admin)

1. L'utente crea/modifica/elimina una feature → viene inviata una **richiesta** (tabella `requests`)
2. Per le eliminazioni è richiesta una **motivazione** obbligatoria
3. L'admin vede le richieste pendenti nel pannello admin
4. L'admin approva (esegue l'azione) o rifiuta la richiesta
5. L'utente vede lo stato aggiornato in "Le mie richieste"

---

## Struttura del Progetto

```
src/
├── App.svelte                         # Layout principale (panel, header con settings)
├── App.css                            # Stili panel, header, auth, mobile
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
│   │   ├── add/
│   │   │   ├── AddFeature.svelte      # Aggiunta rifugi, vette e sentieri
│   │   │   └── AddFeature.css
│   │   ├── admin/
│   │   │   ├── AdminPanel.svelte      # Pannello admin richieste pendenti
│   │   │   └── AdminPanel.css
│   │   ├── requests/
│   │   │   ├── MyRequests.svelte      # Lista richieste utente con auto-refresh
│   │   │   └── MyRequests.css
│   │   ├── navigate/
│   │   │   ├── Navigate.svelte        # Barra floating "Raggiungi" con ricerca destinazione
│   │   │   └── Navigate.css
│   │   ├── locate/
│   │   │   ├── LocateButton.svelte    # Geolocalizzazione, tracciamento GPS e bussola
│   │   │   └── LocateButton.css
│   │   ├── basemap/
│   │   │   ├── BasemapSwitcher.svelte # Selezione mappa base
│   │   │   └── BasemapSwitcher.css
│   │   └── legend/
│   │       ├── Legend.svelte          # Legenda sentieri, rifugi e vette
│   │       └── Legend.css
│   │
│   └── popup/
│       ├── CustomPopup.svelte         # Card popup con modifica, eliminazione e nearby POIs
│       └── CustomPopup.css
│
├── lib/
│   └── supabaseClient.js              # Client Supabase
│
├── models/
│   └── schema.js                      # Schema tabelle (rifugi, sentieri, vette)
│
├── services/
│   ├── trailsService.js               # CRUD Supabase (fetch, insert, update, delete, navigate)
│   └── requestsService.js             # Richieste: submit, fetch, approve, reject, delete
│
├── stores/
│   ├── authStore.svelte.js            # Autenticazione utente e ruoli
│   ├── mapStore.svelte.js             # Stato mappa, popup, highlight, UI, segnali refresh
│   └── themeStore.svelte.js           # Stato tema (light/dark/system)
│
└── utils/
    └── popupUtils.js                  # Utility per popup

public/
├── manifest.json                      # PWA manifest
├── service-worker.js                  # Service worker per caching
├── offline.html                       # Pagina offline
├── favicon.png
└── images/icons/                      # Icone PWA (16–512px + maskable)
```

---

## Getting Started

### Prerequisiti

- [Node.js](https://nodejs.org) ≥ 18

### Installazione

```bash
git clone <repo-url>
cd bergamo-trails-pwa
npm install
```

### Variabili d'ambiente

Copia `.env.example` in `.env` e configura:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ORS_API_KEY=your-openrouteservice-api-key
```

Per ottenere una API key ORS gratuita (2000
req/giorno): [openrouteservice.org/dev](https://openrouteservice.org/dev/#/signup)

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

I dati geografici di partenza provengono dal servizio cartografico **Maggioli S.p.A.** per conto di **CAI Bergamo** e
sono serviti tramite **Supabase (PostGIS)** in formato GeoJSON.

Il dataset originale dei sentieri e rifugi viene progressivamente arricchito dalla community con l'aggiunta di **vette
**,
nuovi punti di interesse e nuovi sentieri tracciati direttamente dall'app.

La funzionalità "Raggiungi" utilizza una funzione PostGIS (`get_trails_to_destination`) per calcolare i sentieri
che passano vicino a un rifugio o vetta, distinguendo tra accesso diretto (< 100m) e tramite collegamento.

---

## Privacy & Disclaimer

> **L'indirizzo email fornito in fase di registrazione è utilizzato esclusivamente per identificare
> le richieste inviate all'admin** (creazione, modifica, eliminazione di feature).  
> Non viene condiviso con terze parti né utilizzato per altri scopi.

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

Questo progetto è a uso privato. I dati cartografici di partenza sono di proprietà di CAI Bergamo / Maggioli S.p.A. e
vengono integrati con contributi originali degli utenti.
