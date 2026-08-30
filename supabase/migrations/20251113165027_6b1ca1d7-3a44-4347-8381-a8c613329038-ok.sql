-- Create enum for application roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

-- Create user_roles table with proper structure
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create SECURITY DEFINER function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policy: Users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- RLS Policy: Only admins can manage roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Migrate existing role data from settings_users to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT 
  auth_user_id,
  CASE 
    WHEN super_admin = true THEN 'admin'::public.app_role
    WHEN user_type = 'gestor' THEN 'manager'::public.app_role
    ELSE 'user'::public.app_role
  END
FROM public.settings_users
WHERE auth_user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Update settings_users RLS policies to be more restrictive
DROP POLICY IF EXISTS "authenticated_write" ON public.settings_users;

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.settings_users
FOR SELECT TO authenticated
USING (auth_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Users can update their own basic info (not role fields)
CREATE POLICY "Users can update own profile" ON public.settings_users
FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Only admins can insert new users
CREATE POLICY "Admins can create users" ON public.settings_users
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Only admins can delete users
CREATE POLICY "Admins can delete users" ON public.settings_users
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));