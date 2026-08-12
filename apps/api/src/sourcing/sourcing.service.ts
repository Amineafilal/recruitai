import { Injectable, Logger, NotFoundException, ForbiddenException } from "@nestjs/common";
import { desc, eq, and, sql } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import {
  PIPELINE_LABELS,
  statutValidationPour,
  type PipelineStage,
  type ValidationStatus,
} from "@recruitai/types";
import type { TimelineEvent } from "./timeline.types.js";

/** Libellés lisibles des étapes, pour les phrases de la timeline. */
const LIBELLES_ETAPE = PIPELINE_LABELS;

@Injectable()
export class SourcingService {
  private readonly logger = new Logger(SourcingService.name);

  /**
   * Combien de candidats attendent une décision, et depuis combien de temps.
   *
   * Le seuil de 48 h n'est pas arbitraire : un candidat sourcé ce matin n'est
   * pas « oublié », et alerter dès la première heure banaliserait le signal au
   * point qu'on cesserait de le voir. Deux jours, c'est le moment où le
   * recruteur a objectivement laissé passer son tour.
   */
  async candidatsEnAttente(tenantId: string): Promise<{ total: number; depasses: number }> {
    return withTenant(tenantId, async (tx) => {
      const [r] = await tx
        .select({
          total: sql<number>`count(*)::int`,
          depasses: sql<number>`count(*) filter (where ${schema.sourcingCandidates.createdAt} < now() - interval '48 hours')::int`,
        })
        .from(schema.sourcingCandidates)
        .where(
          and(
            eq(schema.sourcingCandidates.tenantId, tenantId),
            eq(schema.sourcingCandidates.statutValidation, "a_valider"),
          ),
        );
      return { total: r?.total ?? 0, depasses: r?.depasses ?? 0 };
    });
  }

  async shortlist(tenantId: string, jobId: string) {
    const lignes = await withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(schema.sourcingCandidates)
        .where(and(eq(schema.sourcingCandidates.tenantId, tenantId), eq(schema.sourcingCandidates.jobId, jobId)))
        // `nulls last` est indispensable : en tri décroissant Postgres place
        // les NULL en tête, ce qui ferait remonter les candidats non notés
        // au-dessus des meilleurs profils.
        .orderBy(sql`${schema.sourcingCandidates.score} desc nulls last`),
    );

    // Dernier filet, derrière l'index d'unicité de la migration 0012.
    //
    // Il ne devrait jamais servir : si c'est le cas, l'index a été contourné
    // ou perdu, et c'est un incident à corriger — d'où l'avertissement plutôt
    // qu'un dédoublonnage muet. Un filtre silencieux ferait disparaître le
    // symptôme en laissant la cause s'installer.
    const vus = new Set<string>();
    const uniques = lignes.filter((c) => {
      const url = (c.profil as { linkedinUrl?: unknown } | null)?.linkedinUrl;
      if (typeof url !== "string" || !url) return true;
      const cle = url.toLowerCase();
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });

