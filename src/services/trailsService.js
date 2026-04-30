import { supabase } from '../lib/supabaseClient.js';

/**
 * Carica i sentieri da Supabase come GeoJSON FeatureCollection.
 * Chiama la funzione SQL `get_sentieri_geojson()` definita nel database.
 * @returns {Promise<GeoJSON.FeatureCollection | null>}
 */
export async function fetchSentieri() {
    const { data, error } = await supabase.rpc('get_sentieri_geojson');
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
    const { data, error } = await supabase.rpc('get_rifugi_geojson');
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
    const { data, error } = await supabase.rpc('get_vette_geojson');
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { error } = await supabase.from('sentieri').delete().eq('id', id);
    if (error) console.error('Errore eliminazione sentiero:', error);
    return !error;
}

/**
 * Elimina un rifugio.
 * @param {number|string} id
 */
export async function deleteRifugio(id) {
    const { error } = await supabase.from('rifugi').delete().eq('id', id);
    if (error) console.error('Errore eliminazione rifugio:', error);
    return !error;
}

/**
 * Elimina una vetta.
 * @param {number|string} id
 */
export async function deleteVetta(id) {
    const { error } = await supabase.from('vette').delete().eq('id', id);
    if (error) console.error('Errore eliminazione vetta:', error);
    return !error;
}

