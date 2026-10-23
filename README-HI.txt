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
