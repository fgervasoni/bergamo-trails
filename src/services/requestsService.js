import { supabase } from '../lib/supabaseClient.js';

/**
 * Invia una richiesta di modifica (create/update/delete) per approvazione admin.
 *
 * Tabella Supabase `requests`:
 *   id (bigint, auto), user_email (text),
 *   action (text: 'create'|'update'|'delete'),
 *   layer (text: 'Rifugi'|'Sentieri'|'Vette'),
 *   feature_id (bigint, nullable — null per create),
 *   data (jsonb — payload con i dati nuovi),
 *   status (text: 'pending'|'approved'|'rejected', default 'pending'),
 *   created_at (timestamptz)
 *
 * @param {'create'|'update'|'delete'} action
 * @param {string} layer - 'Rifugi' | 'Sentieri' | 'Vette'
 * @param {object} payload - Dati della richiesta (campi nuovi per create/update, vuoto per delete)
 * @param {number|string|null} featureId - ID feature (null per create)
 * @param {string} userEmail - Email dell'utente che invia
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function submitRequest(action, layer, payload, featureId, userEmail) {
    const { error } = await supabase.from('requests').insert({
        user_email: userEmail,
        action,
        layer,
        feature_id: featureId ?? null,
        data: payload,
        status: 'pending'
    });
    if (error) {
        console.error('Errore invio richiesta:', error);
        return { success: false, error: error.message };
    }
    return { success: true, error: null };
}

/**
 * Recupera tutte le richieste pendenti (solo admin).
 * @returns {Promise<Array|null>}
 */
export async function fetchPendingRequests() {
    const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    if (error) {
        console.error('Errore caricamento richieste:', error);
        return null;
    }
    return data;
}

/**
 * Approva una richiesta: esegue l'azione e aggiorna lo status.
 * @param {object} request - Oggetto richiesta dal DB
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function approveRequest(request) {
    const { id, action, layer, feature_id, data: payload } = request;

    const tableMap = { Rifugi: 'rifugi', Sentieri: 'sentieri', Vette: 'vette' };
    const table = tableMap[layer];
    if (!table) return { success: false, error: 'Layer non valido' };

    let opError = null;

    try {
        if (action === 'create') {
            const { error } = await supabase.from(table).insert(payload);
            opError = error;
        } else if (action === 'update') {
            const { error } = await supabase.from(table).update(payload).eq('id', feature_id);
            opError = error;
        } else if (action === 'delete') {
            const { error } = await supabase.from(table).delete().eq('id', feature_id);
            opError = error;
        }
    } catch (e) {
        return { success: false, error: e.message };
    }

    if (opError) {
        console.error('Errore esecuzione richiesta:', opError);
        return { success: false, error: opError.message };
    }

    // Aggiorna status a 'approved'
    await supabase.from('requests').update({ status: 'approved' }).eq('id', id);
    return { success: true, error: null };
}

/**
 * Rifiuta una richiesta.
 * @param {number|string} requestId
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function rejectRequest(requestId) {
    const { error } = await supabase
        .from('requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);
    if (error) {
        console.error('Errore rifiuto richiesta:', error);
        return { success: false, error: error.message };
    }
    return { success: true, error: null };
}

/**
 * Recupera le richieste inviate dall'utente corrente.
 * @param {string} userEmail
 * @returns {Promise<Array|null>}
 */
export async function fetchUserRequests(userEmail) {
    const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('user_email', userEmail)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Errore caricamento richieste utente:', error);
        return null;
    }
    return data;
}

/**
 * Elimina una richiesta (l'utente può rimuovere le proprie già processate).
 * @param {number|string} requestId
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function deleteRequest(requestId) {
    const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestId);
    if (error) {
        console.error('Errore eliminazione richiesta:', error);
        return { success: false, error: error.message };
    }
    return { success: true, error: null };
}

