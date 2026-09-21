(function () {
    "use strict";

    const PAGE_SIZE = 10;
    let currentProfile = null;
    let categories = [];
    let inventoryRows = [];
    let filteredRows = [];
    let currentPage = 1;

    const $ = (selector) => document.querySelector(selector);

    function showMessage(text, type = "info") {
        const element = $("#inventoryMessage");
        if (!element) return;
        element.className = text ? `alert alert-${type}` : "";
        element.textContent = text || "";
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

    function isManager() {
        return Boolean(
            currentProfile &&
            ["administrateur", "super_utilisateur"]
                .includes(currentProfile.role)
        );
    }

    function isSuperUser() {
        return currentProfile?.role === "super_utilisateur";
    }

    function isBelowThreshold(article) {
        if (typeof article.sous_seuil === "boolean") {
            return article.sous_seuil;
        }
        return Number(article.quantite || 0) <= Number(article.seuil_alerte || 0);
    }

    function getStatusLabel(status) {
        return {
            disponible: "Disponible",
            en_mission: "En mission",
            en_maintenance: "En maintenance",
            hors_service_reforme: "Hors service / réformé"
        }[status] || status || "-";
    }

    function getStatusColor(status) {
        return {
            disponible: "success",
            en_mission: "primary",
            en_maintenance: "warning",
            hors_service_reforme: "danger"
        }[status] || "secondary";
    }

    function formatQuantity(value) {
        return Number(value || 0).toLocaleString("fr-FR", {
            maximumFractionDigits: 3
        });
    }

    function getSearchValues() {
        return {
            search: $("#inventorySearch")?.value.trim().toLowerCase() || "",
            categoryId: $("#inventoryCategory")?.value || "",
            status: $("#inventoryStatus")?.value || "",
            location: $("#inventoryLocation")?.value.trim().toLowerCase() || "",
            alert: $("#inventoryAlert")?.value || ""
        };
    }

    function applyFilters() {
        const filters = getSearchValues();

        filteredRows = inventoryRows.filter((article) => {
            const category = article.categories || {};
            const searchableText = [
                article.id_article,
                article.designation_modele,
                article.numero_serie,
                article.emplacement,
                category.categorie,
                category.sous_categorie
            ].filter(Boolean).join(" ").toLowerCase();

            const matchesSearch = !filters.search || searchableText.includes(filters.search);
            const matchesCategory = !filters.categoryId || article.categorie_id === filters.categoryId;
            const matchesStatus = !filters.status || article.statut === filters.status;
            const matchesLocation = !filters.location || String(article.emplacement || "").toLowerCase().includes(filters.location);
            const critical = isBelowThreshold(article);
            const matchesAlert = !filters.alert ||
                (filters.alert === "critical" && critical) ||
                (filters.alert === "normal" && !critical);

            return matchesSearch && matchesCategory && matchesStatus && matchesLocation && matchesAlert;
        });

        currentPage = 1;
        renderAlertSummary();
        renderTable();
        renderPagination();
        updateResultCount();
    }

    function updateResultCount() {
        const element = $("#inventoryResultCount");
        if (!element) return;
        const count = filteredRows.length;
        element.textContent = `${count} résultat${count > 1 ? "s" : ""}`;
    }

    function getPhotoUrl(path) {
        if (!path || !window.bacaSupabase) return "";
        const { data } = window.bacaSupabase.storage
            .from("inventaire-photos")
            .getPublicUrl(path);
        return data?.publicUrl || "";
    }

    function renderTable() {
        const body = $("#inventoryTableBody");
        if (!body) return;

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageRows = filteredRows.slice(start, start + PAGE_SIZE);

        if (!pageRows.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center text-muted">
                        Aucun article trouvé.
                    </td>
                </tr>
            `;
            return;
        }

        body.innerHTML = pageRows.map((article) => {
            const category = article.categories || {};
            const critical = isBelowThreshold(article);
            const photoUrl = getPhotoUrl(article.photo_url);

            const photoCell = photoUrl
                ? `<td class="text-center">
                    <img src="${escapeHtml(photoUrl)}"
                         alt="Photo de ${escapeHtml(article.designation_modele)}"
                         class="img-thumbnail"
                         style="width:64px;height:48px;object-fit:cover;cursor:pointer;"
                         data-photo-url="${escapeHtml(photoUrl)}">
                   </td>`
                : `<td class="text-center text-muted">–</td>`;

            const editButton = isManager()
                ? `<button type="button" class="btn btn-sm btn-outline-primary"
                    data-action="edit" data-id="${escapeHtml(article.id)}">Modifier</button>`
                : "";

            const deleteButton = isSuperUser()
                ? `<button type="button" class="btn btn-sm btn-outline-danger"
                    data-action="delete" data-id="${escapeHtml(article.id)}">Supprimer</button>`
                : "";

            return `
                <tr class="${critical ? "table-danger" : ""}">
                    ${photoCell}
                    <td><strong>${escapeHtml(article.id_article)}</strong></td>
                    <td>${escapeHtml(category.categorie || "-")}<br><small class="text-muted">${escapeHtml(category.sous_categorie || "-")}</small></td>
                    <td>${escapeHtml(article.designation_modele)}</td>
                    <td>${escapeHtml(article.numero_serie || "-")}</td>
                    <td>${formatQuantity(article.quantite)}${article.unite ? escapeHtml(` ${article.unite}`) : ""}</td>
                    <td><span class="badge text-bg-${getStatusColor(article.statut)}">${escapeHtml(getStatusLabel(article.statut))}</span></td>
                    <td>${escapeHtml(article.emplacement)}</td>
                    <td>${formatQuantity(article.seuil_alerte)}${critical ? '<span class="badge text-bg-danger ms-1">Alerte stock</span>' : ""}</td>
                    <td><div class="d-flex flex-wrap gap-1">
                        ${editButton}
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="details" data-id="${escapeHtml(article.id)}">Détails</button>
                        ${deleteButton}
                    </div></td>
                </tr>
            `;
        }).join("");
    }

    async function deleteArticle(id) {
        if (!isSuperUser()) {
            showMessage("Seul le super-utilisateur peut supprimer un article.", "danger");
            return;
        }

        const article = inventoryRows.find((item) => item.id === id);
        if (!article) {
            showMessage("Article introuvable.", "danger");
            return;
        }

        const confirmed = window.confirm(
            `Voulez-vous vraiment supprimer l’article ${article.id_article} ?\n\nCette action est définitive.`
        );
        if (!confirmed) return;

        const { count, error: historyError } = await window.bacaSupabase
            .from("mouvements")
            .select("id_mouvement", { count: "exact", head: true })
            .eq("article_id", id);

        if (historyError) {
            console.error(historyError);
            showMessage("Impossible de vérifier l’historique de l’article.", "danger");
            return;
        }

        if (count > 0) {
            showMessage("Cet article possède un historique. Utilisez le statut réformé au lieu de le supprimer.", "warning");
            return;
        }

        const { error } = await window.bacaSupabase
            .from("inventaire")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Erreur suppression :", error);
            showMessage(
                error.code === "23503"
                    ? "Suppression impossible : l’article est référencé par une autre table."
                    : error.message || "Impossible de supprimer l’article.",
                "danger"
            );
            return;
        }

        showMessage("Article supprimé avec succès.", "success");
        await loadInventory();
    }

    function renderPagination() {
        const pagination = $("#inventoryPagination");
        if (!pagination) return;

        const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
        pagination.innerHTML = "";
        if (totalPages <= 1) return;

        let html = `<li class="page-item ${currentPage === 1 ? "disabled" : ""}"><button class="page-link" data-page="${currentPage - 1}" type="button">Précédent</button></li>`;
        for (let page = 1; page <= totalPages; page += 1) {
            html += `<li class="page-item ${page === currentPage ? "active" : ""}"><button class="page-link" data-page="${page}" type="button">${page}</button></li>`;
        }
        html += `<li class="page-item ${currentPage === totalPages ? "disabled" : ""}"><button class="page-link" data-page="${currentPage + 1}" type="button">Suivant</button></li>`;
        pagination.innerHTML = html;
    }

    async function loadCategories() {
        const { data, error } = await window.bacaSupabase
            .from("categories")
            .select("id,categorie,sous_categorie,actif")
            .eq("actif", true)
            .order("categorie", { ascending: true })
            .order("sous_categorie", { ascending: true });

        if (error) {
            console.error("Erreur catégories :", error);
            return;
        }

        categories = data || [];
        const select = $("#inventoryCategory");
        if (!select) return;

        select.innerHTML = '<option value="">Toutes</option>';
        categories.forEach((category) => {
            const option = document.createElement("option");
            option.value = category.id;
            option.textContent = `${category.categorie} — ${category.sous_categorie}`;
            select.appendChild(option);
        });
    }

    async function loadInventory() {
        clearMessage();

        const { data, error } = await window.bacaSupabase
            .from("inventaire_alertes")
            .select("id,id_article,categorie_id,designation_modele,numero_serie,quantite,unite,statut,emplacement,seuil_alerte,photo_url,observations,categorie,sous_categorie,sous_seuil")
            .order("id_article", { ascending: true });

        if (error) {
            console.error("Erreur inventaire :", error);
            showMessage("Impossible de charger l’inventaire.", "danger");
            return;
        }

        inventoryRows = (data || []).map((article) => ({
            ...article,
            categories: {
                categorie: article.categorie,
                sous_categorie: article.sous_categorie
            }
        }));

        applyFilters();
    }

    function resetFilters() {
        $("#inventorySearch").value = "";
        $("#inventoryCategory").value = "";
        $("#inventoryStatus").value = "";
        $("#inventoryLocation").value = "";
        $("#inventoryAlert").value = "";
        applyFilters();
    }

    function showDetails(id) {
        const article = inventoryRows.find((item) => item.id === id);
        if (!article) return;

        const category = article.categories || {};
        const photoUrl = getPhotoUrl(article.photo_url);
        const photoText = photoUrl ? ` Photo disponible.` : "";

        showMessage(
            `Article ${article.id_article} — ${article.designation_modele} — Catégorie : ${category.categorie || "-"} — Statut : ${getStatusLabel(article.statut)}.${photoText}`,
            "info"
        );
    }

    function editArticle(id) {
        window.location.href = `inventaire-form.html?id=${encodeURIComponent(id)}`;
    }

    function attachEvents() {
        ["#inventorySearch", "#inventoryLocation"].forEach((selector) => {
            $(selector)?.addEventListener("input", applyFilters);
        });

        ["#inventoryCategory", "#inventoryStatus", "#inventoryAlert"].forEach((selector) => {
            $(selector)?.addEventListener("change", applyFilters);
        });

        $("#resetInventoryFilters")?.addEventListener("click", resetFilters);

        $("#newInventoryButton")?.addEventListener("click", () => {
            if (!isManager()) {
                showMessage("Vous n’avez pas les droits nécessaires.", "warning");
                return;
            }
            window.location.href = "inventaire-form.html";
        });

        $("#inventoryPagination")?.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-page]");
            if (!button) return;

            const page = Number(button.dataset.page);
            const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
            if (page < 1 || page > totalPages) return;

            currentPage = page;
            renderTable();
            renderPagination();
        });

        $("#inventoryTableBody")?.addEventListener("click", async (event) => {
            const photo = event.target.closest("img[data-photo-url]");
            if (photo && typeof window.openPhotoModal === "function") {
                window.openPhotoModal(photo.dataset.photoUrl);
                return;
            }

            const button = event.target.closest("button[data-action]");
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;

            if (action === "details") showDetails(id);
            if (action === "edit") editArticle(id);
            if (action === "delete") await deleteArticle(id);
        });
    }

    function renderAlertSummary() {
        const container = $("#inventoryAlertSummary");
        if (!container) return;

        const criticalArticles = inventoryRows.filter(isBelowThreshold);
        container.innerHTML = criticalArticles.length
            ? `<div class="alert alert-danger"><strong>${criticalArticles.length} article${criticalArticles.length > 1 ? "s" : ""} sous seuil.</strong> Vérifiez les quantités disponibles.</div>`
            : `<div class="alert alert-success">Aucun article n’est actuellement sous son seuil d’alerte.</div>`;
    }

    async function initialize(profile) {
        currentProfile = profile;
        attachEvents();
        await loadCategories();
        await loadInventory();
    }

    window.BACA_INVENTORY = {
        initialize,
        load: loadInventory
    };
})();

window.openPhotoModal = function (url) {
    const image = document.querySelector("#photoModalImage");
    const modalElement = document.querySelector("#photoModal");
    if (!image || !modalElement) return;

    image.src = url;
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.show();

    modalElement.addEventListener("hidden.bs.modal", () => {
        image.src = "";
    }, { once: true });
};