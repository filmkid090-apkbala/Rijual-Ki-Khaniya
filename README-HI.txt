RIJUAL KI KHANIYA — Admin Login update
======================================

IMPORTANT
- This version uses Supabase Auth and database Row Level Security.
- Readers can read/listen without logging in.
- Admin login screen asks only for a password. The configured admin email is stored in config.js.
- Never put a Supabase secret/service_role key in config.js.

SETUP
1. Open config.js.
2. Replace:
   PASTE_YOUR_SUPABASE_PROJECT_URL_HERE
   PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE
   PASTE_YOUR_ADMIN_EMAIL_HERE
   with your project's URL, publishable key, and the same email you used to create the Supabase Auth user.
3. Save config.js.
4. Upload/replace index.html, app.js, config.js, seed_stories.sql, and README in your GitHub repository. Keep any existing manifest/service worker/icon files if your repo has them.
5. In Supabase SQL Editor, run seed_stories.sql ONCE if you want the four starter stories. If you have your own story text saved only in the old browser's local storage, it will not automatically transfer; add it again through Admin or insert it into Supabase.
6. Ensure the Admin user UUID is already present in public.admins (you said you added it).
7. Test the website in a private/incognito window: stories should show without login; Admin login should ask only for password.

DATABASE
The app expects public.stories columns: id, title, content, created_at.
It only stores title and story text; emoji/category are shown with defaults.
The app expects public.admins(user_id) and the policies previously created.

SECURITY
- Client-side buttons are not the security boundary; Supabase RLS policies are.
- Readers must not be able to insert/update/delete stories even if they inspect the website.
- Use only the publishable key in browser code. Never use secret/service_role keys.
- A password-only UI works by signing in against the configured admin email. Protect access to the email account and password.

UPDATE NOTES (fixes)
- Admin password ab chhupa hua (****) modal mein poochha jata hai (pehle prompt() mein dikhta tha).
- Naya story save karne ke baad wahi story khulti hai (pehle title se dhundhta tha).
- Edit/Delete ab check karte hain ki permission mili ya nahi; chup-chaap fail nahi hota.
- Lambi kahani ki awaaz beech mein nahi ruki (text chhote tukdon mein bol-ta hai).
- Emoji/Shreni wale khaali fields hata diye (database mein sirf title + content save hota hai).

MOBILE APP INSTALL (PWA) - naya
Is ZIP ki SAARI files GitHub repo mein upload karein (purani files replace karein):
  index.html, app.js, pwa.js, sw.js, manifest.json, config.js, icon-192.png, icon-512.png,
  icon-maskable-512.png, apple-touch-icon.png
- Android (Chrome): site kholein -> "📲 App Install Karein" button dikhega, ya menu (⋮) -> Install app.
- iPhone (Safari): Share -> Add to Home Screen (page par guide bhi dikhta hai).
- Install ke liye site https:// par honi chahiye (GitHub Pages par hoti hai).
- sw.js network-first hai: naya update turant milta hai, internet na ho to purani copy chalti hai.
  Supabase login/database kabhi cache nahi hota.
- Agar purani manifest/sw file repo mein thi, to ye files unhe replace kar dengi.

=========== NAYA: FOTO / VIDEO / AUDIO + HIDDEN ADMIN LOGIN ===========
SETUP (sirf ek baar):
 1. Supabase -> SQL Editor -> setup_media.sql poora paste karke RUN karein.
    (Naye columns, save permissions aur "story-media" storage bucket ban jata hai.)
 2. Is ZIP ki saari files GitHub mein replace karein. config.js mein apni 3 cheezein bharein.

ADMIN LOGIN AB SABKO NAHI DIKHTA:
 - Website ke upar "Rijual Ki Khaniya" naam par 5 baar jaldi-jaldi tap karein -> login box khulega.
 - Ya website ke address ke aakhir mein #admin lagayein (jaise https://...github.io/repo/#admin).

KAHANI MEIN MEDIA:
 - Admin login -> "Kahani jodein" ya kisi kahani mein "Edit karein".
 - Photo (auto chhoti ho jaati hai), Video (50 MB tak), Audio/aapki awaaz (50 MB tak) chun sakte hain. Sab optional hai.
 - Audio upload ho to padhne wale audio player se sunenge; na ho to "Kahani sunein" wali computer awaaz chalegi.
 - Video bada ho to phone mein compress karke daalein (Supabase free plan mein 50 MB limit hai).
