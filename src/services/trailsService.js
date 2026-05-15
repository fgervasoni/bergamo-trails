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

// canMakeRequest() rimosso: il rate limiting è ora gestito atomicamente
// dalla Edge Function `ors-route` tramite la stored procedure `check_ors_rate_limit`.

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
 * Calcola un segmento di percorso tra due punti seguendo il grafo sentieristico OSM.
 * La chiamata viene proxata tramite la Supabase Edge Function `ors-route`,
 * che mantiene la API key server-side e gestisce il rate limiting atomico via DB.
 *
 * @param {{longitude: number, latitude: number}} startPoint
 * @param {{longitude: number, latitude: number}} endPoint
 * @returns {Promise<number[][] | null>} Array di [lon, lat] oppure null se non disponibile
 */
export async function fetchTrailRouteSegment(startPoint, endPoint) {
    // Se quota giornaliera esaurita, non fare la chiamata
    if (orsQuota.exhausted) return null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/ors-route`;

    try {
        // Recupera il token di sessione corrente per autenticare la Edge Function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ startPoint, endPoint })
        });

        if (response.status === 429) {
            // Rate limit raggiunto (quota minuto o giornaliera)
            const body = await response.json().catch(() => ({}));
            if (body.error === 'quota_exhausted') {
                orsQuota.exhausted = true;
                orsQuota.remaining = 0;
            }
            notifyQuotaUpdate();
            persistOrsQuota();
            return null;
        }

        if (!response.ok) return null;

        const data = await response.json();

        // Aggiorna quota dalla risposta della Edge Function
        if (data.quota != null) {
            orsQuota.remaining = data.quota.remaining;
            if (data.quota.limit != null) orsQuota.limit = data.quota.limit;
            if (orsQuota.remaining != null && orsQuota.remaining <= 0) {
                orsQuota.exhausted = true;
            }
            notifyQuotaUpdate();
            persistOrsQuota();
        } else {
            // Fallback: decrementa manualmente
            if (orsQuota.remaining != null) {
                orsQuota.remaining = Math.max(0, orsQuota.remaining - 1);
                notifyQuotaUpdate();
                persistOrsQuota();
            }
        }

        const coordinates = data?.features?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) {
            return null;
        }

        return coordinates; // [[lon, lat], [lon, lat], ...]
    } catch (e) {
        console.warn('Routing ORS non disponibile, uso fallback lineare:', e.message);
        return null;
    }
}

