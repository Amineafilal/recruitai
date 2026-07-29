import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { withTenant } from "@recruitai/db";

export interface DashboardData {
  postesOuverts: number;
  postesTotal: number;
  candidatsTotal: number;
  candidatsAValider: number;
  candidatsValides: number;
  candidatsRejetes: number;
  /** Candidats déjà validés ou rejetés — dénominateur du taux de validation. */
  candidatsTraites: number;
  /** Candidats que l'IA n'a pas pu noter. */
  candidatsNonNotes: number;
  cvthequeTotal: number;
  cvthequeChauds: number;
  campagnesActives: number;
  scoreMoyen: number;
  parJour: { jour: string; n: number }[];
  parSource: { source: string; n: number }[];
  recents: {
    id: string;
    nom: string;
    titre: string;
    score: number | null;
    source: string;
    statut: string;
  }[];
}

@Injectable()
export class DashboardService {
  async data(tenantId: string): Promise<DashboardData> {
    return withTenant(tenantId, async (tx) => {
      const [postes] = await tx.execute<{ total: number; ouverts: number }>(
        sql`select count(*)::int as total, count(*) filter (where statut='ouvert')::int as ouverts from jobs where tenant_id = ${tenantId}`,
      );
      // `traites` = candidats sur lesquels le recruteur s'est prononcé.
      // Le taux de validation se calcule sur cette base et non sur le total :
      // rapporté à l'ensemble, il resterait proche de 0 % tant que la pile
      // « à valider » grossit, ce qui ne mesure plus la qualité du sourcing
      // mais seulement le retard de traitement.
      //
      // La moyenne ignore nativement les scores NULL (échecs de scoring), ce
      // qui est le comportement voulu : un profil non noté ne doit pas tirer
      // la moyenne vers le bas.
      const [cands] = await tx.execute<{
        total: number;
        a_valider: number;
        valides: number;
        rejetes: number;
        traites: number;
        non_notes: number;
        moy: number;
      }>(
        sql`select count(*)::int as total,
                   count(*) filter (where statut_validation='a_valider')::int as a_valider,
                   count(*) filter (where statut_validation='valide')::int as valides,
                   count(*) filter (where statut_validation='rejete')::int as rejetes,
                   count(*) filter (where statut_validation in ('valide','rejete'))::int as traites,
                   count(*) filter (where statut_scoring='echec')::int as non_notes,
                   coalesce(round(avg(score))::int,0) as moy
            from sourcing_candidates where tenant_id = ${tenantId}`,
      );
      const [cv] = await tx.execute<{ total: number; chauds: number }>(
        sql`select count(*)::int as total, count(*) filter (where statut_chaud)::int as chauds from cvtheque_profiles where tenant_id = ${tenantId}`,
      );
      const [camp] = await tx.execute<{ actives: number }>(
        sql`select count(*) filter (where statut='actif')::int as actives from campaigns where tenant_id = ${tenantId}`,
      );

      // 14 derniers jours : candidats sourcés par jour.
      const parJourRows = await tx.execute<{ jour: string; n: number }>(
        sql`select to_char(d::date,'DD/MM') as jour, coalesce(c.n,0)::int as n
            from generate_series(current_date - interval '13 days', current_date, interval '1 day') d
            left join (
              select created_at::date as j, count(*) as n
              from sourcing_candidates where tenant_id = ${tenantId} group by 1
            ) c on c.j = d::date
            order by d`,
      );

      const parSourceRows = await tx.execute<{ source: string; n: number }>(
        sql`select source, count(*)::int as n from sourcing_candidates where tenant_id = ${tenantId} group by source order by n desc`,
      );

      const recentsRows = await tx.execute<{
        id: string;
        score: number | null;
        source: string;
        statut: string;
        prenom: string;
        nom: string;
        titre: string;
      }>(
        sql`select id, score, source, statut_validation as statut,
                   profil->>'firstName' as prenom, profil->>'lastName' as nom,
                   profil#>>'{currentPositions,0,title}' as titre
            from sourcing_candidates where tenant_id = ${tenantId}
            order by created_at desc limit 8`,
      );

      return {
        postesOuverts: postes?.ouverts ?? 0,
        postesTotal: postes?.total ?? 0,
        candidatsTotal: cands?.total ?? 0,
        candidatsAValider: cands?.a_valider ?? 0,
        candidatsValides: cands?.valides ?? 0,
        candidatsRejetes: cands?.rejetes ?? 0,
        candidatsTraites: cands?.traites ?? 0,
        candidatsNonNotes: cands?.non_notes ?? 0,
        cvthequeTotal: cv?.total ?? 0,
        cvthequeChauds: cv?.chauds ?? 0,
        campagnesActives: camp?.actives ?? 0,
        scoreMoyen: cands?.moy ?? 0,
        parJour: parJourRows.map((r) => ({ jour: r.jour, n: r.n })),
        parSource: parSourceRows.map((r) => ({ source: r.source, n: r.n })),
        recents: recentsRows.map((r) => ({
          id: r.id,
          nom: [r.prenom, r.nom].filter(Boolean).join(" ") || "Candidat",
          titre: r.titre ?? "",
          score: r.score,
          source: r.source,
          statut: r.statut,
        })),
      };
    });
  }
}