    if (uniques.length !== lignes.length) {
      this.logger.error(
        `Doublons en base sur le poste ${jobId} : ${lignes.length - uniques.length} masqué(s) à ` +
          `l'affichage. L'index sourcing_candidates_job_profil_idx est absent ou contourné.`,
      );
    }
    return uniques;
  }

  /**
   * Fiche complète d'un candidat : le profil brut, le poste auquel il est
   * rattaché (pour l'ariane et le rappel des critères) et l'historique des
   * notes de l'équipe.
   */
  async candidat(tenantId: string, candidateId: string) {
    return withTenant(tenantId, async (tx) => {
      const [candidat] = await tx
        .select()
        .from(schema.sourcingCandidates)
        .where(eq(schema.sourcingCandidates.id, candidateId));
      if (!candidat) throw new NotFoundException(`Candidat ${candidateId} introuvable`);

      const [poste] = await tx.select().from(schema.jobs).where(eq(schema.jobs.id, candidat.jobId));
      const notes = await tx
        .select()
        .from(schema.candidateNotes)
        .where(eq(schema.candidateNotes.candidateId, candidateId))
        .orderBy(desc(schema.candidateNotes.createdAt));

      return { candidat, poste: poste ?? null, notes };
    });
  }

  /**
   * Déplace un candidat dans le pipeline et journalise le mouvement.
   *
   * Aucune transition n'est interdite : un recruteur doit pouvoir corriger une
   * erreur de manipulation en ramenant un candidat en arrière, et les
   * parcours réels sautent régulièrement des étapes (un candidat recommandé
   * passe directement en entretien).
   */
  async deplacerEtape(
    tenantId: string,
    candidateId: string,
    etape: PipelineStage,
    acteurUserId: string,
    commentaire?: string,
  ) {
    return withTenant(tenantId, async (tx) => {
      const [candidat] = await tx
        .select()
        .from(schema.sourcingCandidates)
        .where(eq(schema.sourcingCandidates.id, candidateId));
      if (!candidat) throw new NotFoundException(`Candidat ${candidateId} introuvable`);

      // Déplacement vers l'étape déjà courante : on ne journalise pas, sinon
      // un glisser-déposer relâché au même endroit polluerait l'historique.
      if (candidat.etape === etape) return candidat;

      const [updated] = await tx
        .update(schema.sourcingCandidates)
        .set({
          etape,
          // L'ancien champ reste cohérent tant qu'il n'est pas supprimé.
          statutValidation: statutValidationPour(etape),
        })
        .where(eq(schema.sourcingCandidates.id, candidateId))
        .returning();

      // Email dénormalisé sur l'événement : l'historique doit rester lisible
      // même après le départ du collègue (la FK passe alors à null).
      const [auteur] = await tx
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, acteurUserId));

      await tx.insert(schema.candidateStageEvents).values({
        tenantId,
        candidateId,
        etapeAvant: candidat.etape,
        etapeApres: etape,
        auteurUserId: acteurUserId,
        auteurEmail: auteur?.email ?? "inconnu",
        commentaire: commentaire?.trim() || null,
      });

      return updated;
    });
  }

  /**
   * Timeline complète d'un candidat : tout ce qui lui est arrivé, du plus
   * récent au plus ancien.
   *
   * Agrégation à la lecture plutôt que table unique : chaque source garde ses
   * règles propres (les notes sont supprimables, les mouvements d'étape sont
   * un journal immuable). Le volume par candidat se compte en dizaines
   * d'événements, la fusion en mémoire est donc largement suffisante.
   */
  async timeline(tenantId: string, candidateId: string): Promise<TimelineEvent[]> {
    return withTenant(tenantId, async (tx) => {
      const [candidat] = await tx
        .select()
        .from(schema.sourcingCandidates)
        .where(eq(schema.sourcingCandidates.id, candidateId));
      if (!candidat) throw new NotFoundException(`Candidat ${candidateId} introuvable`);

      const [etapes, notes, activites] = await Promise.all([
        tx
          .select()
          .from(schema.candidateStageEvents)
          .where(eq(schema.candidateStageEvents.candidateId, candidateId)),
        tx.select().from(schema.candidateNotes).where(eq(schema.candidateNotes.candidateId, candidateId)),
        tx
          .select()
          .from(schema.candidateActivities)
          .where(eq(schema.candidateActivities.candidateId, candidateId)),
      ]);

      const evenements: TimelineEvent[] = [];

      // 1. Entrée dans la base — toujours le premier événement.
      evenements.push({
        id: `sourcing-${candidat.id}`,
        type: "sourcing",
        resume:
          candidat.statutScoring === "echec"
            ? `Candidat sourcé sur ${candidat.source} — scoring impossible`
            : `Candidat sourcé sur ${candidat.source} et noté ${candidat.score}/100`,
        details: candidat.scoringJustification,
        auteurEmail: "agent IA",
        auteurUserId: null,
        horodatage: candidat.createdAt.toISOString(),
        meta: { score: candidat.score, source: candidat.source },
        supprimable: false,
      });

      // 2. Mouvements de pipeline. L'événement de reprise (etapeAvant null)
      // fait doublon avec le sourcing ci-dessus : on l'écarte.
      for (const e of etapes) {
        if (e.etapeAvant === null) continue;
        evenements.push({
          id: e.id,
          type: "etape",
          resume: `${LIBELLES_ETAPE[e.etapeAvant]} → ${LIBELLES_ETAPE[e.etapeApres]}`,
          details: e.commentaire,
          auteurEmail: e.auteurEmail,
          auteurUserId: e.auteurUserId,
          horodatage: e.createdAt.toISOString(),
          meta: { avant: e.etapeAvant, apres: e.etapeApres },
          supprimable: false,
        });
      }

      // 3. Notes de l'équipe.
      for (const n of notes) {
        evenements.push({
          id: n.id,
          type: "note",
          resume: "Note ajoutée",
          details: n.contenu,
          auteurEmail: n.auteurEmail,
          auteurUserId: n.auteurUserId,
          horodatage: n.createdAt.toISOString(),
          supprimable: true,
        });
      }

      // 4. Activités (score recalculé, appels, emails).
      for (const a of activites) {
        evenements.push({
          id: a.id,
          type: a.type,
          resume: a.resume,
          details: a.details,
          auteurEmail: a.auteurEmail,
          auteurUserId: a.auteurUserId,
          horodatage: a.createdAt.toISOString(),
          meta: a.meta as Record<string, unknown> | null,
          supprimable: false,
        });
      }

      return evenements.sort((a, b) => b.horodatage.localeCompare(a.horodatage));
    });
  }

  /** Consigne un appel passé au candidat. */
  async loggerAppel(
    tenantId: string,
    candidateId: string,
    acteurUserId: string,
    resume: string,
    details?: string,
  ) {
    return withTenant(tenantId, async (tx) => {
      const [candidat] = await tx
        .select({ id: schema.sourcingCandidates.id })
        .from(schema.sourcingCandidates)
        .where(eq(schema.sourcingCandidates.id, candidateId));
      if (!candidat) throw new NotFoundException(`Candidat ${candidateId} introuvable`);

      const [auteur] = await tx
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, acteurUserId));

      const [activite] = await tx
        .insert(schema.candidateActivities)
        .values({
          tenantId,
          candidateId,
          type: "appel",
          resume,
          details: details?.trim() || null,
          auteurUserId: acteurUserId,
          auteurEmail: auteur?.email ?? "inconnu",
        })
        .returning();
      return activite;
    });
  }

  /** Historique des mouvements d'un candidat, du plus récent au plus ancien. */
  async historique(tenantId: string, candidateId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(schema.candidateStageEvents)
        .where(eq(schema.candidateStageEvents.candidateId, candidateId))
        .orderBy(desc(schema.candidateStageEvents.createdAt)),
    );
  }

  /**
   * @deprecated Remplacé par deplacerEtape. Conservé le temps que tous les
   * appelants soient migrés vers le pipeline.
   */
  async setValidation(tenantId: string, candidateId: string, statut: ValidationStatus) {
    const etape: PipelineStage = statut === "valide" ? "retenu" : statut === "rejete" ? "rejete" : "a_valider";
    return withTenant(tenantId, async (tx) => {
      const [updated] = await tx
        .update(schema.sourcingCandidates)
        .set({ statutValidation: statut, etape })
        .where(eq(schema.sourcingCandidates.id, candidateId))
        .returning();
      if (!updated) throw new NotFoundException(`Candidat ${candidateId} introuvable`);
      return updated;
    });
  }

  async ajouterNote(tenantId: string, candidateId: string, auteurUserId: string, contenu: string) {
    return withTenant(tenantId, async (tx) => {
      // Vérifie l'existence du candidat DANS le tenant avant d'écrire : sans
      // ça, une note pourrait être créée en référence à un id inexistant et
      // la FK ferait remonter une erreur Postgres brute au lieu d'un 404.
      const [candidat] = await tx
        .select({ id: schema.sourcingCandidates.id })
        .from(schema.sourcingCandidates)
        .where(eq(schema.sourcingCandidates.id, candidateId));
      if (!candidat) throw new NotFoundException(`Candidat ${candidateId} introuvable`);

      // L'email est dénormalisé sur la note pour rester lisible même après le
      // départ du collègue (la FK passe alors à null).
      const [auteur] = await tx
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, auteurUserId));

      const [note] = await tx
        .insert(schema.candidateNotes)
        .values({
          tenantId,
          candidateId,
          auteurUserId,
          auteurEmail: auteur?.email ?? "inconnu",
          contenu,
        })
        .returning();
      return note;
    });
  }

  /** Une note ne peut être supprimée que par son auteur ou par un admin. */
  async supprimerNote(
    tenantId: string,
    noteId: string,
    acteur: { userId: string; role: string },
  ): Promise<void> {
    await withTenant(tenantId, async (tx) => {
      const [note] = await tx.select().from(schema.candidateNotes).where(eq(schema.candidateNotes.id, noteId));
      if (!note) throw new NotFoundException("Note introuvable");
      if (note.auteurUserId !== acteur.userId && acteur.role !== "admin") {
        throw new ForbiddenException("Vous ne pouvez supprimer que vos propres notes.");
      }
      await tx.delete(schema.candidateNotes).where(eq(schema.candidateNotes.id, noteId));
    });
  }
}
