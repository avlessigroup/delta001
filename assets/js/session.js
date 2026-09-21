(function () {
    "use strict";

    async function getCurrentUser() {
        if (!window.bacaSupabase) {
            return null;
        }

        const {
            data: { user },
            error
        } = await window.bacaSupabase.auth.getUser();

        if (error || !user) {
            return null;
        }

        return user;
    }

    async function getCurrentProfile() {
        const user = await getCurrentUser();

        if (!user) {
            return null;
        }

        const { data: profile, error } =
            await window.bacaSupabase
                .from("utilisateurs")
                .select("id, matricule, nom_prenom, grade, role, email, actif")
                .eq("id", user.id)
                .single();

        if (error || !profile || !profile.actif) {
            return null;
        }

        return profile;
    }

    async function requireSession() {
        const profile = await getCurrentProfile();

        if (!profile) {
            window.location.href = "index.html";
            return null;
        }

        return profile;
    }

    async function logout() {
        if (window.bacaSupabase) {
            await window.bacaSupabase.auth.signOut();
        }

        sessionStorage.removeItem("bacaProfile");
        window.location.href = "index.html";
    }

    function hasRole(profile, roles) {
        if (!profile || !Array.isArray(roles)) {
            return false;
        }

        return roles.includes(profile.role);
    }

    window.BACA_SESSION = {
        getCurrentUser,
        getCurrentProfile,
        requireSession,
        logout,
        hasRole
    };
})();