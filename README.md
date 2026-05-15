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
- **Sistema di richieste** — gli utenti non-admin inviano richieste di creazione, modifica ed eliminazione revisionate
  dall'admin
- **Motivazione obbligatoria per eliminazione** — le richieste di eliminazione richiedono una motivazione
- **Le mie richieste** — pannello per visualizzare lo stato delle proprie richieste con auto-refresh
- **Geolocalizzazione** con tracciamento continuo e bussola (giroscopio su mobile)
- **Popup interattivo** con modifica e eliminazione feature (utenti autenticati)
- **Autenticazione** con login/registrazione integrata e conferma password
- **Pannello admin** per approvazione/rifiuto richieste pendenti (operazione atomica)
- **Cambio mappa base** (Topografica, Rilievo, Satellite, OpenStreetMap)
- **Legenda** sempre visibile
- **Tema chiaro / scuro / sistema** con persistenza
- **Multilingua** (Italiano 🇮🇹 / English 🇬🇧)
- **Responsive** — sidebar sempre visibile su desktop, bottom sheet su mobile
- **Installabile** come PWA con splash screen immediato e supporto offline

---

## Tech Stack

| Tecnologia                                                          | Versione | Utilizzo                                    |
|---------------------------------------------------------------------|----------|---------------------------------------------|
| [Svelte](https://svelte.dev)                                        | 5        | Framework UI (runes mode)                   |
| [Vite](https://vitejs.dev)                                          | 6        | Build tool e dev server                     |
| [ArcGIS Maps SDK for JS](https://developers.arcgis.com/javascript/) | 5        | Mappa, layer, geocoding                     |
| [Supabase](https://supabase.com)                                    | 2.x      | Database PostGIS, auth, RLS, Edge Functions |
| [OpenRouteService](https://openrouteservice.org)                    | v2       | Routing foot-hiking su OSM                  |
| [Lucide Svelte](https://lucide.dev)                                 | 1.x      | Icone SVG                                   |

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
│  ├── trailsService       → CRUD + routing (via Edge Fn)     │
│  └── requestsService     → Submit/fetch/approve/delete      │
├─────────────────────────────────────────────────────────────┤
│  Stores ($state)                                            │
│  ├── mapStore            → Vista, layer, popup, UI, quota   │
│  ├── authStore           → Sessione utente, ruoli           │
│  └── themeStore          → Tema chiaro/scuro/sistema        │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴────────────────┐
              ▼                                ▼
┌─────────────────────────┐   ┌────────────────────────────────┐
│   Supabase (Backend)    │   │  Edge Function: ors-route      │
├─────────────────────────┤   ├────────────────────────────────┤
│  Database (PostGIS)     │   │  Proxy sicuro per ORS          │
│  ├── rifugi             │   │  API key mai esposta al client │
│  ├── sentieri           │   │  Rate limiting atomico via DB  │
│  ├── vette              │   │  Auth utente via Bearer token  │
│  ├── requests           │   └───────────┬────────────────────┘
│  └── settings           │               │
├─────────────────────────┤               ▼
│  Auth                   │   ┌────────────────────────────────┐
│  └── Email/password     │   │  OpenRouteService (API)        │
├─────────────────────────┤   ├────────────────────────────────┤
│  RLS Policies           │   │  Profilo: foot-hiking          │
│  ├── Admin: full access │   │  Routing su grafo OSM          │
│  ├── Utenti: own rows   │   │  Rate limit: 2000/giorno       │
│  └── Insert: own email  │   │  Fallback: linea diretta       │
├─────────────────────────┤   └────────────────────────────────┘
│  Stored Procedures      │
│  ├── approve_request    │  ← atomica con FOR UPDATE
│  └── check_ors_rate_limit│ ← atomica con FOR UPDATE
├─────────────────────────┤
│  Triggers               │
│  └── updated_at (auto)  │  ← su rifugi, sentieri, vette
├─────────────────────────┤
│  PostGIS Functions      │
│  ├── get_trails_to_dest │
│  └── get_nearby_pois    │
└─────────────────────────┘
```

### Routing Sentieri (OpenRouteService)

Il tracciamento di nuovi sentieri usa l'API **OpenRouteService** (profilo `foot-hiking`) proxata tramite una **Supabase
Edge Function** (`ors-route`):

1. L'utente clicca waypoint sulla mappa
2. `trailsService.js` chiama la Edge Function autenticandosi con il Bearer token di sessione
3. La Edge Function verifica il rate limit in modo atomico (stored procedure `check_ors_rate_limit` con `FOR UPDATE`) e
   chiama ORS con la API key **mai esposta al client**
4. La preview mostra immediatamente una linea dritta, poi si aggiorna con il percorso reale
5. Se la quota giornaliera è esaurita (HTTP 429), il tracciamento continua con linee dirette
6. L'admin vede il contatore `remaining/limit` accanto alla propria email

### Flusso Richieste (Utente non-admin)

1. L'utente crea/modifica/elimina una feature → viene inviata una **richiesta** (tabella `requests`)
2. L'email utente è ricavata server-side da `supabase.auth.getUser()` — non può essere falsificata dal client
3. Per le eliminazioni è richiesta una **motivazione** obbligatoria
4. L'admin approva o rifiuta dal pannello admin
5. L'approvazione è **atomica**: la stored procedure `approve_request` usa `FOR UPDATE` per prevenire doppia esecuzione
   e garantisce rollback in caso di errore
6. L'utente vede lo stato aggiornato in "Le mie richieste"

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
│   │   │   ├── Navigate.svelte        # Barra floating "Raggiungi"
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
│   ├── trailsService.js               # CRUD Supabase + routing via Edge Function
│   └── requestsService.js             # Richieste: submit, fetch, approve (RPC), delete
│
├── stores/
│   ├── authStore.svelte.js            # Auth, ruoli, subscription cleanup
│   ├── mapStore.svelte.js             # Stato mappa, popup, highlight, UI, quota ORS
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
- [Supabase CLI](https://supabase.com/docs/guides/cli) (per deploy Edge Functions)

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
```

> **Nota:** La chiave ORS **non va nel `.env` del frontend**. È gestita come secret server-side nella Edge Function

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

## Deploy

Il progetto include la configurazione per **Netlify** (`netlify.toml`).  
Basta collegare il repository a Netlify e il deploy avverrà automaticamente.

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

---

## Dati

I dati geografici di partenza provengono dal servizio cartografico **Maggioli S.p.A.** per conto di **CAI Bergamo** e
sono serviti tramite **Supabase (PostGIS)** in formato GeoJSON.

Il dataset originale dei sentieri e rifugi viene progressivamente arricchito dalla community con l'aggiunta di vette,
nuovi punti di interesse e nuovi sentieri tracciati direttamente dall'app.

La funzionalità "Raggiungi" utilizza una funzione PostGIS (`get_trails_to_destination`) per calcolare i sentieri che
passano vicino a un rifugio o vetta, distinguendo tra accesso diretto (< 100m) e tramite collegamento.

---

## Privacy & Disclaimer

> **L'indirizzo email fornito in fase di registrazione è utilizzato esclusivamente per identificare le richieste inviate
all'admin** (creazione, modifica, eliminazione di feature).  
> Non viene condiviso con terze parti né utilizzato per altri scopi.

---

## Licenza

Questo progetto è a uso privato. I dati cartografici di partenza sono di proprietà di CAI Bergamo / Maggioli S.p.A. e
vengono integrati con contributi originali degli utenti.
