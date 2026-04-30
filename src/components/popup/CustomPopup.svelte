<script>
    import './CustomPopup.css';
    import {Pencil, X, Check, Loader} from 'lucide-svelte';
    import {closeCustomPopup, popupState} from '../../stores/mapStore.svelte.js';
    import {getT} from '../../assets/i18n/i18n.svelte.js';
    import {updateRifugio} from '../../services/trailsService.js';
    import {getModel, castValue, inputTypeFor} from '../../models/schema.js';

    let t = $derived(getT());

    let visible = $state(false);
    let closing = $state(false);
    let editing = $state(false);
    let saving = $state(false);
    let saveStatus = $state(''); // '' | 'success' | 'error'

    let cachedTitle = $state('');
    let cachedFields = $state([]);
    let cachedEditable = $state(false);
    let cachedFeatureId = $state(null);
    let cachedLayerTitle = $state('');

    /** Copia editabile dei valori durante la modifica */
    let editValues = $state({});

    $effect(() => {
        if (popupState.open) {
            cachedTitle = popupState.title;
            cachedFields = popupState.fields;
            cachedEditable = popupState.editable;
            cachedFeatureId = popupState.featureId;
            cachedLayerTitle = popupState.layerTitle;
            editing = false;
            saving = false;
            saveStatus = '';
            closing = false;
            visible = true;
        } else if (visible && !closing) {
            closing = true;
            setTimeout(() => {
                visible = false;
                closing = false;
                editing = false;
            }, 220);
        }
    });

    function dismiss() {
        closing = true;
        setTimeout(() => {
            visible = false;
            closing = false;
            editing = false;
            closeCustomPopup();
        }, 220);
    }

    function startEdit() {
        editValues = {};
        for (const field of cachedFields) {
            editValues[field.key] = field.value ?? '';
        }
        saveStatus = '';
        editing = true;
    }

    function cancelEdit() {
        editing = false;
        saveStatus = '';
    }

    async function saveEdit() {
        if (!cachedFeatureId || saving) return;
        saving = true;
        saveStatus = '';

        // Costruisci oggetto update usando i model per il cast dei tipi
        const model = getModel(cachedLayerTitle);
        const updates = {};
        for (const field of cachedFields) {
            const def = model?.fields[field.key];
            // Invia solo campi che esistono nel model ed editabili
            if (!def || !def.editable) continue;
            let val = editValues[field.key];
            if (typeof val === 'string') val = val.trim();
            // Rimuovi eventuali suffissi di formattazione (es. "1650 m" → "1650")
            if ((def.type === 'integer' || def.type === 'bigint') && typeof val === 'string') {
                val = val.replace(/[^\d\-]/g, '');
            }
            updates[field.key] = castValue(val, def);
        }

        try {
            const result = await updateRifugio(cachedFeatureId, updates);
            if (result) {
                // Aggiorna i campi cached con i nuovi valori
                cachedFields = cachedFields.map(f => ({
                    ...f,
                    value: formatDisplayValue(f.key, updates[f.key])
                }));
                saveStatus = 'success';
                setTimeout(() => {
                    editing = false;
                    saveStatus = '';
                }, 1200);
            } else {
                saveStatus = 'error';
            }
        } catch {
            saveStatus = 'error';
        } finally {
            saving = false;
        }
    }

    function formatDisplayValue(key, value) {
        if (value == null || value === '') return null;
        if (key === 'quota') return `${value} m`;
        return String(value);
    }
</script>

{#if visible}
    <div class="cai-popup-card" class:cai-popup-closing={closing}>
        <div class="cai-popup-header">
            <span class="cai-popup-title">{cachedTitle}</span>
            <div class="cai-popup-header-actions">
                {#if cachedEditable && !editing}
                    <button class="cai-popup-edit" onclick={startEdit} aria-label={t.popup.edit} title={t.popup.edit}>
                        <Pencil size={13} strokeWidth={2}/>
                    </button>
                {/if}
                <button class="cai-popup-close" onclick={dismiss} aria-label={t.popup.close}>
                    <X size={14} strokeWidth={2}/>
                </button>
            </div>
        </div>
        <div class="cai-popup-body">
            {#if editing}
                <!-- Modalità editing -->
                {#each cachedFields as field}
                    {@const model = getModel(cachedLayerTitle)}
                    {@const def = model?.fields[field.key]}
                    <div class="cai-popup-field cai-popup-field-edit">
                        <label class="cai-popup-field-label" for="edit-{field.key}">{field.label}</label>
                        <input
                            id="edit-{field.key}"
                            class="cai-popup-input"
                            type={def ? inputTypeFor(def) : 'text'}
                            bind:value={editValues[field.key]}
                            placeholder="—"
                            disabled={saving}
                        />
                    </div>
                {/each}
                <div class="cai-popup-edit-actions">
                    {#if saveStatus === 'success'}
                        <span class="cai-popup-save-status success">{t.popup.saveSuccess}</span>
                    {:else if saveStatus === 'error'}
                        <span class="cai-popup-save-status error">{t.popup.saveError}</span>
                    {/if}
                    <button class="cai-popup-btn cancel" onclick={cancelEdit} disabled={saving}>
                        {t.popup.cancel}
                    </button>
                    <button class="cai-popup-btn save" onclick={saveEdit} disabled={saving}>
                        {#if saving}
                            <Loader size={14} strokeWidth={2} class="cai-spinning"/>
                        {:else}
                            <Check size={14} strokeWidth={2}/>
                        {/if}
                        {saving ? t.popup.saving : t.popup.save}
                    </button>
                </div>
            {:else}
                <!-- Modalità lettura -->
                {#each cachedFields as field}
                    <div class="cai-popup-field">
                        <span class="cai-popup-field-label">{field.label}</span>
                        <span class="cai-popup-field-value">{field.value ?? '—'}</span>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/if}
