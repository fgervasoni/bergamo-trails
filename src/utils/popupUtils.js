/**
 * Utility per costruire dinamicamente i dati del popup
 * basandosi sui model generati dallo schema SQL.
 */
import { getModel } from '../models/schema.js';

/**
 * Verifica se un campo deve essere escluso dal popup.
 */
function shouldSkip(key, model) {
    const lower = key.toLowerCase();
    // Sempre nascondere qualsiasi variante di objectid
    if (lower.includes('objectid')) return true;
    if (model) return model.hidden.has(key);
    // Fallback generico se non c'è model
    return ['id', 'fid', 'shape', 'geom', 'geometry', 'created_at', 'updated_at'].includes(lower);
}

/**
 * Formatta un valore per la visualizzazione nel popup.
 */
function formatValue(key, value, model) {
    if (value == null || value === '') return null;
    const def = model?.fields[key];
    if (def?.type === 'integer' || def?.type === 'bigint') {
        // Suffisso "m" per quota
        if (key === 'quota') return `${value} m`;
        return String(value);
    }
    // Lunghezza sentiero
    if (key === 'lunghezza_km' && value != null) {
        return `${value} km`;
    }
    return String(value);
}

/**
 * Converte un nome campo DB in una label leggibile (fallback se manca in i18n).
 */
function fieldToLabel(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/^\w/, c => c.toUpperCase());
}

/**
 * Costruisce titolo e campi per il popup partendo dagli attributi del feature.
 *
 * @param {object}  attrs      - graphic.attributes
 * @param {string}  layerTitle - graphic.layer.title ('Sentieri' | 'Rifugi')
 * @param {object}  t          - oggetto traduzioni corrente (getT())
 */
export function buildPopupData(attrs, layerTitle, t) {
    if (!attrs) return { title: t.popup.details, fields: [], editable: false, featureId: null, layerTitle: '' };

    const model = getModel(layerTitle);
    const fieldLabels = t.popup.fieldLabels || {};
    const titleField = model?.titleField;
    const editable = model?.editable ?? false;

    // Titolo dinamico
    let title;
    if (layerTitle === 'Sentieri') {
        title = `${t.popup.trail} ${attrs[titleField] || ''}`.trim();
    } else if (layerTitle === 'Rifugi') {
        title = attrs[titleField] || t.popup.shelter || layerTitle;
    } else if (layerTitle === 'Vette') {
        title = attrs[titleField] || t.popup.peak || layerTitle;
    } else {
        title = t.popup.details;
    }

    const featureId = attrs.id ?? null;

    // Campi dinamici: usa il model per determinare ordine e visibilità.
    // Se c'è un model, mostra TUTTI i campi visibili (anche null) nell'ordine del model.
    // Se non c'è model, fallback su Object.entries.
    let fields;
    if (model) {
        fields = Object.keys(model.fields)
            .filter(key => !shouldSkip(key, model) && key !== titleField)
            .map(key => ({
                key,
                label: fieldLabels[key] || fieldToLabel(key),
                value: formatValue(key, attrs[key], model)
            }));

        // Aggiungi lunghezza calcolata per sentieri (campo non nello schema ma nel GeoJSON)
        if (layerTitle === 'Sentieri' && attrs.lunghezza_km != null) {
            fields.push({
                key: 'lunghezza_km',
                label: fieldLabels['lunghezza_km'] || 'Lunghezza',
                value: formatValue('lunghezza_km', attrs.lunghezza_km, model)
            });
        }
    } else {
        fields = Object.entries(attrs)
            .filter(([key]) => !shouldSkip(key, model) && key !== titleField)
            .map(([key, value]) => ({
                key,
                label: fieldLabels[key] || fieldToLabel(key),
                value: formatValue(key, value, model)
            }));
    }

    return { title, fields, editable, featureId, layerTitle };
}
