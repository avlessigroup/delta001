// assets/js/boite-noire-pdf.js
(function () {
    'use strict';

    function formatDate(d) {
        if (!d) return '';
        return new Date(d).toLocaleString();
    }

    async function exportBoiteNoirePdf(filters = {}) {
        // Recharger les données avec les mêmes filtres que dans boite-noire.js
        let query = window.bacaSupabase
            .from('boite_noire')
            .select(`
        *,
        utilisateur:utilisateur_id(
          matricule,
          nom_prenom,
          grade,
          role
        )
      `)
            .order('horodatage', { ascending: false });

        if (filters.dateStart) {
            query = query.gte('horodatage', new Date(filters.dateStart).toISOString());
        }
        if (filters.dateEnd) {
            const end = new Date(filters.dateEnd);
            end.setHours(23, 59, 59, 999);
            query = query.lte('horodatage', end.toISOString());
        }
        if (filters.module) {
            query = query.eq('module', filters.module);
        }
        if (filters.action) {
            query = query.eq('action', filters.action);
        }
        if (filters.resultat) {
            query = query.eq('resultado', filters.resultat);
        }

        const { data, error } = await query;
        if (error || !data) {
            alert('Impossible de charger le journal.');
            return;
        }

        const entries = data;

        const filtreText = [
            filters.dateStart ? `du ${new Date(filters.dateStart).toLocaleDateString()}` : '',
            filters.dateEnd ? `au ${new Date(filters.dateEnd).toLocaleDateString()}` : '',
            filters.module ? `module: ${filters.module}` : '',
            filters.action ? `action: ${filters.action}` : '',
            filters.resultat ? `résultat: ${filters.resultat}` : ''
        ].filter(Boolean).join(', ') || 'Aucun filtre';

        document.getElementById('pdf-bn-filtres').textContent = filtreText;
        document.getElementById('pdf-bn-count').textContent = entries.length;

        const tbody = document.getElementById('pdf-bn-body');
        tbody.innerHTML = '';

        entries.forEach(e => {
            const tr = document.createElement('tr');
            const u = e.utilisateur;
            const userLabel = u
                ? `${u.grade || ''} ${u.nom_prenom || ''} (${u.matricule || ''})`
                : 'Inconnu';

            const cibleLabel = e.cible_table
                ? `${e.cible_table}${e.cible_id ? ' • ' + e.cible_id : ''}`
                : '';

            tr.innerHTML = `
        <td style="border:1px solid #000;padding:3px;">${formatDate(e.horodatage)}</td>
        <td style="border:1px solid #000;padding:3px;">${userLabel}</td>
        <td style="border:1px solid #000;padding:3px;">${e.role || ''}</td>
        <td style="border:1px solid #000;padding:3px;">${e.module || ''}</td>
        <td style="border:1px solid #000;padding:3px;">${e.action || ''}</td>
        <td style="border:1px solid #000;padding:3px;">${cibleLabel}</td>
        <td style="border:1px solid #000;padding:3px;">${e.resultado || ''}</td>
      `;
            tbody.appendChild(tr);
        });

        const element = document.getElementById('boiteNoirePdfTemplate');
        element.style.display = 'block';

        const opt = {
            margin: 10,
            filename: `boite_noire_${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        try {
            await window.html2pdf().set(opt).from(element).save();
        } catch (err) {
            console.error(err);
            alert('Erreur lors de la génération du PDF.');
        } finally {
            element.style.display = 'none';
        }
    }

    window.BACA_BOITE_NOIRE_PDF = {
        exportBoiteNoirePdf
    };
})();