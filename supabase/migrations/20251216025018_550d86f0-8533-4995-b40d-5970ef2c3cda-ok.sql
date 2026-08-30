-- Fix RLS policies for projects table to include is_admin_or_gestor()
DROP POLICY IF EXISTS "projects_select_team_member" ON projects;
CREATE POLICY "projects_select_team_member" ON projects
FOR SELECT USING (
  is_admin_or_gestor() OR is_team_member(team_id)
);

DROP POLICY IF EXISTS "projects_update_team_member" ON projects;
CREATE POLICY "projects_update_team_member" ON projects
FOR UPDATE USING (
  is_admin_or_gestor() OR is_team_admin_or_member(team_id)
) WITH CHECK (
  is_admin_or_gestor() OR is_team_admin_or_member(team_id)
);

DROP POLICY IF EXISTS "projects_delete_admin" ON projects;
CREATE POLICY "projects_delete_admin" ON projects
FOR DELETE USING (
  is_admin_or_gestor() OR is_team_admin(team_id)
);

DROP POLICY IF EXISTS "projects_insert_team_member" ON projects;
CREATE POLICY "projects_insert_team_member" ON projects
FOR INSERT WITH CHECK (
  is_admin_or_gestor() OR is_team_admin_or_member(team_id)
);

-- Fix RLS policies for project_documents table
DROP POLICY IF EXISTS "documents_select_team_member" ON project_documents;
CREATE POLICY "documents_select_team_member" ON project_documents
FOR SELECT USING (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id AND is_team_member(p.team_id)
  )
);

DROP POLICY IF EXISTS "documents_insert_team_member" ON project_documents;
CREATE POLICY "documents_insert_team_member" ON project_documents
FOR INSERT WITH CHECK (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id AND is_team_admin_or_member(p.team_id)
  )
);

DROP POLICY IF EXISTS "documents_update_team_member" ON project_documents;
CREATE POLICY "documents_update_team_member" ON project_documents
FOR UPDATE USING (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id AND is_team_admin_or_member(p.team_id)
  )
) WITH CHECK (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id AND is_team_admin_or_member(p.team_id)
  )
);

DROP POLICY IF EXISTS "documents_delete_team_member" ON project_documents;
CREATE POLICY "documents_delete_team_member" ON project_documents
FOR DELETE USING (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id AND is_team_admin_or_member(p.team_id)
  )
);

-- Fix RLS policies for project_comments table
DROP POLICY IF EXISTS "comments_select_team_member" ON project_comments;
CREATE POLICY "comments_select_team_member" ON project_comments
FOR SELECT USING (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_comments.project_id AND is_team_member(p.team_id)
  )
);

DROP POLICY IF EXISTS "comments_insert_team_member" ON project_comments;
CREATE POLICY "comments_insert_team_member" ON project_comments
FOR INSERT WITH CHECK (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_comments.project_id AND is_team_admin_or_member(p.team_id)
  )
);

-- Fix RLS policies for project_meetings table
DROP POLICY IF EXISTS "meetings_select_team_member" ON project_meetings;
CREATE POLICY "meetings_select_team_member" ON project_meetings
FOR SELECT USING (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_meetings.project_id AND is_team_member(p.team_id)
  )
);

DROP POLICY IF EXISTS "meetings_insert_team_member" ON project_meetings;
CREATE POLICY "meetings_insert_team_member" ON project_meetings
FOR INSERT WITH CHECK (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_meetings.project_id AND is_team_admin_or_member(p.team_id)
  )
);

DROP POLICY IF EXISTS "meetings_update_team_member" ON project_meetings;
CREATE POLICY "meetings_update_team_member" ON project_meetings
FOR UPDATE USING (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_meetings.project_id AND is_team_admin_or_member(p.team_id)
  )
) WITH CHECK (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_meetings.project_id AND is_team_admin_or_member(p.team_id)
  )
);

DROP POLICY IF EXISTS "meetings_delete_team_member" ON project_meetings;
CREATE POLICY "meetings_delete_team_member" ON project_meetings
FOR DELETE USING (
  is_admin_or_gestor() OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_meetings.project_id AND is_team_admin_or_member(p.team_id)
  )
);