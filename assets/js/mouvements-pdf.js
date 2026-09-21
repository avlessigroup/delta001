// assets/js/mouvements-pdf.js
(function () {
    'use strict';

    function formatDate(d) {
        if (!d) return '';
        return new Date(d).toLocaleString();
    }

    async function exportMouvementsPdf(filters = {}) {
        // Construire la requête selon les filtres (mêmes principes que dans mouvements.js)
        let query = window.bacaSupabase
            .from('mouvements')
            .select(`
        *,
        article:article_id(
          id_article,
          designation_modele,
          categorie:categories(categorie, sous_categorie)
        ),
        responsable:responsable_id(nom_prenom, grade, matricule)
      `)
            .order('date', { ascending: false });

        if (filters.dateStart) {
            query = query.gte('date', new Date(filters.dateStart).toISOString());
        }
        if (filters.dateEnd) {
            const end = new Date(filters.dateEnd);
            end.setHours(23, 59, 59, 999);
            query = query.lte('date', end.toISOString());
        }

        const { data, error } = await query;
        if (error || !data) {
            alert('Impossible de charger les mouvements.');
            return;
        }

        const movements = data;

        // Remplir le modèle
        const periodeText =
            (filters.dateStart ? new Date(filters.dateStart).toLocaleDateString() : 'début') +
            ' – ' +
            (filters.dateEnd ? new Date(filters.dateEnd).toLocaleDateString() : 'fin');

        document.getElementById('pdf-mvt-periode').textContent = periodeText;
        document.getElementById('pdf-mvt-count').textContent = movements.length;

        const tbody = document.getElementById('pdf-mvt-body');
        tbody.innerHTML = '';

        movements.forEach(m => {
            const tr = document.createElement('tr');
            const art = m.article;
            const articleLabel = art
                ? `${art.designation_modele || ''} (${art.categorie?.categorie || ''} ${art.categorie?.sous_categorie ? '/ ' + art.categorie.sous_categorie : ''})`
                : '';

            const resp = m.responsable;
            const respLabel = resp
                ? `${resp.grade || ''} ${resp.nom_prenom || ''} (${resp.matricule || ''})`
                : '';

            tr.innerHTML = `
        <td style="border:1px solid #000;padding:4px;">${formatDate(m.date)}</td>
        <td style="border:1px solid #000;padding:4px;">${m.type || ''}</td>
        <td style="border:1px solid #000;padding:4px;">${articleLabel}</td>
        <td style="border:1px solid #000;padding:4px;">${m.quantite_ou_serie || ''}</td>
        <td style="border:1px solid #000;padding:4px;">${respLabel}</td>
        <td style="border:1px solid #000;padding:4px;">${m.motif_mission || ''}</td>
      `;
            tbody.appendChild(tr);
        });

        const element = document.getElementById('mouvementsPdfTemplate');
        element.style.display = 'block';

        const opt = {
            margin: 10,
            filename: `rapport_mouvements_${Date.now()}.pdf`,
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

    window.BACA_MOUVEMENTS_PDF = {
        exportMouvementsPdf
    };
})();