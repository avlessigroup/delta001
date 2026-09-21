(function () {
    'use strict';

    let profile = null;
    let currentPage = 1;
    const pageSize = 50;

    const $ = id => document.querySelector(id);

    function message(text, type = 'info') {
        const e = $('#boiteNoireMessage');
        if (!e) return;
        e.className = `alert alert-${type}`;
        e.textContent = text;
    }

    function formatDate(d) {
        if (!d) return '';
        const date = new Date(d);
        return date.toLocaleString();
    }

    function buildQuery() {
        let query = window.bacaSupabase
            .from('boite_noire')
            .select(`
        *,
        utilisateur:utilisateur_id(
          id,
          matricule,
          nom_prenom,
          grade,
          role
        )
      `, { count: 'exact' });

        // Filtres
        const dateStart = $('#bn-date-start').value;
        const dateEnd = $('#bn-date-end').value;
        const moduleFilter = $('#bn-module').value;
        const actionFilter = $('#bn-action').value;
        const resultatFilter = $('#bn-resultat').value;
        const userFilter = $('#bn-user').value.trim();

        if (dateStart) {
            query = query.gte('horodatage', new Date(dateStart).toISOString());
        }
        if (dateEnd) {
            // On inclut toute la journée de fin
            const end = new Date(dateEnd);
            end.setHours(23, 59, 59, 999);
            query = query.lte('horodatage', end.toISOString());
        }
        if (moduleFilter) {
            query = query.eq('module', moduleFilter);
        }
        if (actionFilter) {
            query = query.eq('action', actionFilter);
        }
        if (resultatFilter) {
            query = query.eq('resultado', resultatFilter);
        }

        // Filtre utilisateur (texte libre)
        if (userFilter) {
            // On filtre côté client car pas de jointure texte facile
            // On pourrait aussi appeler une fonction SQL dédiée
        }

        // Tri par date décroissante
        query = query.order('horodatage', { ascending: false });

        // Pagination
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        return query;
    }

    async function loadBoiteNoire() {
        message('', 'info');

        const query = buildQuery();
        const { data, error, count } = await query;

        if (error) {
            console.error(error);
            message('Erreur de chargement du journal.', 'danger');
            return;
        }

        const tbody = document.querySelector('#boiteNoireTableBody');
        tbody.innerHTML = '';

        const userFilter = $('#bn-user').value.trim().toLowerCase();

        let lignes = data || [];

        // Filtre utilisateur côté client
        if (userFilter) {
            lignes = lignes.filter(entry => {
                const u = entry.utilisateur;
                if (!u) return false;
                const text = [
                    u.matricule,
                    u.nom_prenom,
                    u.grade,
                    u.role
                ].filter(Boolean).join(' ').toLowerCase();
                return text.includes(userFilter);
            });
        }

        if (!lignes.length) {
            tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted">
            Aucune entrée trouvée.
          </td>
        </tr>
      `;
            $('#bnResultCount').textContent = '0 entrée';
            return;
        }

        lignes.forEach(entry => {
            const tr = document.createElement('tr');

            const u = entry.utilisateur;
            const userLabel = u
                ? `${u.grade || ''} ${u.nom_prenom || ''} (${u.matricule || ''})`.trim()
                : 'Inconnu';

            const cibleLabel = entry.cible_table
                ? `${entry.cible_table}${entry.cible_id ? ' • ' + entry.cible_id : ''}`
                : '';

            const detailsParts = [];
            if (entry.valeur_avant) {
                detailsParts.push('Avant: ' + JSON.stringify(entry.valeur_avant));
            }
            if (entry.valeur_apres) {
                detailsParts.push('Après: ' + JSON.stringify(entry.valeur_apres));
            }
            const details = detailsParts.join(' | ');

            tr.innerHTML = `
        <td>${formatDate(entry.horodatage)}</td>
        <td>${userLabel}</td>
        <td>${entry.role || ''}</td>
        <td>${entry.module || ''}</td>
        <td>${entry.action || ''}</td>
        <td>${cibleLabel}</td>
        <td>${entry.resultado || ''}</td>
        <td>
          <button
            class="btn btn-sm btn-outline-secondary"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#bn-detail-${entry.id}"
          >
            Voir détails
          </button>
          <div class="collapse mt-2" id="bn-detail-${entry.id}">
            <pre class="bg-light p-2 rounded small mb-0" style="max-height:200px;overflow:auto;">${escapeHtml(details)}</pre>
          </div>
        </td>
      `;

            tbody.appendChild(tr);
        });

        $('#bnResultCount').textContent = `${count || lignes.length} entrées`;

        renderPagination(count || lignes.length);
    }

    function escapeHtml(str) {
        return String(str)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function renderPagination(total) {
        const totalPages = Math.ceil(total / pageSize);
        const nav = document.querySelector('#boiteNoirePagination');
        nav.innerHTML = '';

        if (totalPages <= 1) {
            return;
        }

        const createLi = (label, page, disabled = false, active = false) => {
            const li = document.createElement('li');
            li.className = `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.textContent = label;
            a.addEventListener('click', e => {
                e.preventDefault();
                if (disabled) return;
                currentPage = page;
                loadBoiteNoire();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            li.appendChild(a);
            return li;
        };

        // Précédent
        nav.appendChild(createLi('« Préc.', Math.max(1, currentPage - 1), currentPage === 1));

        // Pages (simplifié : on affiche quelques pages autour de la page courante)
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, currentPage + 2);

        if (start > 1) {
            nav.appendChild(createLi('1', 1));
            if (start > 2) {
                const li = document.createElement('li');
                li.className = 'page-item disabled';
                li.innerHTML = '<span class="page-link">…</span>';
                nav.appendChild(li);
            }
        }

        for (let p = start; p <= end; p++) {
            nav.appendChild(createLi(String(p), p, false, p === currentPage));
        }

        if (end < totalPages) {
            if (end < totalPages - 1) {
                const li = document.createElement('li');
                li.className = 'page-item disabled';
                li.innerHTML = '<span class="page-link">…</span>';
                nav.appendChild(li);
            }
            nav.appendChild(createLi(String(totalPages), totalPages));
        }

        // Suivant
        nav.appendChild(createLi('Suiv. »', Math.min(totalPages, currentPage + 1), currentPage === totalPages));
    }

    function resetFilters() {
        $('#bn-date-start').value = '';
        $('#bn-date-end').value = '';
        $('#bn-module').value = '';
        $('#bn-action').value = '';
        $('#bn-resultat').value = '';
        $('#bn-user').value = '';
        currentPage = 1;
        loadBoiteNoire();
    }

    function events() {


        $('#resetBnFilters').addEventListener('click', resetFilters);

        // Rechargement automatique quand on change un filtre date/module/action/résultat
        ['bn-date-start', 'bn-date-end', 'bn-module', 'bn-action', 'bn-resultat'].forEach(id => {
            $(`#${id}`).addEventListener('change', () => {
                currentPage = 1;
                loadBoiteNoire();
            });
        });

        // Recherche utilisateur : on attend que l'utilisateur tape "Entrée"
        $('#bn-user').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                currentPage = 1;
                loadBoiteNoire();
            }
        });
    }


    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatAuditDate(value) {
        if (!value) {
            return "-";
        }

        return new Date(value).toLocaleString("fr-FR");
    }



    function getAuditFilterDescription() {
        const period =
            document.querySelector("#auditPeriod")?.value || "Toutes";

        const user =
            document.querySelector("#auditUser")?.value || "Tous";

        const module =
            document.querySelector("#auditModule")?.value || "Tous";

        const action =
            document.querySelector("#auditAction")?.value || "Toutes";

        const result =
            document.querySelector("#auditResult")?.value || "Tous";

        return {
            period,
            user,
            module,
            action,
            result
        };
    }


    /*   function exportAuditLogToPdf() {
           try {
               if (
                   !window.jspdf ||
                   !window.jspdf.jsPDF
               ) {
                   throw new Error(
                       "La bibliothèque jsPDF n'est pas chargée."
                   );
               }
   
               if (
                   !Array.isArray(auditRows) ||
                   auditRows.length === 0
               ) {
                   showAuditMessage(
                       "Aucune entrée de Boîte Noire à exporter.",
                       "warning"
                   );
   
                   return;
               }
   
               const { jsPDF } = window.jspdf;
   
               const doc = new jsPDF({
                   orientation: "landscape",
                   unit: "mm",
                   format: "a4"
               });
               <button id="exportBoiteNoirePdfButton" type="button" class="btn btn-outline-success">
                   Exporter en PDF
               </button>
               const generatedAt =
                   new Date().toLocaleString("fr-FR");
   
               const profileName =
                   currentProfile?.nom_prenom ||
                   "Utilisateur non identifié";
   
               doc.setFontSize(16);
               doc.text(
                   "BACA-APP — Export de la Boîte Noire",
                   14,
                   15
               );
   
               doc.setFontSize(10);
               doc.text(
                   "Base Aérienne de Cana",
                   14,
                   22
               );
   
               doc.text(
                   `Généré le : ${generatedAt}`,
                   14,
                   28
               );
   
               doc.text(
                   `Demandeur : ${profileName}`,
                   14,
                   34
               );
   
               const filters =
                   getAuditFilterDescription();
   
               doc.text(
                   `Filtres : période=${filters.period}, ` +
                   `utilisateur=${filters.user}, ` +
                   `module=${filters.module}, ` +
                   `action=${filters.action}, ` +
                   `résultat=${filters.result}`,
                   14,
                   40
               );
   
               const rows = auditRows.map(function (entry) {
                   return [
                       formatAuditDate(entry.horodatage),
                       entry.utilisateurs?.nom_prenom ||
                       entry.utilisateur_id ||
                       "-",
                       entry.role || "-",
                       entry.module || "-",
                       entry.action || "-",
                       entry.cible_table || "-",
                       entry.cible_id || "-",
                       entry.resultado || entry.resultat || "-",
                       entry.appareil || "-"
                   ];
               });
   
               doc.autoTable({
                   startY: 47,
   
                   head: [[
                       "Horodatage",
                       "Utilisateur",
                       "Rôle",
                       "Module",
                       "Action",
                       "Table cible",
                       "ID cible",
                       "Résultat",
                       "Appareil"
                   ]],
   
                   body: rows,
   
                   theme: "grid",
   
                   styles: {
                       fontSize: 6.5,
                       cellPadding: 1.5,
                       overflow: "linebreak",
                       valign: "middle"
                   },
   
                   headStyles: {
                       fillColor: [7, 26, 51],
                       textColor: [255, 255, 255],
                       fontStyle: "bold",
                       fontSize: 7
                   },
   
                   alternateRowStyles: {
                       fillColor: [244, 246, 249]
                   },
   
                   columnStyles: {
                       0: { cellWidth: 27 },
                       1: { cellWidth: 28 },
                       2: { cellWidth: 22 },
                       3: { cellWidth: 22 },
                       4: { cellWidth: 28 },
                       5: { cellWidth: 25 },
                       6: { cellWidth: 25 },
                       7: { cellWidth: 18 },
                       8: { cellWidth: 35 }
                   },
   
                   margin: {
                       top: 47,
                       right: 8,
                       bottom: 15,
                       left: 8
                   },
   
                   didDrawPage: function (data) {
                       const pageNumber =
                           doc.internal.getNumberOfPages();
   
                       doc.setFontSize(8);
   
                       doc.text(
                           `Page ${pageNumber}`,
                           data.settings.margin.left,
                           doc.internal.pageSize.height - 8
                       );
   
                       doc.text(
                           "Document confidentiel — usage interne",
                           doc.internal.pageSize.width - 75,
                           doc.internal.pageSize.height - 8
                       );
                   }
               });
   
               const fileDate =
                   new Date()
                       .toISOString()
                       .slice(0, 10);
   
               doc.save(
                   `BACA-APP-boite-noire-${fileDate}.pdf`
               );
   
               showAuditMessage(
                   "Export PDF de la Boîte Noire généré.",
                   "success"
               );
   
           } catch (error) {
               console.error(
                   "Erreur export Boîte Noire :",
                   error
               );
   
               showAuditMessage(
                   error.message ||
                   "Impossible de générer l’export PDF.",
                   "danger"
               );
           }
       }
   
   
   
   */




    async function initialize(p) {
        profile = p;

        // Selon le rôle, on pourrait restreindre certains filtres ou l'accès
        // Mais la RLS gère déjà qui voit quoi.

        events();
        await loadBoiteNoire();
    }

    window.BACA_BOITE_NOIRE = { initialize };
})();


document.getElementById('exportBoiteNoirePdfButton')?.addEventListener('click', () => {
    const filters = {
        dateStart: document.getElementById('bn-date-start')?.value || '',
        dateEnd: document.getElementById('bn-date-end')?.value || '',
        module: document.getElementById('bn-module')?.value || '',
        action: document.getElementById('bn-action')?.value || '',
        resultat: document.getElementById('bn-resultat')?.value || ''
    };
    window.BACA_BOITE_NOIRE_PDF.exportBoiteNoirePdf(filters);
}); 