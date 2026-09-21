// assets/js/emailjs-config.js
(function () {
    'use strict';

    // À remplacer par tes propres valeurs (dashboard EmailJS)
    const EMAILJS_CONFIG = {
        publicKey: 'ox0GSIi2bsxH5MbV7',              // ex. "user_xxxxx"
        serviceId: 'service_3cq1fb8',              // ex. "service_xxxxx"
        templateIdAlerteSeuil: 'template_yrd8bbc',
        templateIdNotifSecu: 'TEMPLATE_NOTIF_SECURITE',
        templateIdRapport: 'TEMPLATE_RAPPORT_PERIODIQUE'
    };

    // Initialisation du SDK EmailJS
    if (window.emailjs) {
        window.emailjs.init({
            publicKey: EMAILJS_CONFIG.publicKey
        });
    }

    window.BACA_EMAILJS_CONFIG = EMAILJS_CONFIG;
})();