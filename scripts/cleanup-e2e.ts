import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const E2E_COMPANIES = ["E2E Corp", "E2E Import SARL", "E2E Import 2 SARL"];

export async function cleanupE2E() {
  dotenv.config({ path: ".env" });
  const p = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    const leads = await p.lead.deleteMany({
      where: { email: { startsWith: "e2e-" } },
    });
    const companies = await p.company.deleteMany({
      where: { name: { in: E2E_COMPANIES }, leads: { none: {} } },
    });
    const [totalLeads, totalCompanies] = await Promise.all([
      p.lead.count(),
      p.company.count(),
    ]);
    console.log(
      `[cleanup:e2e] leads supprimés: ${leads.count}, comptes supprimés: ${companies.count} ` +
        `| base: ${totalLeads} leads / ${totalCompanies} comptes`
    );
  } finally {
    await p.$disconnect();
  }
}

if (pathToFileURL(process.argv[1] ?? "").href === import.meta.url) {
  cleanupE2E().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
