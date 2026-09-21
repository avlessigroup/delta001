(function () {
    "use strict";

    function showMessage(message, type) {
        const element = document.querySelector("#loginMessage");

        if (!element) {
            return;
        }

        element.className = `alert alert-${type} mt-3`;
        element.textContent = message;
    }

    function setLoading(isLoading) {
        const button = document.querySelector("#loginButton");

        if (!button) {
            return;
        }

        button.disabled = isLoading;
        button.textContent = isLoading
            ? "Connexion..."
            : "Se connecter";
    }

    async function login(email, password) {
        if (!window.bacaSupabase) {
            showMessage(
                "La connexion Supabase n'est pas configurée.",
                "danger"
            );

            return;
        }

        setLoading(true);

        const { data, error } =
            await window.bacaSupabase.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            console.error("Erreur de connexion :", error);

            showMessage(
                "Adresse courriel ou mot de passe incorrect.",
                "danger"
            );

            setLoading(false);
            return;
        }

        if (!data.user) {
            showMessage(
                "Aucun utilisateur authentifié.",
                "danger"
            );

            setLoading(false);
            return;
        }

        const { data: profile, error: profileError } =
            await window.bacaSupabase
                .from("utilisateurs")
                .select("id, matricule, nom_prenom, grade, role, email, actif")
                .eq("id", data.user.id)
                .single();

        if (profileError || !profile) {
            console.error(
                "Profil introuvable :",
                profileError
            );

            await window.bacaSupabase.auth.signOut();

            showMessage(
                "Votre profil BACA-APP n'est pas encore configuré.",
                "danger"
            );

            setLoading(false);
            return;
        }

        if (!profile.actif) {
            await window.bacaSupabase.auth.signOut();

            showMessage(
                "Ce compte a été désactivé.",
                "danger"
            );

            setLoading(false);
            return;
        }

        sessionStorage.setItem(
            "bacaProfile",
            JSON.stringify(profile)
        );

        window.location.href = "dashboard.html";
    }

    function initializeLoginForm() {
        const form = document.querySelector("#loginForm");

        if (!form) {
            return;
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const email = document
                .querySelector("#email")
                .value
                .trim();

            const password = document
                .querySelector("#password")
                .value;

            if (!email || !password) {
                showMessage(
                    "Veuillez renseigner tous les champs.",
                    "warning"
                );

                return;
            }

            await login(email, password);
        });
    }

    document.addEventListener(
        "DOMContentLoaded",
        initializeLoginForm
    );

    window.BACA_AUTH = {
        login
    };
})();