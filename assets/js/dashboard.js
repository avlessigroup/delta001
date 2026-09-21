(function () {
    "use strict";

    let dashboardChannel = null;

    function setValue(id, value) {
        const element = document.querySelector(`#${id}`);
        if (element) {
            element.textContent = value;
        }
    }

    function showError(message) {
        const element = document.querySelector("#dashboardMessage");
        if (!element) {
            return;
        }
        element.className = "alert alert-danger";
        element.textContent = message;
    }

    function showLoading() {
        const element = document.querySelector("#dashboardMessage");
        if (!element) {
            return;
        }
        element.className = "alert alert-info";
        element.textContent = "Chargement des données...";
    }

    async function countInventory(filters = {}) {
        let query = window.bacaSupabase
            .from("inventaire")
            .select("*", {
                count: "exact",
                head: true
            });

        if (filters.statut) {
            query = query.eq("statut", filters.statut);
        }

        const { count, error } = await query;
        if (error) {
            throw error;
        }
        return count || 0;
    }

    async function countMovements() {
        const { count, error } =
            await window.bacaSupabase
                .from("mouvements")
                .select("*", {
                    count: "exact",
                    head: true
                });

        if (error) {
            throw error;
        }
        return count || 0;
    }

    async function countBelowThreshold() {
        const { count, error } =
            await window.bacaSupabase
                .from("inventaire_alertes")
                .select("*", {
                    count: "exact",
                    head: true
                })
                .eq("sous_seuil", true);

        if (error) {
            throw error;
        }
        return count || 0;
    }

    async function loadRecentMovements() {
        const { data, error } =
            await window.bacaSupabase
                .from("mouvements")
                .select(`
                    id_mouvement,
                    date,
                    type,
                    quantite_ou_serie,
                    motif_mission,
                    destination_provenance,
                    inventaire (
                        id_article,
                        designation_modele
                    ),
                    utilisateurs (
                        nom_prenom,
                        grade
                    )
                `)
                .order("date", {
                    ascending: false
                })
                .limit(10);

        if (error) {
            throw error;
        }
        return data || [];
    }

    function formatDate(value) {
        if (!value) {
            return "-";
        }
        return new Date(value).toLocaleString("fr-FR");
    }

    async function loadCriticalArticles() {
        const { data, error } =
            await window.bacaSupabase
                .from("inventaire_alertes")
                .select(`
                    id_article,
                    designation_modele,
                    quantite,
                    unite,
                    seuil_alerte,
                    statut,
                    emplacement
                `)
                .eq("sous_seuil", true)
                .order("id_article");

        if (error) {
            throw error;
        }
        return data || [];
    }

    function getMovementBadge(type) {
        const badges = {
            entree: "success",
            sortie: "danger",
            retour: "primary"
        };

        const labels = {
            entree: "Entrée",
            sortie: "Sortie",
            retour: "Retour"
        };

        const color = badges[type] || "secondary";
        const label = labels[type] || type;

        return `
            <span class="badge text-bg-${color}">
                ${label}
            </span>
        `;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function renderRecentMovements(movements) {
        const body = document.querySelector("#recentMovementsBody");
        if (!body) {
            return;
        }

        if (!movements.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted">
                        Aucun mouvement enregistré.
                    </td>
                </tr>
            `;
            return;
        }

        body.innerHTML = movements.map(function (movement) {
            const article = movement.inventaire;
            const responsable = movement.utilisateurs;

            return `
                <tr>
                    <td>${escapeHtml(formatDate(movement.date))}</td>
                    <td>${getMovementBadge(movement.type)}</td>
                    <td>
                        ${escapeHtml(
                article?.id_article || "-"
            )}
                    </td>
                    <td>
                        ${escapeHtml(
                article?.designation_modele || "-"
            )}
                    </td>
                    <td>
                        ${escapeHtml(
                responsable?.nom_prenom || "-"
            )}
                    </td>
                </tr>
            `;
        }).join("");
    }

    function renderCriticalArticles(articles) {
        const container =
            document.querySelector("#dashboardAlertSummary");

        if (!container) {
            return;
        }

        if (!articles.length) {
            container.innerHTML = `
                <div class="alert alert-success">
                    Aucun article sous seuil.
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="alert alert-danger">
                <h2 class="h6">
                    Articles nécessitant une attention
                </h2>

                <ul class="mb-0">
                    ${articles.map(function (article) {
            return `
                            <li>
                                <strong>
                                    ${escapeHtml(article.id_article)}
                                </strong>
                                —
                                ${escapeHtml(article.designation_modele)}
                                :
                                ${escapeHtml(article.quantite)}
                                ${escapeHtml(article.unite || "")}
                                /
                                seuil
                                ${escapeHtml(article.seuil_alerte)}
                                —
                                ${escapeHtml(article.emplacement)}
                            </li>
                        `;
        }).join("")}
                </ul>
            </div>
        `;
    }

    async function loadDashboard() {
        if (!window.bacaSupabase) {
            showError("Client Supabase indisponible.");
            return;
        }

        showLoading();

        try {
            const [
                total,
                disponibles,
                mission,
                maintenance,
                reformes,
                sousSeuil,
                mouvements,
                recentMovements,
                criticalArticles
            ] = await Promise.all([
                countInventory(),
                countInventory({
                    statut: "disponible"
                }),
                countInventory({
                    statut: "en_mission"
                }),
                countInventory({
                    statut: "en_maintenance"
                }),
                countInventory({
                    statut: "hors_service_reforme"
                }),
                countBelowThreshold(),
                countMovements(),
                loadRecentMovements(),
                loadCriticalArticles()
            ]);

            setValue("totalArticles", total);
            setValue("availableArticles", disponibles);
            setValue("missionArticles", mission);
            setValue("maintenanceArticles", maintenance);
            setValue("reformedArticles", reformes);
            setValue("belowThreshold", sousSeuil);
            setValue("totalMovements", mouvements);

            renderRecentMovements(recentMovements);
            renderCriticalArticles(criticalArticles);

            const message = document.querySelector("#dashboardMessage");

            if (message) {
                message.className = "alert alert-success";
                message.textContent =
                    "Tableau de bord actualisé.";
            }
        } catch (error) {
            console.error(
                "Erreur de chargement du tableau de bord :",
                error
            );

            showError(
                "Impossible de charger les données du tableau de bord."
            );
        }
    }

    function subscribeToChanges() {
        if (!window.bacaSupabase) {
            return;
        }

        dashboardChannel =
            window.bacaSupabase
                .channel("baca-dashboard")
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "inventaire"
                    },
                    function () {
                        loadDashboard();
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "mouvements"
                    },
                    function () {
                        loadDashboard();
                    }
                )
                .subscribe(function (status) {
                    console.log(
                        "Statut Realtime dashboard :",
                        status
                    );
                });
    }

    function initializeDashboard() {
        const refreshButton =
            document.querySelector("#refreshDashboard");

        if (refreshButton) {
            refreshButton.addEventListener(
                "click",
                loadDashboard
            );
        }

        loadDashboard();
        subscribeToChanges();
    }

    window.BACA_DASHBOARD = {
        load: loadDashboard,
        initialize: initializeDashboard
    };
})();