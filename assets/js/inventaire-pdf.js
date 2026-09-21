// assets/js/inventaire-pdf.js
(function () {
    'use strict';

    function fillPdfTemplate(article, categorie, sousCategorie) {
        document.getElementById('pdf-id-article').textContent = article.id_article || '';
        document.getElementById('pdf-categorie').textContent = categorie || '';
        document.getElementById('pdf-sous-categorie').textContent = sousCategorie || '';
        document.getElementById('pdf-designation').textContent = article.designation_modele || '';
        document.getElementById('pdf-serial').textContent = article.numero_serie || '';
        document.getElementById('pdf-quantity').textContent = (article.quantite ?? '') + ' ' + (article.unite || '');
        document.getElementById('pdf-status').textContent = article.statut || '';
        document.getElementById('pdf-location').textContent = article.emplacement || '';
        document.getElementById('pdf-threshold').textContent = article.seuil_alerte ?? '';
        document.getElementById('pdf-observations').textContent = article.observations || '';
    }

    async function exportInventoryPdf(articleId) {
        if (!articleId) {
            alert('Aucun article à exporter.');
            return;
        }

        // Charger les données de l’article
        const { data: article, error } = await window.bacaSupabase
            .from('inventaire')
            .select(`
        *,
        categorie:categories(categorie, sous_categorie)
      `)
            .eq('id', articleId)
            .single();

        if (error || !article) {
            alert('Impossible de charger l’article.');
            return;
        }

        const categorie = article.categorie?.categorie || '';
        const sousCategorie = article.categorie?.sous_categorie || '';

        fillPdfTemplate(article, categorie, sousCategorie);

        const element = document.getElementById('inventoryPdfTemplate');
        element.style.display = 'block';

        const opt = {
            margin: 10,
            filename: `fiche_${article.id_article}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
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

    window.BACA_INVENTORY_PDF = {
        exportInventoryPdf
    };
})();