import {supabase} from '../lib/supabaseClient.js';

/**
 * Carica i sentieri da Supabase come GeoJSON FeatureCollection.
 * Chiama la funzione SQL `get_sentieri_geojson()` definita nel database.
 * @returns {Promise<GeoJSON.FeatureCollection | null>}
 */
export async function fetchSentieri() {
    const {data, error} = await supabase.rpc('get_sentieri_geojson');
    if (error) {
        console.error('Errore caricamento sentieri:', error);
        return null;
    }
    return data;
}

/**
 * Carica i rifugi da Supabase come GeoJSON FeatureCollection.
 * Chiama la funzione SQL `get_rifugi_geojson()` definita nel database.
 * @returns {Promise<GeoJSON.FeatureCollection | null>}
 */
export async function fetchRifugi() {
    const {data, error} = await supabase.rpc('get_rifugi_geojson');
    if (error) {
        console.error('Errore caricamento rifugi:', error);
        return null;
    }
    return data;
}

/**
 * Carica le vette da Supabase come GeoJSON FeatureCollection.
 * @returns {Promise<GeoJSON.FeatureCollection | null>}
 */
export async function fetchVette() {
    const {data, error} = await supabase.rpc('get_vette_geojson');
    if (error) {
        console.error('Errore caricamento vette:', error);
        return null;
    }
    return data;
}

/**
 * Aggiorna una vetta esistente.
 * @param {number|string} id
 * @param {object} updates
 */
export async function updateVetta(id, updates) {
    const {data, error} = await supabase
        .from('vette')
        .update(updates)
        .eq('id', id)
        .select();
    if (error) {
        console.error('Errore aggiornamento vetta:', error);
        return null;
    }
    if (!data || data.length === 0) {
        console.error('Aggiornamento vetta: nessuna riga modificata (controlla le policy RLS)');
        return null;
    }
    return data;
}

/**
 * Aggiorna un sentiero esistente.
 * @param {number|string} id - ID del sentiero
 * @param {object} updates - Campi da aggiornare (es. { numero_cai: '101', difficolta: 'E' })
 */
export async function updateSentiero(id, updates) {
    const {data, error} = await supabase
        .from('sentieri')
        .update(updates)
        .eq('id', id)
        .select();
    if (error) {
        console.error('Errore aggiornamento sentiero:', error);
        return null;
    }
    return data;
}

/**
 * Aggiorna un rifugio esistente.
 * @param {number|string} id - ID del rifugio
 * @param {object} updates - Campi da aggiornare (es. { nome: 'Rifugio Nuovo', quota: 1500 })
 */
export async function updateRifugio(id, updates) {
    const {data, error} = await supabase
        .from('rifugi')
        .update(updates)
        .eq('id', id)
        .select();
    if (error) {
        console.error('Errore aggiornamento rifugio:', error);
        return null;
    }
    if (!data || data.length === 0) {
        console.error('Aggiornamento rifugio: nessuna riga modificata (controlla le policy RLS su Supabase)');
        return null;
    }
    return data;
}

/**
 * Inserisce un nuovo sentiero.
 * @param {object} sentiero - { numero_cai, difficolta, geom (WKT o GeoJSON) }
 */
export async function insertSentiero(sentiero) {
    const {data, error} = await supabase
        .from('sentieri')
        .insert(sentiero)
        .select();
    if (error) {
        console.error('Errore inserimento sentiero:', error);
        return null;
    }
    return data;
}

/**
 * Inserisce un nuovo rifugio.
 * @param {object} rifugio - { nome, proprieta, quota, geom (WKT) }
 */
export async function insertRifugio(rifugio) {
    const {data, error} = await supabase
        .from('rifugi')
        .insert(rifugio)
        .select();
    if (error) {
        console.error('Errore inserimento rifugio:', error);
        return null;
    }
    return data;
}

/**
 * Inserisce una nuova vetta.
 * @param {object} vetta - { nome, quota, descrizione, geom (WKT) }
 */
export async function insertVetta(vetta) {
    const {data, error} = await supabase
        .from('vette')
        .insert(vetta)
        .select();
    if (error) {
        console.error('Errore inserimento vetta:', error);
        return null;
    }
    return data;
}

/**
 * Elimina un sentiero.
 * @param {number|string} id
 */
