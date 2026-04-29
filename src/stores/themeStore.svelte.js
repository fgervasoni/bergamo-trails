const STORAGE_KEY = 'cai-theme';

export const themeState = $state({ mode: 'system' }); // 'light' | 'dark' | 'system'

/** Resolve effective theme from mode + system preference */
function resolvedTheme(mode) {
    if (mode === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode;
}

function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', resolvedTheme(mode));
}

export function setTheme(mode) {
    themeState.mode = mode;
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
}

export function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
        themeState.mode = saved;
    }
    applyTheme(themeState.mode);

    // Listen to OS preference changes for 'system' mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (themeState.mode === 'system') {
            applyTheme('system');
        }
    });
}

