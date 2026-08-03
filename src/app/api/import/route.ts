import { NextRequest, NextResponse } from "next/server";
import { requireSession, getOrganizationId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { checkLeadQuota } from "@/lib/plan-limits";
import { sendEvent } from "@/lib/inngest/client";
import { scoreLead } from "@/lib/ai/scoring";
import { enrichCompany } from "@/lib/ai/enrichment";

export const runtime = "nodejs";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function normalizeHeader(h: string): string {
  const k = h.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    email: "email",
    e_mail: "email",
    mail: "email",
    prénom: "firstName",
    prenom: "firstName",
    first_name: "firstName",
    firstname: "firstName",
    nom: "lastName",
    last_name: "lastName",
    lastname: "lastName",
    poste: "title",
    title: "title",
    fonction: "title",
    téléphone: "phone",
    telephone: "phone",
    phone: "phone",
    société: "company",
    societe: "company",
    entreprise: "company",
    company: "company",
    ville: "city",
    city: "city",
    secteur: "industry",
    industry: "industry",
  };
  return map[k] ?? k;
}

function domainFromEmail(email: string | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).toLowerCase();
}

function slugDomain(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

export async function POST(request: NextRequest) {
  let orgId: string;
  try {
    await requireSession();
    orgId = await getOrganizationId();
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier CSV manquant (champ 'file')" }, { status: 400 });
  }
  const text = await file.text();

  const quota = await checkLeadQuota(orgId);
  if (!quota.allowed) {
    return NextResponse.json({ error: "Quota de leads atteint pour ce plan" }, { status: 403 });
  }

  const rows = parseCsv(text);
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV vide (entête + au moins une ligne)" }, { status: 400 });
  }

  const headers = rows[0].map(normalizeHeader);
  const col = (header: string) => headers.indexOf(header);

  const created: string[] = [];
  const errors: string[] = [];
  const companyIds = new Set<string>();
  const leadIds: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (header: string) => (col(header) >= 0 ? r[col(header)]?.trim() ?? "" : "");

    const email = get("email");
    const companyName = get("company");
    const firstName = get("firstName");
    const lastName = get("lastName");

    if (!email && !companyName) {
      errors.push(`ligne ${i + 1}: ni email ni société`);
      continue;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`ligne ${i + 1}: email invalide (${email})`);
      continue;
    }

    const domain = domainFromEmail(email) ?? (companyName ? `${slugDomain(companyName)}.local` : null);
    let companyId: string | null = null;
    if (companyName) {
      const existing = domain
        ? await prisma.company.findFirst({
            where: { OR: [{ domain }, { name: { equals: companyName, mode: "insensitive" } }] },
            select: { id: true },
          })
        : await prisma.company.findFirst({
            where: { name: { equals: companyName, mode: "insensitive" } },
            select: { id: true },
          });
      if (existing) {
        companyId = existing.id;
      } else {
        const company = await prisma.company.create({
          data: {
            name: companyName,
            domain,
            industry: get("industry") || undefined,
            headquartersCity: get("city") || undefined,
            headquartersCountry: get("country") || "Maroc",
          },
        });
        companyId = company.id;
        companyIds.add(company.id);
      }
    }

    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: email || undefined,
        phone: get("phone") || undefined,
        title: get("title") || undefined,
        companyId,
      },
    });
    created.push(lead.email ?? lead.id);
    leadIds.push(lead.id);
  }

  if (leadIds.length > 0) {
    await sendEvent(
      "leads.created",
      { leadIds },
      async () => {
        for (const id of leadIds) await scoreLead(id);
      }
    );
  }
  if (companyIds.size > 0) {
    for (const id of companyIds) {
      await sendEvent(
        "companies.created",
        { companyId: id },
        async () => {
          await enrichCompany(id);
        }
      );
    }
  }

  return NextResponse.json({
    imported: created.length,
    errors,
    remaining: quota.remaining >= 0 ? Math.max(0, quota.remaining - created.length) : undefined,
  });
}
