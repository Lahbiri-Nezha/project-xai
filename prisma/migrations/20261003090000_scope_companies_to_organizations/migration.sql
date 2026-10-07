-- Legacy companies were shared globally. Clone them for each tenant before
-- making the tenant boundary mandatory, so existing lead relationships remain intact.
ALTER TABLE "Company" ADD COLUMN "organizationId" TEXT;

WITH memberships AS (
  SELECT DISTINCT ON (l."companyId") l."companyId", l."organizationId"
  FROM "Lead" l
  WHERE l."companyId" IS NOT NULL
  ORDER BY l."companyId", l."organizationId"
)
UPDATE "Company" c
SET "organizationId" = m."organizationId"
FROM memberships m
WHERE c.id = m."companyId";

UPDATE "Company"
SET "organizationId" = (SELECT id FROM "Organization" ORDER BY "createdAt" LIMIT 1)
WHERE "organizationId" IS NULL;

WITH copies AS (
  SELECT c.*, l."organizationId" AS target_org
  FROM "Company" c
  JOIN "Lead" l ON l."companyId" = c.id
  WHERE l."organizationId" <> c."organizationId"
  GROUP BY c.id, l."organizationId"
)
INSERT INTO "Company" (id, "organizationId", name, domain, industry, "employeeCount", "fundingStage", "fundingAmount", "revenueEstimate", "headquartersCity", "headquartersCountry", "techStack", "lastEnrichedAt", "lastVerifiedAt", raw, "createdAt", "updatedAt")
SELECT md5(id || ':' || target_org), target_org, name, domain, industry, "employeeCount", "fundingStage", "fundingAmount", "revenueEstimate", "headquartersCity", "headquartersCountry", "techStack", "lastEnrichedAt", "lastVerifiedAt", raw, "createdAt", "updatedAt"
FROM copies;

UPDATE "Lead" l
SET "companyId" = md5(l."companyId" || ':' || l."organizationId")
FROM "Company" original
WHERE original.id = l."companyId"
  AND original."organizationId" <> l."organizationId";

ALTER TABLE "Company" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Company" DROP CONSTRAINT IF EXISTS "Company_domain_key";
CREATE UNIQUE INDEX "Company_organizationId_domain_key" ON "Company"("organizationId", domain);
CREATE INDEX "Company_organizationId_name_idx" ON "Company"("organizationId", name);
