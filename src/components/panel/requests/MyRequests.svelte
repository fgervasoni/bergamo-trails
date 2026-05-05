<script>
    import './MyRequests.css';
    import {Loader, Plus, Pencil, Trash2, X} from 'lucide-svelte';
    import {getT} from '../../../assets/i18n/i18n.svelte.js';
    import {fetchUserRequests, deleteRequest} from '../../../services/requestsService.js';
    import {authState} from '../../../stores/authStore.svelte.js';
    import {requestsSignal} from '../../../stores/mapStore.svelte.js';
    import {onMount, onDestroy} from 'svelte';

    let t = $derived(getT());

    let requests = $state(null);
    let loading = $state(false);
    let deletingId = $state(null);
    let deleteError = $state('');
    let autoRefreshInterval = null;

    const AUTO_REFRESH_MS = 5 * 60 * 1000;

    onMount(() => {
        refresh();
        autoRefreshInterval = setInterval(refresh, AUTO_REFRESH_MS);
    });

    onDestroy(() => {
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    });

    // React to external refresh signals
    $effect(() => {
        const _ = requestsSignal.tick;
        if (_) refresh();
    });

    async function refresh() {
        if (!authState.user?.email) return;
        loading = true;
        deleteError = '';
        requests = await fetchUserRequests(authState.user.email);
        loading = false;
    }

    async function handleDelete(id) {
        deleteError = '';
        const confirmed = window.confirm(t.popup.deleteConfirm);
        if (!confirmed) return;
        deletingId = id;
        const result = await deleteRequest(id);
        if (result.success) {
            requests = requests.filter(r => r.id !== id);
        } else {
            deleteError = t.request.deleteError;
        }
        deletingId = null;
    }

    function getActionIcon(action) {
        switch (action) {
            case 'create': return Plus;
            case 'update': return Pencil;
            case 'delete': return Trash2;
            default: return Plus;
        }
    }

    function getStatusClass(status) {
        switch (status) {
            case 'approved': return 'approved';
            case 'rejected': return 'rejected';
            default: return 'pending';
        }
    }

    function getStatusLabel(status) {
        switch (status) {
            case 'approved': return t.request.statusApproved;
            case 'rejected': return t.request.statusRejected;
            default: return t.request.statusPending;
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'});
    }
</script>

<div class="cai-my-requests">
    <div class="cai-my-requests-header">
        <span class="cai-section-label">{t.request.myTitle}</span>
        <button class="cai-my-requests-refresh" onclick={refresh} disabled={loading}>
            {#if loading}
                <Loader size={12} strokeWidth={2} class="cai-spinning"/>
            {:else}
                ↻
            {/if}
        </button>
    </div>

    {#if deleteError}
        <div class="cai-my-requests-loading">
            <span>{deleteError}</span>
        </div>
    {/if}

    {#if loading && !requests}
        <div class="cai-my-requests-loading">
            <Loader size={14} strokeWidth={2} class="cai-spinning"/>
            <span>{t.request.loading}</span>
        </div>
    {:else if requests && requests.length > 0}
        <div class="cai-my-requests-list">
            {#each requests as req}
                <div class="cai-my-request-item">
                    <div class="cai-my-request-top">
                        <span class="cai-my-request-action {req.action}">
                            <svelte:component this={getActionIcon(req.action)} size={10} strokeWidth={2}/>
                        </span>
                        <span class="cai-my-request-layer">{req.layer}</span>
                        <span class="cai-my-request-status {getStatusClass(req.status)}">
                            {getStatusLabel(req.status)}
                        </span>
                    </div>
                    <div class="cai-my-request-bottom">
                        <span class="cai-my-request-date">{formatDate(req.created_at)}</span>
                        <button
                            class="cai-my-request-delete"
                            onclick={() => handleDelete(req.id)}
                            disabled={deletingId === req.id}
                            aria-label={t.request.delete}
                            title={t.request.delete}
                        >
                            {#if deletingId === req.id}
                                <Loader size={10} strokeWidth={2} class="cai-spinning"/>
                            {:else}
                                <X size={10} strokeWidth={2}/>
                            {/if}
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {:else if requests}
        <p class="cai-my-requests-empty">{t.request.empty}</p>
    {/if}
</div>


