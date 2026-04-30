import { supabase } from '../lib/supabaseClient.js';

export const authState = $state({
    /** @type {import('@supabase/supabase-js').Session | null} */
    session: null,
    /** @type {import('@supabase/supabase-js').User | null} */
    user: null,
    loading: true
});

/**
 * Inizializza l'auth: legge la sessione corrente e ascolta i cambiamenti.
 * Chiamare una volta sola in onMount dell'app.
 */
export async function initAuth() {
    authState.loading = true;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        authState.session = session;
        authState.user = session?.user ?? null;
    } catch {
        authState.session = null;
        authState.user = null;
    } finally {
        authState.loading = false;
    }

    supabase.auth.onAuthStateChange((_event, session) => {
        authState.session = session;
        authState.user = session?.user ?? null;
    });
}

/**
 * Login con email e password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: null };
}

/**
 * Logout.
 */
export async function logout() {
    await supabase.auth.signOut();
    authState.session = null;
    authState.user = null;
}

/**
 * Registrazione nuovo utente con email e password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, error: string|null, needsConfirmation: boolean}>}
 */
export async function register(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
        return { success: false, error: error.message, needsConfirmation: false };
    }
    // Se l'utente è stato creato ma deve confermare l'email
    const needsConfirmation = !data.session;
    return { success: true, error: null, needsConfirmation };
}

