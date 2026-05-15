<script>
    import './App.css';
    import MapContainer from './components/map/MapContainer.svelte';
    import BasemapSwitcher from './components/panel/basemap/BasemapSwitcher.svelte';
    import Legend from './components/panel/legend/Legend.svelte';
    import AddFeature from './components/panel/add/AddFeature.svelte';
    import Navigate from './components/panel/navigate/Navigate.svelte';
    import AdminPanel from './components/panel/admin/AdminPanel.svelte';
    import MyRequests from './components/panel/requests/MyRequests.svelte';
    import CustomPopup from './components/popup/CustomPopup.svelte';
    import {
        Loader,
        LogIn,
        LogOut,
        MapPinPlus,
        Monitor,
        Moon,
        Settings,
        Sun,
        X
    } from 'lucide-svelte';
    import {availableLocales, getT, i18n, setLocale} from './assets/i18n/i18n.svelte.js';
    import {closeCustomPopup, popupState, uiState, orsQuotaState} from './stores/mapStore.svelte.js';
    import {initTheme, setTheme, themeState} from './stores/themeStore.svelte.js';
    import {authState, initAuth, isAdmin, login, logout, register} from './stores/authStore.svelte.js';
    import {orsQuota, setOrsQuotaCallback, loadOrsQuota} from './services/trailsService.js';
    import {onMount, onDestroy} from 'svelte';

    let t = $derived(getT());
    let loading = $state(true);
    let _authCleanup = null;

    function toggleMobileAdd() {
        uiState.mobileAddOpen = !uiState.mobileAddOpen;
        if (uiState.mobileAddOpen) {
            if (uiState.panelOpen) uiState.panelOpen = false;
            if (popupState.open) closeCustomPopup();
        }
    }

    onDestroy(() => {
        if (_authCleanup) _authCleanup();
    });

    // Auth form state
    let authEmail = $state('');
    let authPassword = $state('');
    let authPasswordConfirm = $state('');
    let authLoading = $state(false);
    let authError = $state('');
    let authMode = $state('login'); // 'login' | 'register'
    let authSuccess = $state('');

    // Gyroscope permission popup
    let showGyroPrompt = $state(false);
    let locateButtonRef = $state(null);

    onMount(async () => {
        initTheme();
        _authCleanup = await initAuth();
        // Wire ORS quota updates to reactive state
        setOrsQuotaCallback((q) => {
            orsQuotaState.remaining = q.remaining;
            orsQuotaState.limit = q.limit;
            orsQuotaState.exhausted = q.exhausted;
        });
        // Carica quota ORS dal DB (senza consumare chiamate API)
        loadOrsQuota();
    });

    function onMapReady() {
        loading = false;
        // Mostra il popup giroscopio su iOS se non già rifiutato in questa sessione
        checkGyroPermission();
        // Hide the HTML splash
        const splash = document.getElementById('splash-loading');
        if (splash) {
            splash.classList.add('hidden');
            setTimeout(() => splash.remove(), 400);
        }
    }

    const themeOptions = [
        {mode: 'light', icon: Sun, labelKey: 'light'},
        {mode: 'dark', icon: Moon, labelKey: 'dark'},
        {mode: 'system', icon: Monitor, labelKey: 'system'},
    ];

    async function handleLogin(e) {
        e.preventDefault();
        if (!authEmail.trim() || !authPassword) return;
        authLoading = true;
        authError = '';
        authSuccess = '';
        const result = await login(authEmail.trim(), authPassword);
        if (!result.success) {
            authError = t.auth.loginError;
        } else {
            authEmail = '';
            authPassword = '';
        }
        authLoading = false;
    }

    async function handleRegister(e) {
        e.preventDefault();
        if (!authEmail.trim() || !authPassword) return;
        authError = '';
        authSuccess = '';
        // Validazione client-side
        if (authPassword.length < 6) {
            authError = t.auth.passwordTooShort;
            return;
        }
        if (authPassword !== authPasswordConfirm) {
            authError = t.auth.passwordMismatch;
            return;
        }
        authLoading = true;
        const result = await register(authEmail.trim(), authPassword);
        if (!result.success) {
            authError = t.auth.registerError;
        } else if (result.needsConfirmation) {
            authSuccess = t.auth.confirmEmail;
            authPassword = '';
            authPasswordConfirm = '';
        } else {
            authEmail = '';
            authPassword = '';
            authPasswordConfirm = '';
        }
        authLoading = false;
    }

    function switchAuthMode() {
        authMode = authMode === 'login' ? 'register' : 'login';
        authError = '';
        authSuccess = '';
        authPassword = '';
        authPasswordConfirm = '';
    }

    async function handleLogout() {
        await logout();
    }

    function checkGyroPermission() {
        // Solo su iOS (dove esiste requestPermission) e solo su mobile
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function' &&
            window.innerWidth <= 540) {
            // Mostra il popup dopo un breve delay per non sovrapporre alla splash
            setTimeout(() => {
                showGyroPrompt = true;
            }, 800);
        }
    }

    function acceptGyro() {
        showGyroPrompt = false;
        // Deve essere chiamato nel callstack del gesto utente
        DeviceOrientationEvent.requestPermission().then((state) => {
            if (state === 'granted') {
                // Notifica il LocateButton che può ascoltare l'orientamento
                if (locateButtonRef?.startOrientationAfterPermission) {
                    locateButtonRef.startOrientationAfterPermission();
                }
            }
        }).catch(() => {
        });
    }

    function declineGyro() {
        showGyroPrompt = false;
    }
