-- Troisième issue possible de la notation : le profil ne contenait rien à
-- noter. Auparavant ces candidats étaient enregistrés avec un score de 0,
-- c'est-à-dire jugés nuls, alors qu'ils n'avaient tout simplement pas été
-- jugés.
--
-- ALTER TYPE ... ADD VALUE est accepté dans une transaction depuis
-- PostgreSQL 12, à condition de ne pas utiliser la nouvelle valeur dans la
-- même transaction. La reprise des lignes existantes est donc faite à part
-- (voir 0011).
ALTER TYPE "public"."scoring_status" ADD VALUE IF NOT EXISTS 'non_evaluable';
