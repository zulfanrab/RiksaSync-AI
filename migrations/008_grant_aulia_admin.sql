-- ==============================================================================
-- MIGRATION: 008_grant_aulia_admin.sql
-- Memberikan role Admin penuh kepada akun Aulia (aulia@aksarariksapjk3.com)
-- di modul Penomoran Dokumen (pn_profil) dan App Users
-- ==============================================================================

-- 1. Berikan role 'admin' di pn_profil
UPDATE public.pn_profil
SET role = 'admin', updated_at = now()
WHERE id IN (
  SELECT id FROM auth.users WHERE LOWER(email) LIKE 'aulia@%'
  UNION
  SELECT auth_id FROM public.app_users WHERE LOWER(username) = 'aulia' OR LOWER(email) LIKE 'aulia@%'
);

-- 2. Jika profil Aulia belum ada di pn_profil, masukkan otomatis
INSERT INTO public.pn_profil (id, nama, role)
SELECT 
  a.id,
  COALESCE(u.full_name, u.username, 'Aulia Zahra Dikrika') AS nama,
  'admin' AS role
FROM auth.users a
LEFT JOIN public.app_users u ON u.auth_id = a.id OR LOWER(u.email) = LOWER(a.email)
WHERE LOWER(a.email) LIKE 'aulia@%'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  updated_at = now();

-- 3. Update trigger auto-sync untuk pengguna baru
CREATE OR REPLACE FUNCTION public.handle_pn_profil_sync()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.pn_profil (id, nama, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN LOWER(NEW.email) LIKE 'zulfan@%' OR LOWER(NEW.email) LIKE 'marsya@%' OR LOWER(NEW.email) LIKE 'aulia@%' THEN 'admin'
      ELSE 'staf'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