</script>


<div class="cai-app" class:visible={!loading}>
    <div class="cai-map-wrapper">
        <MapContainer onReady={onMapReady}/>
    </div>

    <aside class="cai-panel" class:closed={!uiState.panelOpen}>
        <div class="cai-panel-header">
            <div class="cai-brand">
                <img src="/images/icons/icon-48x48.png" alt="Bergamo Trails" class="cai-brand-logo"/>
                <div>
                    <h1>{t.panel.brand}</h1>
                    <span class="cai-brand-sub">{t.panel.subtitle}</span>
                </div>
            </div>
            <div class="cai-panel-header-actions">
                <div class="cai-settings-wrapper">
                    <button
                            aria-expanded={uiState.settingsOpen}
                            aria-label={t.section.settings}
                            class="cai-settings-icon-btn"
                            onclick={() => uiState.settingsOpen = !uiState.settingsOpen}
                    >
                        <Settings size={16} strokeWidth={2}/>
                    </button>

                    {#if uiState.settingsOpen}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div class="cai-settings-backdrop" onclick={() => uiState.settingsOpen = false}></div>
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
                            <div class="cai-settings-row cai-credits-row">
                                <span class="cai-settings-row-label">{t.settings.credits}</span>
                                <div class="cai-settings-credits-links">
                                    <a class="cai-settings-credits-text" href="https://www.caibergamo.it"
                                       rel="noopener noreferrer" target="_blank">CAI Bergamo</a>
                                    <a aria-label="GitHub" class="cai-settings-github-link"
                                       href="https://github.com/fgervasoni/bergamo-trails" rel="noopener noreferrer"
                                       target="_blank" title="GitHub">
                                        <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14"
                                             xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
                <button aria-label={t.panel.close} class="cai-toggle-btn cai-mobile-only"
                        onclick={() => uiState.panelOpen = false}>
                    <X size={16} strokeWidth={2}/>
                </button>
            </div>
        </div>

        <div class="cai-panel-body">

            {#if isAdmin()}
                <section class="cai-section">
                    <AdminPanel/>
                </section>
            {/if}

            <section class="cai-section cai-section-add-desktop">
                <AddFeature/>
            </section>

            {#if authState.user && !isAdmin()}
                <section class="cai-section">
                    <MyRequests/>
                </section>
            {/if}

            <section class="cai-section">
                <Legend/>
            </section>

            <section class="cai-section">
                <span class="cai-section-label">{t.section.basemap}</span>
                <BasemapSwitcher/>
            </section>
        </div>

        <div class="cai-panel-footer">
            <div class="cai-panel-footer-right">
                {#if authState.user}
                    <div class="cai-auth-logged">
                        <span class="cai-auth-email"
                              title={authState.user.email}>{authState.user.email}</span>
                        {#if isAdmin() && orsQuotaState.remaining != null}
                            <span class="cai-auth-quota" title={t.settings.apiQuota}>
                                {orsQuotaState.remaining}/{orsQuotaState.limit ?? '?'}
                            </span>
                        {/if}
                        <button class="cai-auth-logout-btn" onclick={handleLogout}
                                aria-label={t.auth.logout} title={t.auth.logout}>
                            <LogOut size={14} strokeWidth={2}/>
                        </button>
                    </div>
                {:else}
                    <form class="cai-auth-form-inline"
                          onsubmit={authMode === 'login' ? handleLogin : handleRegister}>
                        <input
                                class="cai-auth-input"
                                type="email"
                                placeholder={t.auth.email}
                                bind:value={authEmail}
                                disabled={authLoading}
                                required
                                autocomplete="email"
                        />
                        <input
                                class="cai-auth-input"
                                type="password"
                                placeholder={t.auth.password}
                                bind:value={authPassword}
                                disabled={authLoading}
                                required
                                autocomplete={authMode === 'login' ? 'current-password' : 'new-password'}
                                minlength={authMode === 'register' ? 6 : undefined}
                        />
                        {#if authMode === 'register'}
                            <input
                                    class="cai-auth-input"
                                    type="password"
                                    placeholder={t.auth.confirmPassword}
                                    bind:value={authPasswordConfirm}
                                    disabled={authLoading}
                                    required
                                    autocomplete="new-password"
                            />
                        {/if}
                        {#if authError}
                            <span class="cai-auth-error">{authError}</span>
                        {/if}
                        {#if authSuccess}
                            <span class="cai-auth-success">{authSuccess}</span>
                        {/if}
                        <div class="cai-auth-form-actions">
                            <button class="cai-auth-login-btn" type="submit" disabled={authLoading}>
                                {#if authLoading}
                                    <Loader size={14} strokeWidth={2} class="cai-spinning"/>
                                {:else}
                                    <LogIn size={14} strokeWidth={2}/>
                                {/if}
                                {#if authMode === 'login'}
                                    {authLoading ? t.auth.loggingIn : t.auth.login}
                                {:else}
                                    {authLoading ? t.auth.registering : t.auth.register}
                                {/if}
                            </button>
                            <button type="button" class="cai-auth-switch" onclick={switchAuthMode}>
                                {authMode === 'login' ? t.auth.switchToRegister : t.auth.switchToLogin}
                            </button>
                        </div>
                        <span class="cai-auth-disclaimer">{t.auth.emailDisclaimer}</span>
                    </form>
                {/if}
            </div>
        </div>
    </aside>

    {#if !uiState.panelOpen}
        <button class="cai-open-pill" onclick={() => { uiState.panelOpen = true; uiState.mobileAddOpen = false; }}
                aria-label={t.panel.open}>
            <img src="/images/icons/icon-48x48.png" alt="" class="cai-open-pill-logo"/>
            <span>{t.panel.brand}</span>
        </button>
    {/if}

    <!-- AddFeature mobile: FAB + dropdown -->
    {#if authState.user}
        <div class="cai-add-mobile">
            <button class="cai-add-fab" class:active={uiState.mobileAddOpen} onclick={toggleMobileAdd}
                    aria-label={t.addFeature.title}>
                {#if uiState.mobileAddOpen}
                    <X size={18} strokeWidth={2.5}/>
                {:else}
                    <MapPinPlus size={18} strokeWidth={2}/>
                {/if}
                <span>{t.addFeature.title}</span>
            </button>
            {#if uiState.mobileAddOpen}
                <div class="cai-add-mobile-dropdown">
                    <AddFeature/>
                </div>
            {/if}
        </div>
    {/if}

    <Navigate bind:locateButtonRef={locateButtonRef}/>

    <CustomPopup/>

    {#if showGyroPrompt}
        <div class="cai-gyro-overlay">
            <div class="cai-gyro-modal">
                <h3>{t.gyro.title}</h3>
                <p>{t.gyro.message}</p>
                <div class="cai-gyro-actions">
                    <button class="cai-gyro-btn decline" onclick={declineGyro}>{t.gyro.decline}</button>
                    <button class="cai-gyro-btn accept" onclick={acceptGyro}>{t.gyro.accept}</button>
                </div>
            </div>
        </div>
    {/if}
</div>

