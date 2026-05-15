import { supabase } from '../lib/supabaseClient.js';

/**
 * Invia una richiesta di modifica (create/update/delete) per approvazione admin.
 * L'email utente viene ricavata server-side da supabase.auth.getUser()
 * per evitare che il client possa impersonare altri utenti.
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
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function submitRequest(action, layer, payload, featureId) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) {
        console.error('submitRequest: utente non autenticato', authError);
        return { success: false, error: 'Non autenticato' };
    }

    const { error } = await supabase.from('requests').insert({
        user_email: user.email,
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
 * Approva una richiesta in modo atomico tramite stored procedure SQL.
 * La funzione `approve_request` esegue l'azione sul DB e aggiorna lo status
 * in un'unica transazione con lock (FOR UPDATE), prevenendo doppia esecuzione.
 * @param {object} request - Oggetto richiesta dal DB
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function approveRequest(request) {
    const { data, error } = await supabase.rpc('approve_request', {
        p_request_id: request.id
    });

    if (error) {
        console.error('Errore approvazione richiesta (RPC):', error);
        return { success: false, error: error.message };
    }

    if (!data?.success) {
        console.error('Errore approvazione richiesta:', data?.error);
        return { success: false, error: data?.error ?? 'Errore sconosciuto' };
    }

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
 * Elimina una richiesta (l'utente può rimuovere solo le proprie già processate).
 * Il filtro su user_email è ridondante con la policy RLS, ma aggiunge difesa in profondità.
 * @param {number|string} requestId
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function deleteRequest(requestId) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) {
        return { success: false, error: 'Non autenticato' };
    }

    const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestId)
        .eq('user_email', user.email); // difesa in profondità oltre la RLS
    if (error) {
        console.error('Errore eliminazione richiesta:', error);
        return { success: false, error: error.message };
    }
    return { success: true, error: null };
}