export async function deleteSentiero(id) {
    const {error} = await supabase.from('sentieri').delete().eq('id', id);
    if (error) console.error('Errore eliminazione sentiero:', error);
    return !error;
}

/**
 * Elimina un rifugio.
 * @param {number|string} id
 */
export async function deleteRifugio(id) {
    const {error} = await supabase.from('rifugi').delete().eq('id', id);
    if (error) console.error('Errore eliminazione rifugio:', error);
    return !error;
}

/**
 * Elimina una vetta.
 * @param {number|string} id
 */
export async function deleteVetta(id) {
    const {error} = await supabase.from('vette').delete().eq('id', id);
    if (error) console.error('Errore eliminazione vetta:', error);
    return !error;
}

/**
 * Recupera rifugi e vette vicini a un sentiero entro un raggio dato.
 * Chiama la funzione SQL `get_nearby_pois(sentiero_id, radius_meters)`.
 * @param {number|string} sentieroId - ID del sentiero
 * @param {number} radiusMeters - Raggio di ricerca in metri (default 500)
 * @returns {Promise<{rifugi: Array, vette: Array} | null>}
 */
export async function fetchNearbyPois(sentieroId, radiusMeters = 500) {
    const {data, error} = await supabase.rpc('get_nearby_pois', {
        sentiero_id: Number(sentieroId),
        radius_meters: radiusMeters
    });
    if (error) {
        console.error('Errore caricamento POI vicini:', error);
        return null;
    }
    return data;
}

/**
 * Recupera i sentieri che passano vicino a una destinazione (rifugio o vetta).
 * Chiama la funzione SQL `get_trails_to_destination(dest_type, dest_id, radius_meters)`.
 * @param {'rifugio'|'vetta'} destType - Tipo di destinazione
 * @param {number|string} destId - ID della destinazione
 * @param {number} radiusMeters - Raggio di ricerca in metri (default 1000)
 * @returns {Promise<Array<{id, numero_cai, difficolta, distanza_m, lunghezza_km}> | null>}
 */
export async function fetchTrailsToDestination(destType, destId, radiusMeters = 1000) {
    const {data, error} = await supabase.rpc('get_trails_to_destination', {
        dest_type: destType,
        dest_id: Number(destId),
        radius_meters: radiusMeters
    });
    if (error) {
        console.error('Errore caricamento sentieri verso destinazione:', error);
        return null;
    }
    return data;
}

/**
 * Stato quota API OpenRouteService — oggetto mutabile aggiornato ad ogni chiamata.
 * Siccome ORS non espone gli header rate-limit via CORS, tracciamo localmente.
 */
export const orsQuota = {remaining: null, limit: 2000, exhausted: false};

/** Rate limiter: max 40 richieste per minuto (condiviso tra tutti gli utenti via DB) */
const RATE_LIMIT_PER_MINUTE = 40;

/**
 * Controlla e aggiorna il rate limit al minuto salvato su DB (condiviso tra utenti).
 * @returns {Promise<boolean>} true se la richiesta può essere fatta
 */
async function canMakeRequest() {
    try {
        const {data} = await supabase.from('settings').select('value').eq('key', 'ors_minute_rate').single();
        const now = Date.now();
        let timestamps = [];

        if (data?.value?.timestamps) {
            // Filtra timestamp più vecchi di 60 secondi
            timestamps = data.value.timestamps.filter(ts => now - ts < 60000);
        }

        if (timestamps.length >= RATE_LIMIT_PER_MINUTE) {
            return false;
        }

        // Aggiungi il timestamp corrente con email utente e salva
        const email = (await supabase.auth.getUser())?.data?.user?.email ?? 'unknown';
        timestamps.push(now);
        await supabase.from('settings').upsert({
            key: 'ors_minute_rate',
            value: {timestamps, last_user: email}
        }, {onConflict: 'key'});

        return true;
    } catch (_) {
        return true;
    }
}

/** Callback opzionale per notificare aggiornamenti quota alla UI */
let _onQuotaUpdate = null;

export function setOrsQuotaCallback(fn) {
    _onQuotaUpdate = fn;
}

function notifyQuotaUpdate() {
    if (_onQuotaUpdate) _onQuotaUpdate(orsQuota);
}

/**
 * Salva la quota ORS su Supabase (tabella `settings`, chiave `ors_quota`).
 */
