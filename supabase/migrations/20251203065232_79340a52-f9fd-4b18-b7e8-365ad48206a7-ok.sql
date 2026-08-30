-- Add admin role to the super admin user
INSERT INTO user_roles (user_id, role)
VALUES ('cbc5162a-d420-40ab-9799-878a9d74de86', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Also add roles for other existing users that are super_admin
INSERT INTO user_roles (user_id, role)
SELECT auth_user_id, 'admin'
FROM settings_users
WHERE super_admin = true AND auth_user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;