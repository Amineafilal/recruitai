import { z } from "zod";
import { SignalType } from "./candidate.js";

export const CampaignTrigger = z.union([SignalType, z.literal("manuel")]);
export type CampaignTrigger = z.infer<typeof CampaignTrigger>;

export const CampaignInputSchema = z.object({
  nom: z.string().min(1),
  sujet: z.string().min(1),
  template: z.string().min(1),
  declencheur: CampaignTrigger,
  delaiMinRelanceJours: z.number().int().positive().default(90),
});
export type CampaignInput = z.infer<typeof CampaignInputSchema>;

export const OutreachStatus = z.enum(["envoye", "echec", "bloque_opt_out"]);
export type OutreachStatus = z.infer<typeof OutreachStatus>;

/** Variables autorisées dans un template de relance. */
export const TEMPLATE_VARIABLES = [
  "prenom",
  "nom",
  "poste",
  "entreprise",
  "localisation",
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
