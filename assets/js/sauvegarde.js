// assets/js/sauvegarde.js
(function () {
    'use strict';

    let profile = null;
    const $ = id => document.querySelector(id);

    function message(text, type = 'info') {
        const e = $('#sauvegardeMessage');
        if (!e) return;
        e.className = `alert alert-${type}`;
        e.textContent = text;
    }

    function isAdminOrSuper() {
        return profile && ['administrateur', 'super_utilisateur'].includes(profile.role);
    }

    async function showReplicaStatus() {
        const replica = await window.BACA_JSONBIN.loadBoiteNoireReplica();
        $('#lastSyncLabel').textContent = replica.lastSync
            ? new Date(replica.lastSync).toLocaleString()
            : '–';
        $('#lastIdLabel').textContent = replica.lastId || 0;
    }

    async function syncBoiteNoire() {
        message('Synchronisation en cours...', 'info');

        try {
            // Récupérer toutes les entrées (ou par lots si très gros)
            const { data, error } = await window.bacaSupabase
                .from('boite_noire')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;

            const entries = data || [];
            const lastId = entries.length ? entries[entries.length - 1].id : 0;

            await window.BACA_JSONBIN.saveBoiteNoireReplica(entries, lastId);

            message('Réplication de la Boîte Noire effectuée avec succès.', 'success');
            await showReplicaStatus();
        } catch (err) {
            console.error(err);
            message('Échec de la synchronisation de la Boîte Noire.', 'danger');
        }
    }

    async function loadConfig() {
        try {
            const config = await window.BACA_JSONBIN.loadConfig();
            $('#configPreview').textContent = JSON.stringify(config, null, 2);
            message('Configuration chargée depuis JSONBin.', 'success');
        } catch (err) {
            console.error(err);
            message('Erreur de chargement de la configuration.', 'danger');
        }
    }

    async function saveConfig() {
        // Exemple : on sauvegarde une config “fictive” ; à adapter selon tes vrais paramètres
        const configCourante = {
            version: '1.0.0',
            lastUpdate: new Date().toISOString(),
            modifie_par: profile.email || profile.id,
            params: {
                exempleSeuilGlobal: 5,
                exempleNotificationActive: true
            }
        };

        try {
            await window.BACA_JSONBIN.saveConfig(configCourante);
            $('#configPreview').textContent = JSON.stringify(configCourante, null, 2);
            message('Configuration sauvegardée dans JSONBin.', 'success');
        } catch (err) {
            console.error(err);
            message('Erreur de sauvegarde de la configuration.', 'danger');
        }
    }

    function events() {
        $('#syncBoiteNoireButton').addEventListener('click', syncBoiteNoire);
        $('#loadConfigButton').addEventListener('click', loadConfig);
        $('#saveConfigButton').addEventListener('click', saveConfig);
    }

    async function initialize(p) {
        profile = p;

        if (!isAdminOrSuper()) {
            message('Accès réservé aux administrateurs et super-utilisateurs.', 'danger');
            return;
        }

        events();
        await showReplicaStatus();
    }

    window.BACA_SAUVEGARDE = { initialize };
})();