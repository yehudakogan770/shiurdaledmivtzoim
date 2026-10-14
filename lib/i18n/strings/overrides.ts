import type { Area } from "./types";

/**
 * Where two parts of the site translated the same English differently, the one to use.
 * "Home" is the Home page; a stop of type Home (a house) uses the key "Home (a house)".
 */
const overrides: Area = {
  he: {
    Home: "דף הבית",
    "Home (a house)": "בית",
    "{n} entry": "רישום אחד",
    Hidden: "מוסתר",
    "Chavrusas on this route": "החברותות במסלול הזה",
    "Use at least 6 characters.": "השתמש לפחות ב־6 תווים.",
    "(general location)": "(אזור כללי)",
    "Partner in the Mivtzoim": "היה שותף במבצעים",
    "Mivtzoim this Friday at 2:00. Meet outside the shul.": "מבצעים ביום שישי הקרוב ב-2:00. נפגשים מחוץ לבית הכנסת.",
  },
  fr: {
    Home: "Accueil",
    "Home (a house)": "Domicile",
    Hidden: "Masqué",
    "Chavrusas on this route": "'Havroutot de ce parcours",
    "(general location)": "(secteur général)",
    "Partner in the Mivtzoim": "Soyez partenaire des Mivtsaïm",
    "Your participation helps make the Mivtzoim possible.": "Votre participation rend les Mivtsaïm possibles.",
    "Mivtzoim this Friday at 2:00. Meet outside the shul.": "Mivtsaïm ce vendredi à 14 h. Rendez-vous devant la synagogue.",
  },
  es: {
    Home: "Inicio",
    "Home (a house)": "Casa",
    Hidden: "Oculto",
    "Chavrusas on this route": "Javrusas de esta ruta",
    "New password": "Nueva contraseña",
    "Save new password": "Guardar nueva contraseña",
    "(general location)": "(zona general)",
    "No announcement right now.": "No hay anuncio por ahora.",
    "Partner in the Mivtzoim": "Sé socio de los Mivtzoim",
    "Your participation helps make the Mivtzoim possible.": "Tu participación hace posibles los Mivtzoim.",
  },
};
export default overrides;
