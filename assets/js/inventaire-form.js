(function () {
    "use strict";

    const BUCKET_NAME = "inventaire-photos";

    let currentProfile = null;
    let categories = [];
    let currentArticle = null;

    function getArticleIdFromUrl() {
        const params =
            new URLSearchParams(window.location.search);

        return params.get("id");
    }

    function isManager() {
        return currentProfile &&
            [
                "administrateur",
                "super_utilisateur"
            ].includes(currentProfile.role);
    }

    function showMessage(message, type = "info") {
        const element =
            document.querySelector("#inventoryFormMessage");

        if (!element) {
            return;
        }

        element.className = `alert alert-${type}`;
        element.textContent = message;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    async function loadCategories() {
        const { data, error } =
            await window.bacaSupabase
                .from("categories")
                .select(`
                id,
                categorie,
                sous_categorie,
                suivi_individuel,
                seuil_alerte_defaut,
                actif
            `)
                .eq("actif", true)
                .order("categorie", {
                    ascending: true
                })
                .order("sous_categorie", {
                    ascending: true
                });

        if (error) {
            console.error(
                "Erreur de chargement des catégories :",
                error
            );

            showMessage(
                "Impossible de charger les catégories.",
                "danger"
            );

            return;
        }

        categories = data || [];

        console.log("Catégories chargées :", categories);

        const categorySelect =
            document.querySelector("#categoryId");

        const categoryNames = [
            ...new Set(
                categories.map(function (category) {
                    return category.categorie;
                })
            )
        ];

        categoryNames.forEach(function (categoryName) {
            const option =
                document.createElement("option");

            option.value = categoryName;
            option.textContent = categoryName;

            categorySelect.appendChild(option);
        });

        // Si on a au moins une catégorie, charger ses sous-catégories par défaut
        if (categoryNames.length > 0) {
            loadSubcategories(categoryNames[0]);
        }
    }





    function loadSubcategories(categoryName, selectedSubcategory = "") {
        const subcategorySelect =
            document.querySelector("#subcategoryId");

        subcategorySelect.innerHTML = "";

        if (!categoryName) {
            subcategorySelect.disabled = true;

            subcategorySelect.innerHTML = `
            <option value="">
                Sélectionnez d’abord une catégorie
            </option>
        `;

            return;
        }

        const matchingCategories =
            categories.filter(function (category) {
                return category.categorie === categoryName;
            });

        if (!matchingCategories.length) {
            subcategorySelect.disabled = true;

            subcategorySelect.innerHTML = `
            <option value="">
                Aucune sous-catégorie disponible
            </option>
        `;

            return;
        }

        subcategorySelect.disabled = false;

        const firstOption =
            document.createElement("option");

        firstOption.value = "";
        firstOption.textContent =
            "Sélectionner une sous-catégorie";

        subcategorySelect.appendChild(firstOption);

        matchingCategories.forEach(function (category) {
            const option =
                document.createElement("option");

            option.value = category.id;
            option.textContent = category.sous_categorie;

            option.dataset.individual =
                category.suivi_individuel
                    ? "true"
                    : "false";

            option.dataset.threshold =
                category.seuil_alerte_defaut;

            if (
                category.sous_categorie ===
                selectedSubcategory
            ) {
                option.selected = true;
            }

            subcategorySelect.appendChild(option);
        });
    }

    function getSelectedCategory() {
        const id =
            document.querySelector("#subcategoryId").value;

        return categories.find(function (category) {
            return category.id === id;
        });
    }




    function updateCategoryRules() {
        const category = getSelectedCategory();

        const serialInput =
            document.querySelector("#serialNumber");

        const quantityInput =
            document.querySelector("#quantity");

        const unitInput =
            document.querySelector("#unit");

        const thresholdInput =
            document.querySelector("#threshold");

        const serialHelp =
            document.querySelector("#serialHelp");

        const quantityHelp =
            document.querySelector("#quantityHelp");

        if (
            !serialInput ||
            !quantityInput ||
            !unitInput ||
            !thresholdInput
        ) {
            return;
        }

        if (!category) {
            serialInput.disabled = false;
            serialInput.required = false;

            quantityInput.disabled = false;
            quantityInput.required = true;

            unitInput.disabled = false;
            unitInput.required = false;

            thresholdInput.value = "0";

            if (serialHelp) {
                serialHelp.textContent =
                    "Sélectionnez une sous-catégorie.";
            }

            if (quantityHelp) {
                quantityHelp.textContent =
                    "La quantité est modifiable.";
            }

            return;
        }

        thresholdInput.value =
            category.seuil_alerte_defaut || 0;

        if (category.suivi_individuel === true) {
            serialInput.disabled = false;
            serialInput.required = true;

            // Ne pas bloquer la quantité
            quantityInput.disabled = false;
            quantityInput.required = true;

            unitInput.disabled = false;
            unitInput.required = true;

            if (serialHelp) {
                serialHelp.textContent =
                    "Numéro de série obligatoire.";
            }

            if (quantityHelp) {
                quantityHelp.textContent =
                    "La quantité est modifiable.";
            }

            return;
        }

        serialInput.value = "";
        serialInput.disabled = true;
        serialInput.required = false;

        quantityInput.disabled = false;
        quantityInput.required = true;

        unitInput.disabled = false;
        unitInput.required = true;

        if (serialHelp) {
            serialHelp.textContent =
                "Article géré par lot : aucun numéro de série.";
        }

        if (quantityHelp) {
            quantityHelp.textContent =
                "Lot : quantité libre et modifiable.";
        }
    }




    function validateImage(file) {
        if (!file) {
            return null;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            return "La photo doit être au format JPG, PNG ou WEBP.";
        }

        const maxSize =
            5 * 1024 * 1024;

        if (file.size > maxSize) {
            return "La photo ne doit pas dépasser 5 Mo.";
        }

        return null;
    }

    function showPhotoPreview(file) {
        const preview =
            document.querySelector("#photoPreview");

        if (!preview) {
            return;
        }

        if (!file) {
            preview.innerHTML = "";
            return;
        }

        const imageUrl =
            URL.createObjectURL(file);

        preview.innerHTML = `
            <div class="mt-2">
                <p class="mb-1">Aperçu :</p>

                <img
                    src="${imageUrl}"
                    alt="Aperçu de la photo"
                    class="img-thumbnail"
                    style="max-width: 240px; max-height: 180px;"
                >
            </div>
        `;
    }

    async function uploadPhoto(file, articleId) {
        const validationError =
            validateImage(file);

        if (validationError) {
            throw new Error(validationError);
        }

        const extension =
            file.name.split(".").pop().toLowerCase();

        const safeArticleId =
            articleId.replace(/[^a-zA-Z0-9-_]/g, "");

        const path =
            `${safeArticleId}/${Date.now()}.${extension}`;

        const { data, error } =
            await window.bacaSupabase
                .storage
                .from(BUCKET_NAME)
                .upload(path, file, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type
                });

        if (error) {
            throw error;
        }

        return data.path;
    }

    async function loadArticle(id) {
        const { data, error } =
            await window.bacaSupabase
                .from("inventaire")
                .select("*")
                .eq("id", id)
                .single();

        if (error) {
            console.error(
                "Erreur de chargement de l'article :",
                error
            );

            showMessage(
                "Impossible de charger l’article.",
                "danger"
            );

            return;
        }

        currentArticle = data;

        document.querySelector("#inventoryFormTitle")
            .textContent = "Modifier l’article";

        document.querySelector("#inventoryId")
            .value = data.id;

        document.querySelector("#articleId")
            .value = data.id_article;


        const selectedCategory =
            categories.find(function (category) {
                return category.id === data.categorie_id;
            });

        if (selectedCategory) {
            document.querySelector("#categoryId").value =
                selectedCategory.categorie;

            loadSubcategories(
                selectedCategory.categorie,
                selectedCategory.sous_categorie
            );
        }

        document.querySelector("#designation")
            .value = data.designation_modele;

        document.querySelector("#serialNumber")
            .value = data.numero_serie || "";

        document.querySelector("#quantity")
            .value = data.quantite;

        document.querySelector("#unit")
            .value = data.unite || "";

        document.querySelector("#threshold")
            .value = data.seuil_alerte;

        document.querySelector("#status")
            .value = data.statut;

        document.querySelector("#location")
            .value = data.emplacement;

        document.querySelector("#observations")
            .value = data.observations || "";

        updateCategoryRules();

        if (data.photo_url) {
            document.querySelector("#photoPreview").innerHTML = `
                <div class="mt-2">
                    <p class="mb-1">Photo actuelle :</p>

                    <p class="text-muted">
                        ${escapeHtml(data.photo_url)}
                    </p>
                </div>
            `;
        }
    }


    function getFormValues() {
        return {
            id: document
                .querySelector("#inventoryId")
                .value
                .trim(),

            id_article: document
                .querySelector("#articleId")
                .value
                .trim()
                .toUpperCase(),

            categorie_id: document
                .querySelector("#subcategoryId")
                .value,

            designation_modele: document
                .querySelector("#designation")
                .value
                .trim(),

            numero_serie: document
                .querySelector("#serialNumber")
                .value
                .trim() || null,

            quantite: Number(
                document.querySelector("#quantity").value
            ),

            unite: document
                .querySelector("#unit")
                .value
                .trim() || null,

            seuil_alerte: Number(
                document.querySelector("#threshold").value
            ),

            statut: document
                .querySelector("#status")
                .value,

            emplacement: document
                .querySelector("#location")
                .value
                .trim(),

            observations: document
                .querySelector("#observations")
                .value
                .trim() || null
        };
    }

    function validateForm(values, category) {
        if (!values.id_article) {
            return "L’ID article est obligatoire.";
        }

        if (!/^[A-Z0-9-]+$/.test(values.id_article)) {
            return "L’ID article doit contenir uniquement des majuscules, chiffres et tirets.";
        }

        if (!category) {
            return "Sélectionnez une sous-catégorie.";
        }

        if (!values.designation_modele) {
            return "La désignation est obligatoire.";
        }

        if (
            !Number.isFinite(values.quantite) ||
            values.quantite < 0
        ) {
            return "La quantité doit être supérieure ou égale à zéro.";
        }

        if (
            !Number.isFinite(values.seuil_alerte) ||
            values.seuil_alerte < 0
        ) {
            return "Le seuil doit être supérieur ou égal à zéro.";
        }

        if (!values.emplacement) {
            return "L’emplacement est obligatoire.";
        }

        if (
            category.suivi_individuel === true &&
            !values.numero_serie
        ) {
            return "Le numéro de série est obligatoire.";
        }

        if (!values.unite) {
            return "L’unité est obligatoire.";
        }

        return null;
    }





    async function saveArticle(event) {
        event.preventDefault();

        if (!isManager()) {
            showMessage(
                "Vous n’avez pas les droits nécessaires.",
                "danger"
            );

            return;
        }

        const values = getFormValues();
        const category = getSelectedCategory();

        const validationError =
            validateForm(values, category);

        if (validationError) {
            showMessage(validationError, "warning");
            return;
        }

        const file =
            document.querySelector("#photo").files[0];

        const button =
            document.querySelector("#saveInventoryButton");

        button.disabled = true;
        button.textContent = "Enregistrement...";

        try {
            let photoPath =
                currentArticle?.photo_url || null;

            if (file) {
                photoPath =
                    await uploadPhoto(
                        file,
                        values.id_article
                    );
            }

            const payload = {
                id_article: values.id_article,
                categorie_id: values.categorie_id,
                designation_modele: values.designation_modele,
                numero_serie: values.numero_serie,
                quantite: values.quantite,
                unite: values.unite,
                seuil_alerte: values.seuil_alerte,
                statut: values.statut,
                emplacement: values.emplacement,
                photo_url: photoPath,
                observations: values.observations,
                modifie_par: currentProfile.id,
                date_modification: new Date().toISOString()
            };

            let result;

            if (values.id) {
                result =
                    await window.bacaSupabase
                        .from("inventaire")
                        .update(payload)
                        .eq("id", values.id)
                        .select()
                        .single();
            } else {
                payload.cree_par = currentProfile.id;

                result =
                    await window.bacaSupabase
                        .from("inventaire")
                        .insert(payload)
                        .select()
                        .single();
            }

            if (result.error) {
                throw result.error;
            }

            showMessage(
                values.id
                    ? "Article modifié avec succès."
                    : "Article créé avec succès.",
                "success"
            );

            setTimeout(function () {
                window.location.href = "inventaire.html";
            }, 800);

        } catch (error) {
            console.error(
                "Erreur d’enregistrement :",
                error
            );

            if (error.code === "23505") {
                showMessage(
                    "Cet ID article existe déjà.",
                    "danger"
                );
            } else {
                showMessage(
                    error.message ||
                    "Impossible d’enregistrer l’article.",
                    "danger"
                );
            }

            button.disabled = false;
            button.textContent = "Enregistrer";
        }
    }

    function attachEvents() {
        document
            .querySelector("#categoryId")
            .addEventListener(
                "change",
                function (event) {
                    loadSubcategories(event.target.value);
                    updateCategoryRules();
                }
            );

        document
            .querySelector("#subcategoryId")
            .addEventListener(
                "change",
                updateCategoryRules
            );

        document
            .querySelector("#photo")
            .addEventListener(
                "change",
                function (event) {
                    const file =
                        event.target.files[0];

                    const error =
                        validateImage(file);

                    if (error) {
                        showMessage(error, "warning");
                        event.target.value = "";
                        showPhotoPreview(null);
                        return;
                    }

                    showPhotoPreview(file);
                }
            );

        document
            .querySelector("#inventoryForm")
            .addEventListener(
                "submit",
                saveArticle
            );
    }

    async function initialize(profile) {
        currentProfile = profile;

        console.log("Initialisation formulaire inventaire, rôle :", currentProfile?.role);

        if (!isManager()) {
            showMessage(
                "Accès réservé aux administrateurs.",
                "danger"
            );

            document.querySelector("#inventoryForm")
                .classList.add("d-none");

            return;
        }

        await loadCategories();

        const articleId =
            getArticleIdFromUrl();

        if (articleId) {
            await loadArticle(articleId);
        }

        attachEvents();
        updateCategoryRules();

        console.log("Formulaire inventaire initialisé.");
    }
    window.BACA_INVENTORY_FORM = {
        initialize
    };
})();