async function persistOrsQuota() {
    try {
        const email = (await supabase.auth.getUser())?.data?.user?.email ?? 'unknown';
        await supabase.from('settings').upsert({
            key: 'ors_quota',
            value: {
                remaining: orsQuota.remaining,
                limit: orsQuota.limit,
                updated_at: new Date().toISOString(),
                last_user: email
            }
        }, {onConflict: 'key'});
    } catch (_) {
    }
}

/**
 * Carica la quota ORS salvata da Supabase (senza consumare una chiamata API).
 * Chiamare all'avvio per l'admin.
 * Se il dato salvato è di un giorno precedente, resetta la quota (reset giornaliero a mezzanotte).
 */
export async function loadOrsQuota() {
    try {
        const {data} = await supabase.from('settings').select('value').eq('key', 'ors_quota').single();
        if (data?.value) {
            // Controlla se il dato è di oggi o di un giorno precedente
            const savedDate = data.value.updated_at ? new Date(data.value.updated_at).toDateString() : null;
            const today = new Date().toDateString();

            if (savedDate && savedDate !== today) {
                // Nuovo giorno: resetta quota
                orsQuota.remaining = orsQuota.limit;
                orsQuota.exhausted = false;
            } else {
                orsQuota.remaining = data.value.remaining ?? orsQuota.limit;
                orsQuota.limit = data.value.limit ?? orsQuota.limit;
                if (orsQuota.remaining != null && orsQuota.remaining <= 0) {
                    orsQuota.exhausted = true;
                }
            }
            notifyQuotaUpdate();
        } else {
            // Prima volta: inizializza con il limite
            orsQuota.remaining = orsQuota.limit;
            notifyQuotaUpdate();
        }
    } catch (_) {
        // Prima volta o errore: inizializza
        orsQuota.remaining = orsQuota.limit;
        notifyQuotaUpdate();
    }
}

/**
 * Calcola un segmento di percorso tra due punti seguendo il grafo stradale/sentieristico OSM.
 * Usa OpenRouteService con profilo "foot-hiking" (escursionismo).
 * API docs: https://openrouteservice.org/dev/#/api-docs/v2/directions
 *
 * @param {{longitude: number, latitude: number}} startPoint
 * @param {{longitude: number, latitude: number}} endPoint
 * @returns {Promise<number[][] | null>} Array di [lon, lat] oppure null se non disponibile
 */
export async function fetchTrailRouteSegment(startPoint, endPoint) {
    // Se quota giornaliera esaurita, non fare la chiamata
    if (orsQuota.exhausted) return null;

    // Rate limit: max 40 req/minuto (condiviso tra tutti gli utenti)
    if (!(await canMakeRequest())) return null;

    const apiKey = import.meta.env.VITE_ORS_API_KEY;
    // TODO: verrà deprecato ad agosto 2026
    // const url = 'https://api.heigit.org/openrouteservice/v2/directions/foot-hiking/geojson';
    const url = 'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey
            },
            body: JSON.stringify({
                coordinates: [
                    [startPoint.longitude, startPoint.latitude],
                    [endPoint.longitude, endPoint.latitude]
                ]
            })
        });

        // Leggi quota dagli header (potrebbe non funzionare via CORS)
        const remaining = response.headers.get('x-ratelimit-remaining');
        const limit = response.headers.get('x-ratelimit-limit');
        if (remaining != null) {
            orsQuota.remaining = parseInt(remaining, 10);
        } else {
            // Fallback: decrementa manualmente
            if (orsQuota.remaining != null) {
                orsQuota.remaining = Math.max(0, orsQuota.remaining - 1);
            }
        }
        if (limit != null) orsQuota.limit = parseInt(limit, 10);

        if (response.status === 429) {
            orsQuota.exhausted = true;
            orsQuota.remaining = 0;
            notifyQuotaUpdate();
            persistOrsQuota();
            return null;
        }

        if (!response.ok) return null;

        if (orsQuota.remaining != null && orsQuota.remaining <= 0) {
            orsQuota.exhausted = true;
        }
        notifyQuotaUpdate();
        persistOrsQuota();

        const data = await response.json();
        const coordinates = data?.features?.[0]?.geometry?.coordinates;

        if (!Array.isArray(coordinates) || coordinates.length < 2) {
            return null;
        }

        return coordinates; // [[lon, lat], [lon, lat], ...]
    } catch (e) {
        console.warn('Routing OpenRouteService non disponibile, uso fallback lineare:', e.message);
        return null;
    }
}

