-- Reprise des candidats faussement notés 0.
--
-- Signature exacte du défaut : les QUATRE critères sont null — donc rien
-- n'était évaluable — alors que le score enregistré vaut 0. Le calcul renvoyait
-- 0 par défaut faute de critère, ce qui revenait à affirmer que le candidat
-- avait été jugé mauvais.
--
-- La condition est volontairement étroite : un candidat à 0 dont au moins un
-- critère porte une note est un vrai 0 (la compétence exigée est absente du
-- profil) et ne doit surtout pas être touché.
UPDATE "sourcing_candidates"
SET "score" = NULL,
    "statut_scoring" = 'non_evaluable',
    "scoring_erreur" = 'Profil trop incomplet pour être noté : la source n''a renvoyé aucune donnée exploitable.'
WHERE "score" = 0
  AND "statut_scoring" = 'ok'
  AND "scoring_criteres" IS NOT NULL
  AND "scoring_criteres"->'competences'->>'note' IS NULL
  AND "scoring_criteres"->'experience'->>'note' IS NULL
  AND "scoring_criteres"->'seniorite'->>'note' IS NULL
  AND "scoring_criteres"->'localisation'->>'note' IS NULL;
