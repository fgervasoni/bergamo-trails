/**
 * Model e metadata generati dallo schema SQL delle tabelle Supabase.
 * Fonte: public.rifugi, public.sentieri
 *
 * Ogni model definisce:
 *  - fields:     campo → { type, nullable, editable }
 *  - titleField: campo usato come titolo nel popup
 *  - editable:   se il layer è modificabile dal popup
 *  - hidden:     campi da non mostrare mai nel popup
 */

/** Tipi supportati per la serializzazione/deserializzazione */
export const FieldType = {
    TEXT: 'text',
    INTEGER: 'integer',
    BIGINT: 'bigint',
    GEOMETRY: 'geometry',
    TIMESTAMPTZ: 'timestamptz'
};

/**
 * @typedef {Object} FieldDef
 * @property {string} type       - Tipo del campo (da FieldType)
 * @property {boolean} nullable  - Se il campo accetta null
 * @property {boolean} editable  - Se il campo è modificabile dall'utente
 */

/** @type {Record<string, FieldDef>} */
const rifugiFields = {
    id:          { type: FieldType.BIGINT,      nullable: false, editable: false },
    nome:        { type: FieldType.TEXT,         nullable: false, editable: true  },
    proprieta:   { type: FieldType.TEXT,         nullable: true,  editable: true  },
    quota:       { type: FieldType.INTEGER,      nullable: true,  editable: true  },
    descrizione: { type: FieldType.TEXT,         nullable: true,  editable: true  },
    geom:        { type: FieldType.GEOMETRY,     nullable: false, editable: false },
    created_at:  { type: FieldType.TIMESTAMPTZ,  nullable: true,  editable: false },
    updated_at:  { type: FieldType.TIMESTAMPTZ,  nullable: true,  editable: false }
};

/** @type {Record<string, FieldDef>} */
const sentieriFields = {
    id:          { type: FieldType.BIGINT,      nullable: false, editable: false },
    numero_cai:  { type: FieldType.TEXT,         nullable: true,  editable: true  },
    difficolta:  { type: FieldType.TEXT,         nullable: true,  editable: true  },
    descrizione: { type: FieldType.TEXT,         nullable: true,  editable: true  },
    geom:        { type: FieldType.GEOMETRY,     nullable: false, editable: false },
    created_at:  { type: FieldType.TIMESTAMPTZ,  nullable: true,  editable: false },
    updated_at:  { type: FieldType.TIMESTAMPTZ,  nullable: true,  editable: false }
};

/** Valori ammessi per il campo difficolta (CHECK constraint) */
export const DIFFICOLTA_VALUES = ['T', 'E', 'EE', 'EEA'];

/** @type {Record<string, FieldDef>} */
const vetteFields = {
    id:          { type: FieldType.BIGINT,      nullable: false, editable: false },
    nome:        { type: FieldType.TEXT,         nullable: false, editable: true  },
    quota:       { type: FieldType.INTEGER,      nullable: true,  editable: true  },
    descrizione: { type: FieldType.TEXT,         nullable: true,  editable: true  },
    geom:        { type: FieldType.GEOMETRY,     nullable: false, editable: false },
    created_at:  { type: FieldType.TIMESTAMPTZ,  nullable: true,  editable: false },
    updated_at:  { type: FieldType.TIMESTAMPTZ,  nullable: true,  editable: false }
};

/**
 * @typedef {Object} TableModel
 * @property {Record<string, FieldDef>} fields
 * @property {string}   titleField  - Campo usato come titolo popup
 * @property {boolean}  editable    - Se il layer è editabile dal popup
 * @property {Set<string>} hidden   - Campi nascosti nel popup
 * @property {string}   tableName   - Nome tabella Supabase
 */

/** @type {Record<string, TableModel>} */
export const models = {
    Rifugi: {
        tableName: 'rifugi',
        fields: rifugiFields,
        titleField: 'nome',
        editable: true,
        hidden: new Set(['id', 'geom', 'created_at', 'updated_at'])
    },
    Sentieri: {
        tableName: 'sentieri',
        fields: sentieriFields,
        titleField: 'numero_cai',
        editable: false,
        hidden: new Set(['id', 'geom', 'created_at', 'updated_at'])
    },
    Vette: {
        tableName: 'vette',
        fields: vetteFields,
        titleField: 'nome',
        editable: true,
        hidden: new Set(['id', 'geom', 'created_at', 'updated_at'])
    }
};

/**
 * Restituisce il model per un dato layer title, o null.
 * @param {string} layerTitle
 * @returns {TableModel | null}
 */
export function getModel(layerTitle) {
    return models[layerTitle] ?? null;
}

/**
 * Converte un valore raw (stringa dal form) al tipo corretto per il DB.
 * @param {*} value       - Valore raw dall'input
 * @param {FieldDef} def  - Definizione del campo
 * @returns {*}           - Valore tipizzato
 */
export function castValue(value, def) {
    if (value === '' || value == null) {
        return def.nullable ? null : value;
    }
    switch (def.type) {
        case FieldType.INTEGER:
        case FieldType.BIGINT: {
            const num = parseInt(String(value), 10);
            return isNaN(num) ? null : num;
        }
        default:
            return String(value);
    }
}

/**
 * Restituisce l'input type HTML appropriato per un campo.
 * @param {FieldDef} def
 * @returns {string}
 */
export function inputTypeFor(def) {
    switch (def.type) {
        case FieldType.INTEGER:
        case FieldType.BIGINT:
            return 'number';
        default:
            return 'text';
    }
}


