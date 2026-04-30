<script>
    import './App.css';
    import MapContainer from './components/map/MapContainer.svelte';
    import SearchBar from './components/panel/search/SearchBar.svelte';
    import LocateButton from './components/panel/locate/LocateButton.svelte';
    import BasemapSwitcher from './components/panel/basemap/BasemapSwitcher.svelte';
    import Legend from './components/panel/legend/Legend.svelte';
    import CustomPopup from './components/popup/CustomPopup.svelte';
    import {Loader, Monitor, Moon, Mountain, Settings, Sun, X} from 'lucide-svelte';
    import {availableLocales, getT, i18n, setLocale} from './assets/i18n/i18n.svelte.js';
    import {uiState} from './stores/mapStore.svelte.js';
    import {initTheme, setTheme, themeState} from './stores/themeStore.svelte.js';
    import {onMount} from 'svelte';

    let t = $derived(getT());
    let loading = $state(true);

    onMount(() => {
        initTheme();
    });

    function onMapReady() {
        loading = false;
    }

    const themeOptions = [
        {mode: 'light', icon: Sun, labelKey: 'light'},
        {mode: 'dark', icon: Moon, labelKey: 'dark'},
        {mode: 'system', icon: Monitor, labelKey: 'system'},
    ];
</script>

{#if loading}
    <div class="loading-overlay">
        <div class="loading-content">
            <div class="loading-icon">
                <Mountain size={48} strokeWidth={1.5}/>
            </div>
            <h2>{t.loading.title}</h2>
            <p>{t.loading.message}</p>
            <div class="loading-spinner">
                <Loader size={28} strokeWidth={2}/>
            </div>
        </div>
    </div>
{/if}

<div class="cai-app" class:visible={!loading}>
    <div class="cai-map-wrapper">
        <MapContainer onReady={onMapReady}/>
    </div>

    <aside class="cai-panel" class:closed={!uiState.panelOpen}>
        <div class="cai-panel-header">
            <div class="cai-brand">
                <Mountain size={22} strokeWidth={2}/>
                <div>
                    <h1>{t.panel.brand}</h1>
                    <span class="cai-brand-sub">{t.panel.subtitle}</span>
                </div>
            </div>
            <button aria-label={t.panel.close} class="cai-toggle-btn" onclick={() => uiState.panelOpen = false}>
                <X size={16} strokeWidth={2}/>
            </button>
        </div>

        <div class="cai-panel-body">
            <section class="cai-section">
                <span class="cai-section-label">{t.section.search}</span>
                <div class="cai-search-row">
                    <div class="cai-search-flex">
                        <SearchBar/>
                    </div>
                    <LocateButton/>
                </div>
            </section>

            <section class="cai-section">
                <span class="cai-section-label">{t.section.basemap}</span>
                <BasemapSwitcher/>
            </section>

            <section class="cai-section">
                <Legend/>
            </section>
        </div>

        <div class="cai-panel-footer">
            <div class="cai-settings-wrapper">
                <button
                        aria-expanded={uiState.settingsOpen}
                        aria-label={t.section.settings}
                        class="cai-settings-icon-btn"
                        onclick={() => uiState.settingsOpen = !uiState.settingsOpen}
                >
                    <Settings size={18} strokeWidth={2}/>
                </button>

                {#if uiState.settingsOpen}
                    <div class="cai-settings-dropdown">
                        <div class="cai-settings-row">
                            <span class="cai-settings-row-label">{t.settings.theme}</span>
                            <div class="cai-settings-row-buttons">
                                {#each themeOptions as opt}
                                    <button
                                            class="cai-theme-btn"
                                            class:active={themeState.mode === opt.mode}
                                            onclick={() => setTheme(opt.mode)}
                                            aria-label={t.settings[opt.labelKey]}
                                            title={t.settings[opt.labelKey]}
                                    >
                                        <opt.icon size={16} strokeWidth={2}/>
                                    </button>
                                {/each}
                            </div>
                        </div>
                        <div class="cai-settings-row">
                            <span class="cai-settings-row-label">{t.settings.language}</span>
                            <div class="cai-settings-row-buttons">
                                {#each availableLocales as loc}
                                    <button
                                            class="cai-lang-btn"
                                            class:active={i18n.locale === loc.code}
                                            onclick={() => setLocale(loc.code)}
                                    >
                                        {loc.label}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
            <div class="cai-panel-credits">
                <span>{t.footer.dataSource}</span>
                <a href="https://www.caibergamo.it"
                   rel="noopener noreferrer" target="_blank">CAI Bergamo</a>
            </div>
        </div>
    </aside>

    {#if !uiState.panelOpen}
        <button class="cai-open-pill" onclick={() => uiState.panelOpen = true} aria-label={t.panel.open}>
            <Mountain size={18} strokeWidth={2}/>
            <span>{t.panel.brand}</span>
        </button>
    {/if}

    <CustomPopup/>
</div>

