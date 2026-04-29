<script>
    import './CustomPopup.css';
    import {X} from 'lucide-svelte';
    import {closeCustomPopup, popupState} from '../../stores/mapStore.svelte.js';
    import {getT} from '../../assets/i18n/i18n.svelte.js';

    let t = $derived(getT());

    let visible = $state(false);
    let closing = $state(false);
    let cachedTitle = $state('');
    let cachedFields = $state([]);

    $effect(() => {
        if (popupState.open) {
            cachedTitle = popupState.title;
            cachedFields = popupState.fields;
            closing = false;
            visible = true;
        } else if (visible && !closing) {
            closing = true;
            setTimeout(() => {
                visible = false;
                closing = false;
            }, 220);
        }
    });

    function dismiss() {
        closing = true;
        setTimeout(() => {
            visible = false;
            closing = false;
            closeCustomPopup();
        }, 220);
    }
</script>

{#if visible}
    <div class="cai-popup-card" class:cai-popup-closing={closing}>
        <div class="cai-popup-header">
            <span class="cai-popup-title">{cachedTitle}</span>
            <button class="cai-popup-close" onclick={dismiss} aria-label={t.popup.close}>
                <X size={14} strokeWidth={2}/>
            </button>
        </div>
        <div class="cai-popup-body">
            {#each cachedFields as field}
                <div class="cai-popup-field">
                    <span class="cai-popup-field-label">{field.label}</span>
                    <span class="cai-popup-field-value">{field.value ?? '—'}</span>
                </div>
            {/each}
        </div>
    </div>
{/if}

