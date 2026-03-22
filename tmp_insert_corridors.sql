INSERT INTO "Corridor" ("id", "code", "name", "status", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'FR_CM', 'France -> Cameroun', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CM_FR', 'Cameroun -> France', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'FR_CI', 'France -> Côte d''Ivoire', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CI_FR', 'Côte d''Ivoire -> France', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'FR_SN', 'France -> Sénégal', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'SN_FR', 'Sénégal -> France', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'DE_CM', 'Allemagne -> Cameroun', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CA_CM', 'Canada -> Cameroun', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;