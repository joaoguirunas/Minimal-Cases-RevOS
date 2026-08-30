-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS users_select_policy ON settings_users;

-- Create a simpler policy that allows all authenticated users to read all users
CREATE POLICY "users_select_all_authenticated" 
ON settings_users 
FOR SELECT 
TO authenticated
USING (true);