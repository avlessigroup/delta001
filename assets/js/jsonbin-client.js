// assets/js/jsonbin-client.js
(function () {
    'use strict';

    const BASE_URL = 'https://api.jsonbin.io/v3';

    function getHeaders() {
        const config = window.BACA_JSONBIN_CONFIG;
        return {
            'Content-Type': 'application/json',
            'X-Master-Key': config.apiKey
        };
    }

    async function jsonbinRequest(method, binId, data = null) {
        const url = `${BASE_URL}/b/${binId}`;
        const opts = {
            method,
            headers: getHeaders()
        };

        if (data !== null) {
            opts.body = JSON.stringify(data);
        }

        const response = await fetch(url, opts);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`JSONBin error (${response.status}): ${text}`);
        }

        if (method === 'GET' || method === 'PUT') {
            const json = await response.json();
            // JSONBin retourne { record: {...}, metadata: {...} } pour GET/PUT
            return json;
        }

        return null;
    }

    // ---------- Configuration applicative ----------

    /**
     * Lit la configuration stockée dans le Bin de config.
     * Structure attendue : un objet JSON libre.
     */
    async function loadConfig() {
        const config = window.BACA_JSONBIN_CONFIG;
        try {
            const result = await jsonbinRequest('GET', config.binIdConfig);
            return result.record || {};
        } catch (err) {
            console.error('[JSONBin Config] Erreur lecture config:', err);
            return {};
        }
    }

    /**
     * Écrit la configuration complète (écrase l’existant).
     * @param {Object} configObject - Objet de configuration.
     */
    async function saveConfig(configObject) {
        const config = window.BACA_JSONBIN_CONFIG;
        return jsonbinRequest('PUT', config.binIdConfig, configObject);
    }

    // ---------- Réplication Boîte Noire ----------

    /**
     * Lit la dernière réplique complète de la Boîte Noire.
     * Structure suggérée :
     * {
     *   lastSync: "2026-09-15T...",
     *   lastId: 12345,
     *   entries: [ ... lignes de boite_noire ... ]
     * }
     */
    async function loadBoiteNoireReplica() {
        const config = window.BACA_JSONBIN_CONFIG;
        try {
            const result = await jsonbinRequest('GET', config.binIdBoiteNoire);
            return result.record || { lastSync: null, lastId: 0, entries: [] };
        } catch (err) {
            console.error('[JSONBin BoiteNoire] Erreur lecture réplique:', err);
            return { lastSync: null, lastId: 0, entries: [] };
        }
    }

    /**
     * Met à jour la réplique de la Boîte Noire.
     * Stratégie simple : on envoie un snapshot complet (ou partiel) depuis Supabase.
     * @param {Array} entries - Tableau d’entrées (lignes de boite_noire).
     * @param {number} lastId - Dernier id traité.
     */
    async function saveBoiteNoireReplica(entries, lastId) {
        const config = window.BACA_JSONBIN_CONFIG;

        const payload = {
            lastSync: new Date().toISOString(),
            lastId,
            entries
        };

        return jsonbinRequest('PUT', config.binIdBoiteNoire, payload);
    }

    /**
     * Ajoute un lot d’entrées à la réplique existante (mode “append”).
     * @param {Array} newEntries - Nouvelles entrées à ajouter.
     */
    async function appendBoiteNoireReplica(newEntries) {
        const current = await loadBoiteNoireReplica();
        const merged = current.entries.concat(newEntries);
        const lastId = merged.length ? merged[merged.length - 1].id : current.lastId;
        return saveBoiteNoireReplica(merged, lastId);
    }

    window.BACA_JSONBIN = {
        loadConfig,
        saveConfig,
        loadBoiteNoireReplica,
        saveBoiteNoireReplica,
        appendBoiteNoireReplica
    };
})();