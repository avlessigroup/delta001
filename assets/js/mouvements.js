(function () {
    "use strict";

    let currentProfile = null;
    let movements = [];
    let articles = [];
    let movementModal = null;

    function showMessage(message, type = "info") {
        const element = document.querySelector("#movementMessage");
        if (!element) return;
        element.className = message ? `alert alert-${type}` : "";
        element.textContent = message || "";
    }

    function clearMessage() {
        showMessage("");
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatDate(value) {
        return value ? new Date(value).toLocaleString("fr-FR") : "-";
    }

    function formatQuantity(value, unit = "") {
        if (value === null || value === undefined || value === "") {
            return "Non renseignée";
        }
        const formatted = Number(value).toLocaleString("fr-FR", {
            maximumFractionDigits: 3
        });
        return `${formatted}${unit ? ` ${unit}` : ""}`;
    }

    function formatOptional(value) {
        return value === null || value === undefined || String(value).trim() === ""
            ? "Non renseigné"
            : String(value);
    }

    function getTypeLabel(type) {
        return { entree: "Entrée", sortie: "Sortie", retour: "Retour" }[type] || type || "-";
    }

    function getTypeColor(type) {
        return { entree: "success", sortie: "danger", retour: "primary" }[type] || "secondary";
    }

    function renderType(type) {
        return `<span class="badge text-bg-${getTypeColor(type)}">${escapeHtml(getTypeLabel(type))}</span>`;
    }

    function getStatusLabel(status) {
        return {
            disponible: "Disponible",
            en_mission: "En mission",
            en_maintenance: "En maintenance",
            hors_service_reforme: "Hors service / réformé"
        }[status] || status || "-";
    }

    function getDateLimit(filter) {
        const now = new Date();
        if (filter === "today") {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            return start;
        }
        if (filter === "week") {
            const start = new Date(now);
            start.setDate(start.getDate() - 7);
            return start;
        }
        if (filter === "month") {
            const start = new Date(now);
            start.setDate(start.getDate() - 30);
            return start;
        }
        return null;
    }

    function filterMovements() {
        const search = document.querySelector("#movementSearch")?.value.trim().toLowerCase() || "";
        const type = document.querySelector("#movementTypeFilter")?.value || "";
        const dateFilter = document.querySelector("#movementDateFilter")?.value || "";
        const dateLimit = getDateLimit(dateFilter);

        return movements.filter((movement) => {
            const article = movement.inventaire || {};
            const user = movement.utilisateurs || {};
            const searchableText = [
                article.id_article,
                article.designation_modele,
                user.nom_prenom,
                movement.motif_mission,
                movement.destination_provenance,
                movement.observations,
                movement.quantite,
                movement.numero_serie,
                movement.quantite_ou_serie
            ].filter(Boolean).join(" ").toLowerCase();

            const matchesSearch = !search || searchableText.includes(search);
            const matchesType = !type || movement.type === type;
            const movementDate = new Date(movement.date);
            const matchesDate = !dateLimit || movementDate >= dateLimit;

            return matchesSearch && matchesType && matchesDate;
        });
    }

    function updateResultCount(count) {
        const element = document.querySelector("#movementResultCount");
        if (!element) return;
        element.textContent = `${count} mouvement${count > 1 ? "s" : ""}`;
    }

    function renderTable() {
        const body = document.querySelector("#movementsTableBody");
        if (!body) return;

        const filtered = filterMovements();
        updateResultCount(filtered.length);

        if (!filtered.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted">
                        Aucun mouvement trouvé.
                    </td>
                </tr>
            `;
            return;
        }

        body.innerHTML = filtered.map((movement) => {
            const article = movement.inventaire || {};
            const user = movement.utilisateurs || {};
            const quantity = movement.quantite ?? null;
            const serial = movement.numero_serie ?? null;

            return `
                <tr>
                    <td>${escapeHtml(formatDate(movement.date))}</td>
                    <td>${renderType(movement.type)}</td>
                    <td>${escapeHtml(article.id_article || "-")}</td>
                    <td>${escapeHtml(article.designation_modele || "-")}</td>
                    <td>${escapeHtml(formatQuantity(quantity, article.unite || ""))}</td>
                    <td>${escapeHtml(formatOptional(serial))}</td>
                    <td>${escapeHtml(user.nom_prenom || "-")}</td>
                    <td>${escapeHtml(movement.motif_mission || "-")}</td>
                    <td>${escapeHtml(movement.destination_provenance || "-")}</td>
                </tr>
            `;
        }).join("");
    }

    async function loadArticles() {
        const { data, error } = await window.bacaSupabase
            .from("inventaire")
            .select("id,id_article,designation_modele,numero_serie,quantite,unite,statut,categorie_id")
            .order("id_article");

        if (error) {
            console.error("Erreur de chargement des articles :", error);
            showMessage("Impossible de charger les articles.", "danger");
            return;
        }

        articles = data || [];
        const select = document.querySelector("#movementArticle");
        if (!select) return;

        select.innerHTML = '<option value="">Sélectionner un article</option>';
        articles.forEach((article) => {
            const option = document.createElement("option");
            option.value = article.id;
            option.textContent = `${article.id_article} — ${article.designation_modele}`;
            select.appendChild(option);
        });
    }

    async function loadMovements() {
        clearMessage();

        const { data, error } = await window.bacaSupabase
            .from("mouvements")
            .select(`
                id_mouvement,
                date,
                type,
                article_id,
                quantite,
                numero_serie,
                quantite_ou_serie,
                responsable_id,
                motif_mission,
                destination_provenance,
                observations,
                inventaire (
                    id_article,
                    designation_modele,
                    unite
                ),
                utilisateurs (
                    nom_prenom,
                    grade
                )
            `)
            .order("date", { ascending: false });

        if (error) {
            console.error("Erreur de chargement des mouvements :", error);
            showMessage("Impossible de charger les mouvements.", "danger");
            return;
        }

        movements = data || [];
        renderTable();
    }

    function resetForm() {
        document.querySelector("#movementForm")?.reset();
        const info = document.querySelector("#movementArticleInfo");
        if (info) info.value = "";
    }

    function openMovementModal() {
        resetForm();
        movementModal?.show();
    }

    function updateArticleInfo() {
        const articleId = document.querySelector("#movementArticle")?.value;
        const article = articles.find((item) => item.id === articleId);
        const info = document.querySelector("#movementArticleInfo");
        if (!info) return;

        if (!article) {
            info.value = "";
            return;
        }

        info.value = `${article.id_article} — ${article.designation_modele} — Stock : ${formatQuantity(article.quantite, article.unite || "")} — Statut : ${getStatusLabel(article.statut)}`;
    }

    function getFormValues() {
        const quantityText = document.querySelector("#movementQuantity")?.value.trim() || "";
        const serialText = document.querySelector("#movementSerialNumber")?.value.trim() || "";

        return {
            type: document.querySelector("#movementType")?.value || "",
            article_id: document.querySelector("#movementArticle")?.value || "",
            quantite: quantityText === "" ? null : Number(quantityText),
            numero_serie: serialText === "" ? null : serialText,
            motif_mission: document.querySelector("#movementReason")?.value.trim() || "",
            destination_provenance: document.querySelector("#movementDestination")?.value.trim() || null,
            observations: document.querySelector("#movementObservations")?.value.trim() || null
        };
    }

    function validateMovement(values) {
        if (!values.type) return "Le type de mouvement est obligatoire.";
        if (!values.article_id) return "L’article est obligatoire.";
        if (values.quantite !== null && (!Number.isFinite(values.quantite) || values.quantite < 0)) {
            return "La quantité doit être un nombre positif ou nul.";
        }
        if (values.numero_serie !== null && values.numero_serie.length > 100) {
            return "Le numéro de série ne doit pas dépasser 100 caractères.";
        }
        if (!values.motif_mission) return "Le motif ou la mission est obligatoire.";
        return null;
    }

    async function saveMovement(event) {
        event.preventDefault();

        const values = getFormValues();
        const validationError = validateMovement(values);
        if (validationError) {
            showMessage(validationError, "warning");
            return;
        }

        if (!currentProfile?.id) {
            showMessage("Utilisateur non identifié.", "danger");
            return;
        }

        const button = document.querySelector("#saveMovementButton");
        if (button) {
            button.disabled = true;
            button.textContent = "Enregistrement...";
        }

        const payload = {
            date: new Date().toISOString(),
            type: values.type,
            article_id: values.article_id,
            quantite: values.quantite,
            numero_serie: values.numero_serie,
            responsable_id: currentProfile.id,
            motif_mission: values.motif_mission,
            destination_provenance:
                values.destination_provenance,
            observations: values.observations
        };

        const { error } = await window.bacaSupabase
            .from("mouvements")
            .insert(payload);

        if (button) {
            button.disabled = false;
            button.textContent = "Enregistrer";
        }

        if (error) {
            console.error("Erreur d’enregistrement du mouvement :", error);
            showMessage(error.message || "Impossible d’enregistrer le mouvement.", "danger");
            return;
        }

        movementModal?.hide();
        showMessage("Mouvement enregistré avec succès.", "success");
        await loadMovements();
    }

    function resetFilters() {
        const search = document.querySelector("#movementSearch");
        const type = document.querySelector("#movementTypeFilter");
        const date = document.querySelector("#movementDateFilter");
        if (search) search.value = "";
        if (type) type.value = "";
        if (date) date.value = "all";
        renderTable();
    }

    function attachEvents() {
        const exportButton = document.querySelector("#exportMovementsPdf");
        exportButton?.addEventListener("click", exportMovementsToPdf);

        ["#movementSearch", "#movementTypeFilter", "#movementDateFilter"].forEach((selector) => {
            document.querySelector(selector)?.addEventListener(
                selector === "#movementSearch" ? "input" : "change",
                renderTable
            );
        });

        document.querySelector("#resetMovementFilters")?.addEventListener("click", resetFilters);
        document.querySelector("#newMovementButton")?.addEventListener("click", openMovementModal);
        document.querySelector("#movementArticle")?.addEventListener("change", updateArticleInfo);
        document.querySelector("#movementForm")?.addEventListener("submit", saveMovement);
    }

    function getExportQuantity(movement) {
        return movement.quantite === null || movement.quantite === undefined
            ? "-"
            : formatQuantity(movement.quantite, movement.inventaire?.unite || "");
    }

    function exportMovementsToPdf() {
        try {
            if (!window.jspdf?.jsPDF) {
                throw new Error("La bibliothèque jsPDF n’est pas chargée.");
            }

            const filteredMovements = filterMovements();
            if (!filteredMovements.length) {
                showMessage("Aucun mouvement ne correspond aux filtres actuels.", "warning");
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            const currentDate = new Date().toLocaleString("fr-FR");

            doc.setFontSize(16);
            doc.text("BACA-APP — Rapport des mouvements", 14, 15);
            doc.setFontSize(10);
            doc.text("Base Aérienne de Cana", 14, 22);
            doc.text(`Généré le : ${currentDate}`, 14, 28);
            doc.text(`Demandeur : ${currentProfile?.nom_prenom || "Non identifié"}`, 14, 34);

            const tableRows = filteredMovements.map((movement) => [
                formatDate(movement.date),
                getTypeLabel(movement.type),
                movement.inventaire?.id_article || "-",
                movement.inventaire?.designation_modele || "-",
                getExportQuantity(movement),
                movement.numero_serie || "-",
                movement.utilisateurs?.nom_prenom || "-",
                movement.motif_mission || "-",
                movement.destination_provenance || "-"
            ]);

            doc.autoTable({
                startY: 40,
                head: [[
                    "Date", "Type", "Article", "Désignation", "Quantité",
                    "N° série", "Responsable", "Motif", "Destination / provenance"
                ]],
                body: tableRows,
                theme: "grid",
                styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
                headStyles: { fillColor: [7, 26, 51], textColor: [255, 255, 255], fontStyle: "bold" },
                alternateRowStyles: { fillColor: [244, 246, 249] },
                margin: { top: 40, right: 10, bottom: 15, left: 10 }
            });

            const dateFile = new Date().toISOString().slice(0, 10);
            doc.save(`BACA-APP-mouvements-${dateFile}.pdf`);
            showMessage("Le rapport PDF a été généré.", "success");
        } catch (error) {
            console.error("Erreur lors de l’export PDF :", error);
            showMessage(error.message || "Impossible de générer le PDF.", "danger");
        }
    }

    async function initialize(profile) {
        currentProfile = profile;
        const modalElement = document.querySelector("#movementModal");
        if (modalElement && window.bootstrap) {
            movementModal = bootstrap.Modal.getOrCreateInstance(modalElement);
        }
        attachEvents();
        await loadArticles();
        await loadMovements();
    }

    window.BACA_MOVEMENTS = {
        initialize,
        load: loadMovements
    };
})();