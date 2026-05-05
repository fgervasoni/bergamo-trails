<script>
    import './AdminPanel.css';
    import {Check, Loader, Pencil, Plus, Trash2, X} from 'lucide-svelte';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';
    import {approveRequest, fetchPendingRequests, rejectRequest} from '../../../services/requestsService.js';
    import {refreshLayer} from '../../../stores/mapStore.svelte.js';
    import {onDestroy, onMount} from 'svelte';

    let t = $derived(getT());

    let requests = $state(null);
    let loading = $state(false);
    let actionLoading = $state(null); // id della richiesta in corso
    let autoRefreshInterval = null;

    const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minuti

    onMount(() => {
        refresh();
        autoRefreshInterval = setInterval(refresh, AUTO_REFRESH_MS);
    });

    onDestroy(() => {
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    });

    export async function refresh() {
        loading = true;
        requests = await fetchPendingRequests();
        loading = false;
    }

    async function handleApprove(req) {
        actionLoading = req.id;
        const result = await approveRequest(req);
        if (result.success) {
            requests = requests.filter(r => r.id !== req.id);
            // Refresh del layer sulla mappa
            await refreshLayer(req.layer);
        }
        actionLoading = null;
    }

    async function handleReject(req) {
        actionLoading = req.id;
        const result = await rejectRequest(req.id);
        if (result.success) {
            requests = requests.filter(r => r.id !== req.id);
        }
        actionLoading = null;
    }

    function getActionIcon(action) {
        switch (action) {
            case 'create':
                return Plus;
            case 'update':
                return Pencil;
            case 'delete':
                return Trash2;
            default:
                return Plus;
        }
    }

    function getActionLabel(action) {
        return t.admin.actions[action] || action;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'});
    }
</script>

<div class="cai-admin-panel">
    <div class="cai-admin-header">
        <h3>{t.admin.title}</h3>
        <button class="cai-admin-refresh" disabled={loading} onclick={refresh}>
            {#if loading}
                <Loader size={14} strokeWidth={2} class="cai-spinning"/>
            {:else}
                ↻
            {/if}
        </button>
    </div>

    {#if loading && !requests}
        <div class="cai-admin-loading">
            <Loader size={16} strokeWidth={2} class="cai-spinning"/>
            <span>{t.admin.loading}</span>
        </div>
    {:else if requests && requests.length > 0}
        <div class="cai-admin-list">
            {#each requests as req}
                <div class="cai-admin-request" class:processing={actionLoading === req.id}>
                    <div class="cai-admin-req-header">
                        <span class="cai-admin-req-action {req.action}">
                            <svelte:component this={getActionIcon(req.action)} size={12} strokeWidth={2}/>
                            {getActionLabel(req.action)}
                        </span>
                        <span class="cai-admin-req-layer">{req.layer}</span>
                    </div>
                    <div class="cai-admin-req-meta">
                        <span class="cai-admin-req-user">{req.user_email}</span>
                        <span class="cai-admin-req-date">{formatDate(req.created_at)}</span>
                    </div>
                    {#if req.data && Object.keys(req.data).length > 0}
                        <div class="cai-admin-req-data">
                            {#each Object.entries(req.data).filter(([k]) => k !== 'geom') as [key, value]}
                                <span class="cai-admin-req-field">
                                    <strong>{key}:</strong> {value ?? '—'}
                                </span>
                            {/each}
                            {#if req.data.geom}
                                <span class="cai-admin-req-field cai-admin-geom">📍 Geometria inclusa</span>
                            {/if}
                        </div>
                    {/if}
                    {#if req.feature_id}
                        <span class="cai-admin-req-id">ID: {req.feature_id}</span>
                    {/if}
                    <div class="cai-admin-req-actions">
                        <button
                                class="cai-admin-btn reject"
                                onclick={() => handleReject(req)}
                                disabled={actionLoading === req.id}
                                aria-label={t.admin.reject}
                        >
                            <X size={14} strokeWidth={2}/>
                            {t.admin.reject}
                        </button>
                        <button
                                class="cai-admin-btn approve"
                                onclick={() => handleApprove(req)}
                                disabled={actionLoading === req.id}
                                aria-label={t.admin.approve}
                        >
                            {#if actionLoading === req.id}
                                <Loader size={14} strokeWidth={2} class="cai-spinning"/>
                            {:else}
                                <Check size={14} strokeWidth={2}/>
                            {/if}
                            {t.admin.approve}
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {:else if requests}
        <p class="cai-admin-empty">{t.admin.noRequests}</p>
    {:else}
        <p class="cai-admin-empty">{t.admin.tapRefresh}</p>
    {/if}
</div>



