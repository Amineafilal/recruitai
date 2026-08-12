-- Un même candidat ne peut plus apparaître deux fois dans une shortlist.
--
-- Relancer une recherche réinsérait l'intégralité des résultats : le poste
-- « Commercial » comptait quatre doublons sur vingt-huit candidats, tous créés
-- à deux minutes d'intervalle. Le recruteur évaluait deux fois la même
-- personne, et les statistiques du poste comptaient double.

-- 1) Reprise des doublons existants.
--
-- Le choix de la ligne conservée n'est pas anodin : candidate_notes,
-- candidate_activities et candidate_stage_events pointent vers le candidat en
-- ON DELETE CASCADE. Supprimer la mauvaise effacerait le travail du
-- recruteur — notes, historique de pipeline, timeline.
--
-- On garde donc, dans l'ordre :
--   1. celle qui porte une décision (validée ou rejetée), jamais à jeter ;
--   2. celle qui porte le plus d'historique ;
--   3. à égalité, la plus ancienne — c'est elle que le recruteur a vue.
WITH classees AS (
  SELECT
    c.id,
    row_number() OVER (
      PARTITION BY c.job_id, lower(c.profil->>'linkedinUrl')
      ORDER BY
        (c.statut_validation <> 'a_valider') DESC,
        (
          (SELECT count(*) FROM candidate_notes n WHERE n.candidate_id = c.id) +
          (SELECT count(*) FROM candidate_activities a WHERE a.candidate_id = c.id) +
          (SELECT count(*) FROM candidate_stage_events e WHERE e.candidate_id = c.id)
        ) DESC,
        c.created_at ASC
    ) AS rang
  FROM sourcing_candidates c
  WHERE c.profil->>'linkedinUrl' IS NOT NULL
)
DELETE FROM sourcing_candidates
WHERE id IN (SELECT id FROM classees WHERE rang > 1);

-- 2) Garde-fou permanent.
--
-- Index PARTIEL : les profils sans URL LinkedIn — ceux d'anciennes sources ou
-- d'imports — n'ont pas d'identifiant fiable, et les contraindre reviendrait à
-- refuser des candidats légitimes. lower() parce que LinkedIn renvoie parfois
-- la même URL avec une casse différente.
CREATE UNIQUE INDEX IF NOT EXISTS sourcing_candidates_job_profil_idx
  ON sourcing_candidates (job_id, lower(profil->>'linkedinUrl'))
  WHERE profil->>'linkedinUrl' IS NOT NULL;
