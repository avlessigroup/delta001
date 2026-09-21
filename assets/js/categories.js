(function () {
    "use strict";

    let currentProfile = null;
    let categories = [];
    let categoryModal = null;

    function isManager() {
        return currentProfile &&
            [
                "administrateur",
                "super_utilisateur"
            ].includes(currentProfile.role);
    }

    function isSuperUser() {
        return currentProfile &&
            currentProfile.role === "super_utilisateur";
    }

    function showMessage(message, type = "info") {
        const element =
            document.querySelector("#categoryMessage");

        if (!element) {
            return;
        }

        element.className = `alert alert-${type}`;
        element.textContent = message;
    }

    function clearMessage() {
        const element =
            document.querySelector("#categoryMessage");

        if (element) {
            element.className = "";
            element.textContent = "";
        }
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatThreshold(value) {
        return Number(value || 0).toLocaleString("fr-FR", {
            maximumFractionDigits: 3
        });
    }

    function renderTracking(value) {
        return value
            ? `<span class="badge text-bg-primary">Oui</span>`
            : `<span class="badge text-bg-secondary">Non</span>`;
    }

    function renderStatus(value) {
        return value
            ? `<span class="badge text-bg-success">Active</span>`
            : `<span class="badge text-bg-secondary">Désactivée</span>`;
    }

    function getFilteredCategories() {
        const searchValue =
            document.querySelector("#categorySearch")
                ?.value
                .trim()
                .toLowerCase() || "";

        const status =
            document.querySelector("#categoryStatusFilter")
                ?.value || "actives";

        return categories.filter(function (category) {
            const matchesSearch =
                !searchValue ||
                category.categorie
                    .toLowerCase()
                    .includes(searchValue) ||
                category.sous_categorie
                    .toLowerCase()
                    .includes(searchValue) ||
                category.cle_technique
                    .toLowerCase()
                    .includes(searchValue);

            const matchesStatus =
                status === "toutes" ||
                (status === "actives" && category.actif) ||
                (status === "inactives" && !category.actif);

            return matchesSearch && matchesStatus;
        });
    }

    function renderTable() {
        const body =
            document.querySelector("#categoriesTableBody");

        if (!body) {
            return;
        }

        const filtered = getFilteredCategories();

        if (!filtered.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted">
                        Aucune catégorie trouvée.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = filtered.map(function (category) {
            const editButton = isManager()
                ? `
                    <button
                        class="btn btn-sm btn-outline-primary"
                        data-action="edit"
                        data-id="${category.id}"
                    >
                        Modifier
                    </button>
                `
                : "";

            const disableButton =
                isManager() && category.actif
                    ? `
                        <button
                            class="btn btn-sm btn-outline-warning"
                            data-action="disable"
                            data-id="${category.id}"
                        >
                            Désactiver
                        </button>
                    `
                    : "";

            const activateButton =
                isManager() && !category.actif
                    ? `
                        <button
                            class="btn btn-sm btn-outline-success"
                            data-action="activate"
                            data-id="${category.id}"
                        >
                            Activer
                        </button>
                    `
                    : "";

            const deleteButton =
                isSuperUser()
                    ? `
                        <button
                            class="btn btn-sm btn-outline-danger"
                            data-action="delete"
                            data-id="${category.id}"
                        >
                            Supprimer
                        </button>
                    `
                    : "";

            return `
                <tr>
                    <td>${escapeHtml(category.categorie)}</td>
                    <td>${escapeHtml(category.sous_categorie)}</td>
                    <td>${renderTracking(category.suivi_individuel)}</td>
                    <td>
                        <code>${escapeHtml(category.cle_technique)}</code>
                    </td>
                    <td>${formatThreshold(category.seuil_alerte_defaut)}</td>
                    <td>${renderStatus(category.actif)}</td>
                    <td>
                        <div class="d-flex flex-wrap gap-1">
                            ${editButton}
                            ${disableButton}
                            ${activateButton}
                            ${deleteButton}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    async function loadCategories() {
        clearMessage();

        const { data, error } =
            await window.bacaSupabase
                .from("categories")
                .select(`
                    id,
                    categorie,
                    sous_categorie,
                    suivi_individuel,
                    cle_technique,
                    seuil_alerte_defaut,
                    actif,
                    created_at
                `)
                .order("categorie", {
                    ascending: true
                })
                .order("sous_categorie", {
                    ascending: true
                });

        if (error) {
            console.error("Erreur catégories :", error);
            showMessage(
                "Impossible de charger les catégories.",
                "danger"
            );
            return;
        }

        categories = data || [];
        renderTable();
    }

    function resetForm() {
        document.querySelector("#categoryForm").reset();
        document.querySelector("#categoryId").value = "";
        document.querySelector("#defaultThreshold").value = "0";
        document.querySelector("#categoryActive").checked = true;
        document.querySelector("#categoryModalTitle").textContent =
            "Nouvelle catégorie";
    }

    function openCreateModal() {
        if (!isManager()) {
            showMessage(
                "Vous n'avez pas les droits pour créer une catégorie.",
                "warning"
            );
            return;
        }

        resetForm();
        categoryModal.show();
    }

    function openEditModal(id) {
        const category =
            categories.find(function (item) {
                return item.id === id;
            });

        if (!category) {
            showMessage(
                "Catégorie introuvable.",
                "danger"
            );
            return;
        }

        document.querySelector("#categoryId").value =
            category.id;

        document.querySelector("#categoryName").value =
            category.categorie;

        document.querySelector("#subcategoryName").value =
            category.sous_categorie;

        document.querySelector("#technicalKey").value =
            category.cle_technique;

        document.querySelector("#defaultThreshold").value =
            category.seuil_alerte_defaut;

        document.querySelector("#individualTracking").checked =
            category.suivi_individuel;

        document.querySelector("#categoryActive").checked =
            category.actif;

        document.querySelector("#categoryModalTitle").textContent =
            "Modifier la catégorie";

        categoryModal.show();
    }

    function validateForm(values) {
        if (!values.categorie) {
            return "La catégorie est obligatoire.";
        }

        if (!values.sous_categorie) {
            return "La sous-catégorie est obligatoire.";
        }

        if (!values.cle_technique) {
            return "La clé technique est obligatoire.";
        }

        if (!/^[A-Z0-9-]+$/.test(values.cle_technique)) {
            return "La clé technique doit utiliser des majuscules, chiffres et tirets.";
        }

        if (
            Number.isNaN(values.seuil_alerte_defaut) ||
            values.seuil_alerte_defaut < 0
        ) {
            return "Le seuil doit être supérieur ou égal à zéro.";
        }

        return null;
    }

    async function saveCategory(event) {
        event.preventDefault();

        if (!isManager()) {
            showMessage(
                "Vous n'avez pas les droits nécessaires.",
                "danger"
            );
            return;
        }

        const id =
            document.querySelector("#categoryId").value
                .trim();

        const values = {
            categorie: document
                .querySelector("#categoryName")
                .value
                .trim(),

            sous_categorie: document
                .querySelector("#subcategoryName")
                .value
                .trim(),

            cle_technique: document
                .querySelector("#technicalKey")
                .value
                .trim()
                .toUpperCase(),

            seuil_alerte_defaut: Number(
                document.querySelector("#defaultThreshold").value
            ),

            suivi_individuel:
                document.querySelector("#individualTracking").checked,

            actif:
                document.querySelector("#categoryActive").checked
        };

        const validationError = validateForm(values);

        if (validationError) {
            showMessage(validationError, "warning");
            return;
        }

        const button =
            document.querySelector("#saveCategoryButton");

        button.disabled = true;
        button.textContent = "Enregistrement...";

        let result;

        if (id) {
            result = await window.bacaSupabase
                .from("categories")
                .update(values)
                .eq("id", id)
                .select()
                .single();
        } else {
            result = await window.bacaSupabase
                .from("categories")
                .insert(values)
                .select()
                .single();
        }

        button.disabled = false;
        button.textContent = "Enregistrer";

        if (result.error) {
            console.error(
                "Erreur d'enregistrement :",
                result.error
            );

            if (result.error.code === "23505") {
                showMessage(
                    "Cette catégorie ou cette clé technique existe déjà.",
                    "danger"
                );
            } else {
                showMessage(
                    result.error.message,
                    "danger"
                );
            }

            return;
        }

        categoryModal.hide();

        showMessage(
            id
                ? "Catégorie modifiée avec succès."
                : "Catégorie créée avec succès.",
            "success"
        );

        await loadCategories();
    }

    async function changeActiveState(id, active) {
        if (!isManager()) {
            showMessage(
                "Vous n'avez pas les droits nécessaires.",
                "danger"
            );
            return;
        }

        const message = active
            ? "Activer cette catégorie ?"
            : "Désactiver cette catégorie ?";

        if (!window.confirm(message)) {
            return;
        }

        const { error } =
            await window.bacaSupabase
                .from("categories")
                .update({
                    actif: active
                })
                .eq("id", id);

        if (error) {
            console.error(error);
            showMessage(
                "Impossible de modifier l'état de la catégorie.",
                "danger"
            );
            return;
        }

        showMessage(
            active
                ? "Catégorie activée."
                : "Catégorie désactivée.",
            "success"
        );

        await loadCategories();
    }

    async function deleteCategory(id) {
        if (!isSuperUser()) {
            showMessage(
                "Seul le super-utilisateur peut supprimer une catégorie.",
                "danger"
            );
            return;
        }

        if (!window.confirm(
            "Attention : cette suppression est définitive. Continuer ?"
        )) {
            return;
        }

        const { error } =
            await window.bacaSupabase
                .from("categories")
                .delete()
                .eq("id", id);

        if (error) {
            console.error(error);

            showMessage(
                "Suppression impossible. La catégorie est peut-être utilisée par l'inventaire.",
                "danger"
            );

            return;
        }

        showMessage(
            "Catégorie supprimée.",
            "success"
        );

        await loadCategories();
    }

    function attachEvents() {
        document
            .querySelector("#addCategoryButton")
            .addEventListener("click", openCreateModal);

        document
            .querySelector("#categoryForm")
            .addEventListener("submit", saveCategory);

        document
            .querySelector("#categorySearch")
            .addEventListener("input", renderTable);

        document
            .querySelector("#categoryStatusFilter")
            .addEventListener("change", renderTable);

        document
            .querySelector("#categoriesTableBody")
            .addEventListener("click", async function (event) {
                const button =
                    event.target.closest("button[data-action]");

                if (!button) {
                    return;
                }

                const action = button.dataset.action;
                const id = button.dataset.id;

                if (action === "edit") {
                    openEditModal(id);
                }

                if (action === "disable") {
                    await changeActiveState(id, false);
                }

                if (action === "activate") {
                    await changeActiveState(id, true);
                }

                if (action === "delete") {
                    await deleteCategory(id);
                }
            });
    }

    function initialize(profile) {
        currentProfile = profile;

        const modalElement =
            document.querySelector("#categoryModal");

        categoryModal =
            new bootstrap.Modal(modalElement);

        if (!isManager()) {
            document.querySelector("#addCategoryButton").classList.add("d-none");
        }

        attachEvents();
        loadCategories();
    }

    window.BACA_CATEGORIES = {
        initialize,
        load: loadCategories
    };
})();