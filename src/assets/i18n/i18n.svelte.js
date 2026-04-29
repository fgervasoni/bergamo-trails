import it from './it.json';
import en from './en.json';

const translations = { it, en };

function detectLocale() {
    const saved = localStorage.getItem('cai-locale');
    if (saved && translations[saved]) return saved;
    const browser = navigator.language?.slice(0, 2).toLowerCase();
    return translations[browser] ? browser : 'it';
}

export const i18n = $state({ locale: detectLocale() });

export function getT() {
    return translations[i18n.locale] || translations.it;
}

export function setLocale(lang) {
    if (translations[lang]) {
        i18n.locale = lang;
        localStorage.setItem('cai-locale', lang);
    }
}

export const availableLocales = [
    { code: 'it', label: 'Italiano' },
    { code: 'en', label: 'English' }
];
