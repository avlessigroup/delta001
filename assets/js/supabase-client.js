(function () {
    "use strict";

    if (!window.supabase) {
        console.error("Le SDK Supabase n'est pas chargé.");
        window.bacaSupabase = null;
        return;
    }

    const config = window.BACA_CONFIG || {};

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
        console.error("La configuration Supabase est incomplète.");
        window.bacaSupabase = null;
        return;
    }

    window.bacaSupabase = window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseAnonKey,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false
            }
        }
    );

    console.log("Client Supabase initialisé.");
})();