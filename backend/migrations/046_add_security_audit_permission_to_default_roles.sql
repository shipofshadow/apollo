UPDATE roles
SET permissions_json = JSON_ARRAY_APPEND(permissions_json, '$', 'security:audit:view')
WHERE role_key IN ('admin', 'manager')
  AND JSON_VALID(permissions_json)
  AND JSON_CONTAINS(permissions_json, JSON_QUOTE('security:audit:view')) = 0;