/*


(function () {
    "use strict";

    const BUCKET_NAME = "inventaire-photos";

    let currentProfile = null;
    let categories = [];
    let currentArticle = null;

    function getArticleIdFromUrl() {
        const params =
            new URLSearchParams(window.location.search);

        return params.get("id");
    }

    function isManager() {
        return currentProfile &&
            [
                "administrateur",
                "super_utilisateur"
            ].includes(currentProfile.role);
    }

    function showMessage(message, type = "info") {
        const element =
            document.querySelector("#inventoryFormMessage");

        if (!element) {
            return;
        }

        element.className = `alert alert-${type}`;
        element.textContent = message;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    async function loadCategories() {
        const { data, error } =
            await window.bacaSupabase
                .from("categories")
                .select(`
                id,
                categorie,
                sous_categorie,
                suivi_individuel,
                seuil_alerte_defaut,
                actif
            `)
                .eq("actif", true)
                .order("categorie", {
                    ascending: true
                })
                .order("sous_categorie", {
                    ascending: true
                });

        if (error) {
            console.error(
                "Erreur de chargement des catégories :",
                error
            );

            showMessage(
                "Impossible de charger les catégories.",
                "danger"
            );

            return;
        }

        categories = data || [];

        console.log("Catégories chargées :", categories);

        const categorySelect =
            document.querySelector("#categoryId");

        const categoryNames = [
            ...new Set(
                categories.map(function (category) {
                    return category.categorie;
                })
            )
        ];

        categoryNames.forEach(function (categoryName) {
            const option =
                document.createElement("option");

            option.value = categoryName;
            option.textContent = categoryName;

            categorySelect.appendChild(option);
        });

        // Si on a au moins une catégorie, charger ses sous-catégories par défaut
        if (categoryNames.length > 0) {
            loadSubcategories(categoryNames[0]);
        }
    }





    function loadSubcategories(categoryName, selectedSubcategory = "") {
        const subcategorySelect =
            document.querySelector("#subcategoryId");

        subcategorySelect.innerHTML = "";

        if (!categoryName) {
            subcategorySelect.disabled = true;

            subcategorySelect.innerHTML = `
            <option value="">
                Sélectionnez d’abord une catégorie
            </option>
        `;

            return;
        }

        const matchingCategories =
            categories.filter(function (category) {
                return category.categorie === categoryName;
            });

        if (!matchingCategories.length) {
            subcategorySelect.disabled = true;

            subcategorySelect.innerHTML = `
            <option value="">
                Aucune sous-catégorie disponible
            </option>
        `;

            return;
        }

        subcategorySelect.disabled = false;

        const firstOption =
            document.createElement("option");

        firstOption.value = "";
        firstOption.textContent =
            "Sélectionner une sous-catégorie";

        subcategorySelect.appendChild(firstOption);

        matchingCategories.forEach(function (category) {
            const option =
                document.createElement("option");

            option.value = category.id;
            option.textContent = category.sous_categorie;

            option.dataset.individual =
                category.suivi_individuel
                    ? "true"
                    : "false";

            option.dataset.threshold =
                category.seuil_alerte_defaut;

            if (
                category.sous_categorie ===
                selectedSubcategory
            ) {
                option.selected = true;
            }

            subcategorySelect.appendChild(option);
        });
    }

    function getSelectedCategory() {
        const id =
            document.querySelector("#subcategoryId").value;

        return categories.find(function (category) {
            return category.id === id;
        });
    }


    function updateCategoryRules() {
        const category = getSelectedCategory();

        const serialInput =
            document.querySelector("#serialNumber");

        const quantityInput =
            document.querySelector("#quantity");

        const unitInput =
            document.querySelector("#unit");

        const serialHelp =
            document.querySelector("#serialHelp");

        const thresholdInput =
            document.querySelector("#threshold");

        if (!category) {
            serialInput.required = false;
            serialInput.disabled = false;

            quantityInput.disabled = false;

            unitInput.required = false;
            unitInput.disabled = false;

            thresholdInput.value = "0";

            return;
        }

        thresholdInput.value =
            category.seuil_alerte_defaut;

        if (category.suivi_individuel) {
            serialInput.required = true;
            serialInput.disabled = false;

            quantityInput.value = "1";
            quantityInput.disabled = true;

            unitInput.value = "";
            unitInput.required = false;
            unitInput.disabled = true;

            serialHelp.textContent =
                "Numéro de série obligatoire. Quantité fixée à 1.";

            return;
        }

        serialInput.required = false;
        serialInput.value = "";
        serialInput.disabled = true;

        quantityInput.disabled = false;

        unitInput.required = true;
        unitInput.disabled = false;

        serialHelp.textContent =
            "Article géré par lot : renseignez l’unité.";
    }


    function validateImage(file) {
        if (!file) {
            return null;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            return "La photo doit être au format JPG, PNG ou WEBP.";
        }

        const maxSize =
            5 * 1024 * 1024;

        if (file.size > maxSize) {
            return "La photo ne doit pas dépasser 5 Mo.";
        }

        return null;
    }

    function showPhotoPreview(file) {
        const preview =
            document.querySelector("#photoPreview");

        if (!preview) {
            return;
        }

        if (!file) {
            preview.innerHTML = "";
            return;
        }

        const imageUrl =
            URL.createObjectURL(file);

        preview.innerHTML = `
            <div class="mt-2">
                <p class="mb-1">Aperçu :</p>

                <img
                    src="${imageUrl}"
                    alt="Aperçu de la photo"
                    class="img-thumbnail"
                    style="max-width: 240px; max-height: 180px;"
                >
            </div>
        `;
    }

    async function uploadPhoto(file, articleId) {
        const validationError =
            validateImage(file);

        if (validationError) {
            throw new Error(validationError);
        }

        const extension =
            file.name.split(".").pop().toLowerCase();

        const safeArticleId =
            articleId.replace(/[^a-zA-Z0-9-_]/g, "");

        const path =
            `${safeArticleId}/${Date.now()}.${extension}`;

        const { data, error } =
            await window.bacaSupabase
                .storage
                .from(BUCKET_NAME)
                .upload(path, file, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type
                });

        if (error) {
            throw error;
        }

        return data.path;
    }

    async function loadArticle(id) {
        const { data, error } =
            await window.bacaSupabase
                .from("inventaire")
                .select("*")
                .eq("id", id)
                .single();

        if (error) {
            console.error(
                "Erreur de chargement de l'article :",
                error
            );

            showMessage(
                "Impossible de charger l’article.",
                "danger"
            );

            return;
        }

        currentArticle = data;

        document.querySelector("#inventoryFormTitle")
            .textContent = "Modifier l’article";

        document.querySelector("#inventoryId")
            .value = data.id;

        document.querySelector("#articleId")
            .value = data.id_article;


        const selectedCategory =
            categories.find(function (category) {
                return category.id === data.categorie_id;
            });

        if (selectedCategory) {
            document.querySelector("#categoryId").value =
                selectedCategory.categorie;

            loadSubcategories(
                selectedCategory.categorie,
                selectedCategory.sous_categorie
            );
        }

        document.querySelector("#designation")
            .value = data.designation_modele;

        document.querySelector("#serialNumber")
            .value = data.numero_serie || "";

        document.querySelector("#quantity")
            .value = data.quantite;

        document.querySelector("#unit")
            .value = data.unite || "";

        document.querySelector("#threshold")
            .value = data.seuil_alerte;

        document.querySelector("#status")
            .value = data.statut;

        document.querySelector("#location")
            .value = data.emplacement;

        document.querySelector("#observations")
            .value = data.observations || "";

        updateCategoryRules();

        if (data.photo_url) {
            document.querySelector("#photoPreview").innerHTML = `
                <div class="mt-2">
                    <p class="mb-1">Photo actuelle :</p>

                    <p class="text-muted">
                        ${escapeHtml(data.photo_url)}
                    </p>
                </div>
            `;
        }
    }


    function getFormValues() {
        return {
            id: document
                .querySelector("#inventoryId")
                .value
                .trim(),

            id_article: document
                .querySelector("#articleId")
                .value
                .trim()
                .toUpperCase(),

            categorie_id: document
                .querySelector("#subcategoryId")
                .value,

            designation_modele: document
                .querySelector("#designation")
                .value
                .trim(),

            numero_serie: document
                .querySelector("#serialNumber")
                .value
                .trim() || null,

            quantite: Number(
                document.querySelector("#quantity").value
            ),

            unite: document
                .querySelector("#unit")
                .value
                .trim() || null,

            seuil_alerte: Number(
                document.querySelector("#threshold").value
            ),

            statut: document
                .querySelector("#status")
                .value,

            emplacement: document
                .querySelector("#location")
                .value
                .trim(),

            observations: document
                .querySelector("#observations")
                .value
                .trim() || null
        };
    }




    function validateForm(values, category) {
        if (!values.id_article) {
            return "L’ID article est obligatoire.";
        }

        if (!/^[A-Z0-9-]+$/.test(values.id_article)) {
            return "L’ID article doit contenir uniquement des majuscules, chiffres et tirets.";
        }

        if (!category) {
            return "Sélectionnez une catégorie.";
        }

        if (!values.designation_modele) {
            return "La désignation est obligatoire.";
        }

        if (category.suivi_individuel) {
            if (!values.numero_serie) {
                return "Le numéro de série est obligatoire pour cette catégorie.";
            }

            if (values.quantite !== 1) {
                return "La quantité doit être égale à 1.";
            }
        } else {
            if (!values.unite) {
                return "L’unité est obligatoire pour un lot.";
            }
        }

        if (
            Number.isNaN(values.quantite) ||
            values.quantite < 0
        ) {
            return "La quantité doit être supérieure ou égale à zéro.";
        }

        if (
            Number.isNaN(values.seuil_alerte) ||
            values.seuil_alerte < 0
        ) {
            return "Le seuil doit être supérieur ou égal à zéro.";
        }

        if (!values.emplacement) {
            return "L’emplacement est obligatoire.";
        }

        return null;
    }

    async function saveArticle(event) {
        event.preventDefault();

        if (!isManager()) {
            showMessage(
                "Vous n’avez pas les droits nécessaires.",
                "danger"
            );

            return;
        }

        const values = getFormValues();
        const category = getSelectedCategory();

        const validationError =
            validateForm(values, category);

        if (validationError) {
            showMessage(validationError, "warning");
            return;
        }

        const file =
            document.querySelector("#photo").files[0];

        const button =
            document.querySelector("#saveInventoryButton");

        button.disabled = true;
        button.textContent = "Enregistrement...";

        try {
            let photoPath =
                currentArticle?.photo_url || null;

            if (file) {
                photoPath =
                    await uploadPhoto(
                        file,
                        values.id_article
                    );
            }

            const payload = {
                id_article: values.id_article,
                categorie_id: values.categorie_id,
                designation_modele: values.designation_modele,
                numero_serie: values.numero_serie,
                quantite: values.quantite,
                unite: values.unite,
                seuil_alerte: values.seuil_alerte,
                statut: values.statut,
                emplacement: values.emplacement,
                photo_url: photoPath,
                observations: values.observations,
                modifie_par: currentProfile.id,
                date_modification: new Date().toISOString()
            };

            let result;

            if (values.id) {
                result =
                    await window.bacaSupabase
                        .from("inventaire")
                        .update(payload)
                        .eq("id", values.id)
                        .select()
                        .single();
            } else {
                payload.cree_par = currentProfile.id;

                result =
                    await window.bacaSupabase
                        .from("inventaire")
                        .insert(payload)
                        .select()
                        .single();
            }

            if (result.error) {
                throw result.error;
            }

            showMessage(
                values.id
                    ? "Article modifié avec succès."
                    : "Article créé avec succès.",
                "success"
            );

            setTimeout(function () {
                window.location.href = "inventaire.html";
            }, 800);

        } catch (error) {
            console.error(
                "Erreur d’enregistrement :",
                error
            );

            if (error.code === "23505") {
                showMessage(
                    "Cet ID article existe déjà.",
                    "danger"
                );
            } else {
                showMessage(
                    error.message ||
                    "Impossible d’enregistrer l’article.",
                    "danger"
                );
            }

            button.disabled = false;
            button.textContent = "Enregistrer";
        }
    }

    function attachEvents() {
        document
            .querySelector("#categoryId")
            .addEventListener(
                "change",
                function (event) {
                    loadSubcategories(event.target.value);
                    updateCategoryRules();
                }
            );

        document
            .querySelector("#subcategoryId")
            .addEventListener(
                "change",
                updateCategoryRules
            );

        document
            .querySelector("#photo")
            .addEventListener(
                "change",
                function (event) {
                    const file =
                        event.target.files[0];

                    const error =
                        validateImage(file);

                    if (error) {
                        showMessage(error, "warning");
                        event.target.value = "";
                        showPhotoPreview(null);
                        return;
                    }

                    showPhotoPreview(file);
                }
            );

        document
            .querySelector("#inventoryForm")
            .addEventListener(
                "submit",
                saveArticle
            );
    }

    async function initialize(profile) {
        currentProfile = profile;

        console.log("Initialisation formulaire inventaire, rôle :", currentProfile?.role);

        if (!isManager()) {
            showMessage(
                "Accès réservé aux administrateurs.",
                "danger"
            );

            document.querySelector("#inventoryForm")
                .classList.add("d-none");

            return;
        }

        await loadCategories();

        const articleId =
            getArticleIdFromUrl();

        if (articleId) {
            await loadArticle(articleId);
        }

        attachEvents();
        updateCategoryRules();

        console.log("Formulaire inventaire initialisé.");
    }
    window.BACA_INVENTORY_FORM = {
        initialize
    };
})();


*/



