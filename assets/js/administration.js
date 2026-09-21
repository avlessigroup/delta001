(function () {
    "use strict";

    let profile = null;
    let currentPage = 1;
    const pageSize = 25;

    // Utilisation : $("#userForm") ou $(".btn-edit-user")
    const $ = function (selector) {
        return document.querySelector(selector);
    };

    function message(text, type = "info") {
        const element = $("#administrationMessage");
        if (!element) return;
        if (!text) {
            element.className = "";
            element.textContent = "";
            return;
        }
        element.className = `alert alert-${type}`;
        element.textContent = text;
    }

    function modalMessage(text, type = "info") {
        const element = $("#userModalMessage");
        if (!element) return;
        if (!text) {
            element.className = "";
            element.textContent = "";
            return;
        }
        element.className = `alert alert-${type}`;
        element.textContent = text;
    }

    function canManageUsers() {
        return Boolean(profile && ["administrateur", "super_utilisateur"].includes(profile.role));
    }

    function canElevateRole() {
        return Boolean(profile && profile.role === "super_utilisateur");
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function roleLabel(role) {
        return {
            utilisateur: "Utilisateur",
            administrateur: "Administrateur",
            super_utilisateur: "Super-utilisateur"
        }[role] || role || "-";
    }

    function resetUserForm() {
        const form = $("#userForm");
        if (!form) return;

        form.reset();
        $("#userId").value = "";
        $("#userRoleSelect").value = "utilisateur";
        $("#userActifSelect").value = "true";
        $("#userChangePassword").checked = false;
        $("#userPassword") && ($("#userPassword").value = "");
        $("#userModalLabel").textContent = "Créer un utilisateur";
        $("#saveUserButton").textContent = "Enregistrer";
        modalMessage("");
    }

    async function loadUsers() {
        message("");

        const search = $("#userSearch")?.value.trim().toLowerCase() || "";
        const roleFilter = $("#userRole")?.value || "";
        const actifFilter = $("#userActif")?.value ?? "";

        let query = window.bacaSupabase
            .from("utilisateurs")
            .select("*", { count: "exact" })
            .order("nom_prenom", { ascending: true });

        if (roleFilter) query = query.eq("role", roleFilter);
        if (actifFilter !== "") query = query.eq("actif", actifFilter === "true");

        const from = (currentPage - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error(error);
            message("Erreur de chargement des utilisateurs.", "danger");
            return;
        }

        let users = data || [];

        if (search) {
            users = users.filter((user) => [
                user.matricule,
                user.nom_prenom,
                user.grade,
                user.email,
                user.role
            ].filter(Boolean).join(" ").toLowerCase().includes(search));
        }

        renderUsers(users);
        $("#userResultCount") && ($("#userResultCount").textContent = `${search ? users.length : count || users.length} résultat${(search ? users.length : count || users.length) > 1 ? "s" : ""}`);
        renderPagination(search ? users.length : count || users.length);
    }

    function renderUsers(users) {
        const tbody = $("#usersTableBody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!users.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Aucun utilisateur trouvé.</td></tr>`;
            return;
        }

        users.forEach((user) => {
            const row = document.createElement("tr");
            const activeClass = user.actif ? "success" : "secondary";
            const activeLabel = user.actif ? "Actif" : "Désactivé";

            row.innerHTML = `
                <td>${escapeHtml(user.matricule)}</td>
                <td>${escapeHtml(user.nom_prenom)}</td>
                <td>${escapeHtml(user.grade)}</td>
                <td><span class="badge text-bg-primary">${escapeHtml(roleLabel(user.role))}</span></td>
                <td>${escapeHtml(user.email)}</td>
                <td><span class="badge text-bg-${activeClass}">${activeLabel}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary btn-edit-user" type="button" data-id="${escapeHtml(user.id)}">
                        Modifier
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });

        tbody.querySelectorAll(".btn-edit-user").forEach((button) => {
            button.addEventListener("click", () => openUserModal(button.dataset.id));
        });
    }

    function renderPagination(total) {
        const nav = $("#usersPagination");
        if (!nav) return;
        nav.innerHTML = "";

        const totalPages = Math.ceil(total / pageSize);
        if (totalPages <= 1) return;

        const createPageItem = (label, page, disabled = false, active = false) => {
            const li = document.createElement("li");
            li.className = `page-item${disabled ? " disabled" : ""}${active ? " active" : ""}`;

            const button = document.createElement("button");
            button.type = "button";
            button.className = "page-link";
            button.textContent = label;
            button.disabled = disabled;

            button.addEventListener("click", () => {
                if (disabled) return;
                currentPage = page;
                loadUsers();
                window.scrollTo({ top: 0, behavior: "smooth" });
            });

            li.appendChild(button);
            return li;
        };

        nav.appendChild(createPageItem("« Préc.", Math.max(1, currentPage - 1), currentPage === 1));

        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, currentPage + 2);

        if (start > 1) {
            nav.appendChild(createPageItem("1", 1));
            if (start > 2) {
                const li = document.createElement("li");
                li.className = "page-item disabled";
                li.innerHTML = '<span class="page-link">…</span>';
                nav.appendChild(li);
            }
        }

        for (let page = start; page <= end; page += 1) {
            nav.appendChild(createPageItem(String(page), page, false, page === currentPage));
        }

        if (end < totalPages) {
            if (end < totalPages - 1) {
                const li = document.createElement("li");
                li.className = "page-item disabled";
                li.innerHTML = '<span class="page-link">…</span>';
                nav.appendChild(li);
            }
            nav.appendChild(createPageItem(String(totalPages), totalPages));
        }

        nav.appendChild(createPageItem("Suiv. »", Math.min(totalPages, currentPage + 1), currentPage === totalPages));
    }

    function resetFilters() {
        $("#userSearch") && ($("#userSearch").value = "");
        $("#userRole") && ($("#userRole").value = "");
        $("#userActif") && ($("#userActif").value = "");
        currentPage = 1;
        loadUsers();
    }

    async function getUser(userId) {
        const { data, error } = await window.bacaSupabase
            .from("utilisateurs")
            .select("*")
            .eq("id", userId)
            .single();

        if (error || !data) throw new Error("Utilisateur introuvable.");
        return data;
    }

    async function openUserModal(userId = null) {
        resetUserForm();
        const modalElement = $("#userModal");
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

        if (userId) {
            $("#userModalLabel").textContent = "Modifier l’utilisateur";
            $("#userId").value = userId;

            try {
                const user = await getUser(userId);
                $("#userMatricule").value = user.matricule || "";
                $("#userNomPrenom").value = user.nom_prenom || "";
                $("#userGrade").value = user.grade || "";
                $("#userEmail").value = user.email || "";
                $("#userRoleSelect").value = user.role || "utilisateur";
                $("#userActifSelect").value = user.actif ? "true" : "false";
                $("#userChangePassword").checked = false;
                $("#userPassword") && ($("#userPassword").value = "");
                $("#saveUserButton").textContent = "Modifier";
            } catch (error) {
                modalMessage(error.message, "danger");
                return;
            }
        }

        modal.show();
    }

    async function getOldRole(userId) {
        if (!userId) return "utilisateur";

        const { data, error } = await window.bacaSupabase
            .from("utilisateurs")
            .select("role")
            .eq("id", userId)
            .single();

        if (error || !data) throw new Error("Impossible de récupérer l’ancien rôle.");
        return data.role;
    }

    function roleElevation(oldRole, newRole) {
        return (oldRole === "utilisateur" && ["administrateur", "super_utilisateur"].includes(newRole)) ||
            (oldRole === "administrateur" && newRole === "super_utilisateur");
    }

    function readForm() {
        return {
            userId: $("#userId").value.trim(),
            matricule: $("#userMatricule").value.trim(),
            nomPrenom: $("#userNomPrenom").value.trim(),
            grade: $("#userGrade").value.trim(),
            email: $("#userEmail").value.trim().toLowerCase(),
            password: $("#userPassword")?.value || "",
            role: $("#userRoleSelect").value,
            actif: $("#userActifSelect").value === "true",
            changePassword: $("#userChangePassword").checked
        };
    }

    function validateForm(values) {
        if (!values.matricule || !values.nomPrenom || !values.grade || !values.email) {
            return "Veuillez remplir les champs obligatoires.";
        }

        if (!values.userId && !values.password) {
            return "Le mot de passe initial est obligatoire pour une création.";
        }

        if (values.password && values.password.length < 8) {
            return "Le mot de passe doit contenir au moins 8 caractères.";
        }

        if (!values.userId && values.role === "super_utilisateur" && !canElevateRole()) {
            return "Seul un super-utilisateur peut créer un super-utilisateur.";
        }

        if (values.changePassword && !values.password) {
            return "Saisissez le nouveau mot de passe.";
        }

        return null;
    }

    async function createUser(values) {
        const { data, error } = await window.bacaSupabase.functions.invoke(
            "creer-utilisateur",
            {
                body: {
                    email: values.email,
                    password: values.password,
                    matricule: values.matricule,
                    nom_prenom: values.nomPrenom,
                    grade: values.grade,
                    role: values.role,
                    actif: values.actif
                }
            }
        );

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    }

    async function updateProfile(values) {
        const { error } = await window.bacaSupabase
            .from("utilisateurs")
            .update({
                matricule: values.matricule,
                nom_prenom: values.nomPrenom,
                grade: values.grade,
                email: values.email,
                role: values.role,
                actif: values.actif
            })
            .eq("id", values.userId);

        if (error) throw error;
    }

    async function updateAuth(values) {
        const { data, error } = await window.bacaSupabase.functions.invoke(
            "modifier-utilisateur",
            {
                body: {
                    id: values.userId,
                    email: values.email,
                    password: values.changePassword ? values.password : null
                }
            }
        );

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    }

    async function saveUser(event) {
        event?.preventDefault();
        modalMessage("");

        if (!canManageUsers()) {
            modalMessage("Accès réservé aux administrateurs et super-utilisateurs.", "danger");
            return;
        }

        const values = readForm();
        const validationError = validateForm(values);

        if (validationError) {
            modalMessage(validationError, "warning");
            return;
        }

        let oldRole = "utilisateur";

        try {
            oldRole = await getOldRole(values.userId);
        } catch (error) {
            modalMessage(error.message, "danger");
            return;
        }

        const elevation = roleElevation(oldRole, values.role);

        if ((elevation || values.role === "super_utilisateur") && !canElevateRole()) {
            modalMessage("Seul un super-utilisateur peut attribuer ce rôle.", "danger");
            return;
        }

        if (elevation) {
            const confirmed = window.confirm(
                "Cette élévation de privilège sera journalisée.\n\nContinuer ?"
            );

            if (!confirmed) return;
        }

        const button = $("#saveUserButton");
        button.disabled = true;
        button.textContent = values.userId ? "Modification..." : "Création...";

        try {
            if (!values.userId) {
                await createUser(values);
                modalMessage("Utilisateur créé sans e-mail de confirmation.", "success");
            } else {
                await updateProfile(values);

                if (values.changePassword && values.password) {
                    await updateAuth(values);
                }

                modalMessage("Utilisateur modifié avec succès.", "success");
            }

            await loadUsers();

            setTimeout(() => {
                const modal = bootstrap.Modal.getInstance($("#userModal"));
                modal?.hide();
                resetUserForm();
            }, 900);
        } catch (error) {
            console.error("Erreur d’enregistrement utilisateur :", error);
            modalMessage(error.message || "Erreur lors de l’enregistrement.", "danger");
        } finally {
            button.disabled = false;
            button.textContent = values.userId ? "Modifier" : "Enregistrer";
        }
    }

    function attachEvents() {
        $("#newUserButton")?.addEventListener("click", () => openUserModal(null));
        $("#resetUserFilters")?.addEventListener("click", resetFilters);
        $("#resetUserFormButton")?.addEventListener("click", resetUserForm);

        ["userRole", "userActif"].forEach((id) => {
            $(`#${id}`)?.addEventListener("change", () => {
                currentPage = 1;
                loadUsers();
            });
        });

        $("#userSearch")?.addEventListener("input", () => {
            currentPage = 1;
            loadUsers();
        });

        $("#userForm")?.addEventListener("submit", saveUser);
    }

    async function initialize(currentProfile) {
        profile = currentProfile;

        if (!canManageUsers()) {
            message("Accès réservé aux administrateurs et super-utilisateurs.", "danger");
            return;
        }

        attachEvents();
        await loadUsers();
    }

    window.BACA_ADMINISTRATION = {
        initialize,
        loadUsers,
        openUserModal,
        resetUserForm
    };
})();