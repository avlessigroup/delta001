(function () {
    "use strict";

    function getCurrentPage() {
        const page = window.location.pathname.split("/").pop();

        return page || "dashboard.html";
    }

    function isActivePage(page) {
        return getCurrentPage() === page ? "active" : "";
    }

    function canSeeAdministration(profile) {
        return profile &&
            ["administrateur", "super_utilisateur"].includes(profile.role);
    }



    function renderLayout(profile) {
        const layout = document.querySelector("#bacaLayout");

        if (!layout) {
            return;
        }

        const administrationLink = canSeeAdministration(profile)
            ? `
            <a
                class="nav-link ${isActivePage("administration.html")}"
                href="administration.html"
            >
                <span>⚙</span>
                Administration
            </a>
        `
            : "";

        layout.innerHTML = `
        <nav class="navbar navbar-expand-lg baca-navbar">
            <div class="container-fluid px-3 px-lg-4">
                <a class="navbar-brand baca-brand" href="dashboard.html">
                    BACA-APP
                    <small>Base Aérienne de Cana</small>
                </a>

                <button
                    class="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#bacaTopMenu"
                >
                    <span class="navbar-toggler-icon"></span>
                </button>

                <div class="collapse navbar-collapse" id="bacaTopMenu">
                    <ul class="navbar-nav ms-auto align-items-lg-center">
                        <li class="nav-item">
                            <span class="nav-link">
                                ${profile.nom_prenom} — ${profile.role}
                            </span>
                        </li>

                        <li class="nav-item">
                            <button
                                id="logoutButton"
                                class="btn btn-sm btn-baca-gold ms-lg-2"
                            >
                                Déconnexion
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>

        <div class="baca-layout">
            <aside class="baca-sidebar">
                <p class="baca-sidebar-title">
                    Navigation principale
                </p>

                <nav class="nav flex-column">
                    <a class="nav-link ${isActivePage("dashboard.html")}"
                       href="dashboard.html">
                        <span>▣</span>
                        Tableau de bord
                    </a>

                    <a class="nav-link ${isActivePage("inventaire.html")}"
                       href="inventaire.html">
                        <span>▤</span>
                        Inventaire
                    </a>

                    <a class="nav-link ${isActivePage("categories.html")}"
                       href="categories.html">
                        <span>▦</span>
                        Catégories
                    </a>

                    <a class="nav-link ${isActivePage("mouvements.html")}"
                       href="mouvements.html">
                        <span>⇄</span>
                        Mouvements
                    </a>

                    <a class="nav-link ${isActivePage("boite-noire.html")}"
                       href="boite-noire.html">
                        <span>◉</span>
                        Boîte Noire
                    </a>

                      

                    ${administrationLink}
                </nav>
            </aside>

            <main class="baca-main">
                <div id="pageContent"></div>

                <footer class="baca-footer">
                    BACA-APP — Usage interne — Base Aérienne de Cana 
                </footer>
            </main>
        </div>
    `;

        attachLogoutHandler();
    }

    function attachLogoutHandler() {
        const logoutButton = document.querySelector("#logoutButton");

        if (!logoutButton) {
            return;
        }

        logoutButton.addEventListener("click", async function () {
            logoutButton.disabled = true;
            logoutButton.textContent = "Déconnexion...";

            if (window.BACA_SESSION) {
                await window.BACA_SESSION.logout();
                return;
            }

            if (window.bacaSupabase) {
                await window.bacaSupabase.auth.signOut();
            }

            window.location.href = "index.html";
        });
    }

    window.BACA_LAYOUT = {
        render: renderLayout
    };
})();