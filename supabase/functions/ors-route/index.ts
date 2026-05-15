/**
 * Edge Function: ors-route
 *
 * Proxy sicuro per OpenRouteService (foot-hiking routing).
 * - La ORS_API_KEY rimane server-side (mai esposta al client)
 * - Rate limiting atomico via stored procedure `check_ors_rate_limit` (FOR UPDATE su DB)
 * - Richiede autenticazione Supabase (Bearer token)
 *
 * Endpoint: POST /functions/v1/ors-route
 * Body:     { startPoint: {longitude, latitude}, endPoint: {longitude, latitude} }
 * Response: GeoJSON FeatureCollection + campo `quota` con info residue
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson';

Deno.serve(async (req: Request) => {
    // Gestione preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS });
    }

    try {
        // ── 1. Autenticazione utente ──────────────────────────────────────────
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonError('Missing Authorization header', 401);
        }

        const supabaseAnon = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
        if (userError || !user) {
            return jsonError('Unauthorized', 401);
        }

        // ── 2. Rate limit atomico via DB (stored procedure con FOR UPDATE) ────
        // Il service role bypassa la RLS per accedere alla tabella settings
        const supabaseService = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: allowed, error: rateError } = await supabaseService.rpc(
            'check_ors_rate_limit',
            { user_email_param: user.email }
        );

        if (rateError) {
            console.error('Rate limit check error:', rateError);
            // In caso di errore DB, lascia passare per non bloccare l'utente
        } else if (!allowed) {
            return jsonError('rate_limited', 429);
        }

        // ── 3. Controlla quota giornaliera ────────────────────────────────────
        const { data: quotaData } = await supabaseService
            .from('settings')
            .select('value')
            .eq('key', 'ors_quota')
            .single();

        if (quotaData?.value) {
            const savedDate = quotaData.value.updated_at
                ? new Date(quotaData.value.updated_at).toDateString()
                : null;
            const today = new Date().toDateString();
            const isToday = savedDate === today;

            if (isToday && quotaData.value.exhausted === true) {
                return jsonError('quota_exhausted', 429);
            }
        }

        // ── 4. Parse del body ─────────────────────────────────────────────────
        const { startPoint, endPoint } = await req.json();
        if (!startPoint?.longitude || !startPoint?.latitude ||
            !endPoint?.longitude || !endPoint?.latitude) {
            return jsonError('Invalid coordinates', 400);
        }

        // ── 5. Chiamata a OpenRouteService ────────────────────────────────────
        const orsApiKey = Deno.env.get('ORS_API_KEY') ?? '';

        const orsResponse = await fetch(ORS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': orsApiKey,
            },
            body: JSON.stringify({
                coordinates: [
                    [startPoint.longitude, startPoint.latitude],
                    [endPoint.longitude, endPoint.latitude],
                ],
            }),
        });

        // ── 6. Gestione risposta ORS ──────────────────────────────────────────
        const remaining = orsResponse.headers.get('x-ratelimit-remaining');
        const limit = orsResponse.headers.get('x-ratelimit-limit');

        const quotaUpdate = {
            remaining: remaining != null ? parseInt(remaining, 10) : null,
            limit: limit != null ? parseInt(limit, 10) : 2000,
            exhausted: remaining != null && parseInt(remaining, 10) <= 0,
            updated_at: new Date().toISOString(),
            last_user: user.email,
        };

        // Aggiorna quota su DB in background (non-blocking)
        supabaseService.from('settings').upsert(
            { key: 'ors_quota', value: quotaUpdate },
            { onConflict: 'key' }
        ).then(() => {}).catch((e: Error) => console.error('Quota update error:', e));

        if (orsResponse.status === 429) {
            quotaUpdate.exhausted = true;
            quotaUpdate.remaining = 0;
            // Aggiorna quota esaurita immediatamente
            await supabaseService.from('settings').upsert(
                { key: 'ors_quota', value: { ...quotaUpdate, exhausted: true, remaining: 0 } },
                { onConflict: 'key' }
            );
            return jsonError('quota_exhausted', 429);
        }

        if (!orsResponse.ok) {
            console.error('ORS error:', orsResponse.status, await orsResponse.text());
            return jsonError(`ORS error: ${orsResponse.status}`, 502);
        }

        const geoJson = await orsResponse.json();

        // ── 7. Risposta al client con info quota ──────────────────────────────
        return new Response(
            JSON.stringify({ ...geoJson, quota: quotaUpdate }),
            {
                headers: {
                    ...CORS_HEADERS,
                    'Content-Type': 'application/json',
                },
            }
        );

    } catch (err) {
        console.error('ors-route unhandled error:', err);
        return jsonError('Internal server error', 500);
    }
});

function jsonError(message: string, status: number): Response {
    return new Response(
        JSON.stringify({ error: message }),
        {
            status,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
    );
}
