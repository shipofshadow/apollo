UPDATE roles
SET permissions_json = JSON_ARRAY_APPEND(permissions_json, '$', 'chatbot:manage')
WHERE role_key IN ('admin')
  AND JSON_VALID(permissions_json)
  AND JSON_CONTAINS(permissions_json, JSON_QUOTE('chatbot:manage')) = 0;
