# Translating the Shiur Daled Mivtzoim site (Next.js + React + TypeScript) — shared brief

Repo: /home/user/ShiurDaledMivtoim. The site is getting Hebrew (he), French (fr) and Spanish (es) besides English.
The language system already exists in `lib/i18n/index.ts` — READ IT FIRST, and read `lib/i18n/strings/common.ts` (the shared glossary).

## What to do in YOUR files only
1. Wrap every piece of user-visible English text with `t(...)` (import `{ t, tn }` from "@/lib/i18n"):
   - JSX text, and props/attributes people see or hear: placeholder, title, aria-label, alt, label, hint, sub, subtitle, eyebrow, action text, Empty titles, button text, toast/notify messages, confirm texts, error messages thrown to the user (`throw new Error("...")` whose message is shown), option labels.
   - Template strings become placeholders: `` `Added ${name}.` `` → `t("Added {name}.", { name })`. Keys are the exact English with `{placeholders}`.
   - Plurals: `tn(count, "{n} photo", "{n} photos")` (both strings are keys).
   - Sentences that contain JSX elements (links, <strong>): split into separate t() pieces that each make sense, or restructure; keep the look the same.
   - Names of mivtzoim/categories shown on screen (built-in or from the database: c.name, b.name, STANDARD labels, SUGGESTED_PERSONAL names) → wrap the DISPLAY with `t(name)`, so glossary words (Tefillin, Lulav…) translate and anything typed by people stays as typed.
2. NEVER translate: values that are stored or compared in code (e.g. stop type "Store" stays "Store" in data; only its display becomes `t(type)`), CSS classes, ids, keys, URLs, emails, console logs, code identifiers, Hebrew text (Hebrew always stays Hebrew), people's typed data (route names, place names, notes, site settings text typed by the Owner).
3. IMPORTANT: `t()` must run at render/call time, never at module load (a module-level `const X = t("...")` would freeze English). For module-level constant tables (titles, labels), keep the English there and call `t(...)` where they're used.
4. Don't change behaviour or layout. Don't touch files outside your list (other people are editing them at the same time). Don't run `npm run build` (it would clash); do run `npx tsc --noEmit` and fix errors in YOUR files (ignore errors in other files — others are mid-edit). Don't commit.

## Dictionary
Put every English key you used into YOUR area file `lib/i18n/strings/<area>.ts`, shape `{ he: {...}, fr: {...}, es: {...} }` (type `Area` from "./types"), with a full translation for all three languages. Don't repeat keys that are already in common.ts. Placeholders like {name} must appear unchanged in each translation.

Language rules (the site owner asked for exactly this):
- Hebrew stays Hebrew everywhere.
- Regular English words → translated.
- Transliterated Hebrew words (Tefillin, Shabbos, Mivtzoim, Mivtza, Chavrusa(s), Parshas, Shkiah, Lulav, Challah, Yom Tov, Rebbe…) → in Hebrew written in Hebrew letters; in French/Spanish spelled as those languages do (follow common.ts exactly). Use the same spellings inside sentences.
- Hebrew: natural modern Hebrew as used in Israeli apps; masculine imperative for buttons ("הוסף", "שמור", "מחק"). French: "vous". Spanish: "tú".
- Keep it short and natural; button text short.

Shared UI terms (use consistently):
| English | he | fr | es |
|---|---|---|---|
| Route / Routes | מסלול / מסלולים | Parcours / Parcours | Ruta / Rutas |
| Stop (a place on a route) | תחנה / תחנות | Arrêt / Arrêts | Parada / Paradas |
| Place | מקום | Lieu | Lugar |
| Entry / entries (a logged record) | רישום / רישומים | Entrée / entrées | Registro / registros |
| Log (to record) | רשום | Enregistrer | Registrar |
| Dashboard / Home | דף הבית | Accueil | Inicio |
| History | היסטוריה | Historique | Historial |
| Profile | פרופיל | Profil | Perfil |
| Photos | תמונות | Photos | Fotos |
| Admin | ניהול (page) / מנהל (person) | Administration / administrateur | Administración / administrador |
| Owner (the site's main account) | הבעלים | Propriétaire | Propietario |
| Edit (switch) / Editing | עריכה / במצב עריכה | Modifier / Modification | Editar / Editando |
| Account | חשבון | Compte | Cuenta |
| Sign in / Sign out / Create account | התחבר / התנתק / צור חשבון | Se connecter / Se déconnecter / Créer un compte | Iniciar sesión / Cerrar sesión / Crear cuenta |
| Username / Password / Email | שם משתמש / סיסמה / אימייל | Nom d'utilisateur / Mot de passe / E-mail | Usuario / Contraseña / Correo |
| Week / this week | שבוע / השבוע | semaine / cette semaine | semana / esta semana |
| Everyone | כולם | Tout le monde | Todos |
| Item(s) (a mivtza people count) | פריט / פריטים | élément(s) | elemento(s) |
| Business card | כרטיס ביקור | Carte de visite | Tarjeta de presentación |
| Hide / Bring back | הסתר / החזר | Masquer / Rétablir | Ocultar / Restaurar |
| Save / Cancel / Delete / Keep | שמור / ביטול / מחק / השאר | Enregistrer / Annuler / Supprimer / Garder | Guardar / Cancelar / Eliminar / Conservar |
| Sample (guest preview) | דוגמה | exemple | ejemplo |

When done, reply with: files changed, number of keys added, and anything you deliberately left in English and why.
