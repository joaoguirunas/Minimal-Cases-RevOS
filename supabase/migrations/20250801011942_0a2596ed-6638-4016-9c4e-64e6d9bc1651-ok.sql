-- Create a PostgreSQL function to execute raw SQL for performance optimization
CREATE OR REPLACE FUNCTION execute_sql(sql_query text, params json DEFAULT '[]'::json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- This function is for internal use only and should be secured
  -- Execute the query and return results as JSON
  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || sql_query || ') t' 
  INTO result 
  USING VARIADIC ARRAY(SELECT json_array_elements_text(params));
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;