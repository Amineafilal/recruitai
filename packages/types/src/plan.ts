import { z } from "zod";

export const PlanId = z.enum(["starter", "growth", "scale", "enterprise"]);
export type PlanId = z.infer<typeof PlanId>;

export interface PlanConfig {
  id: PlanId;
  label: string;
  priceMonthlyCents: number;
  maxRecruiters: number | null;
  maxActiveJobs: number | null;
  maxCvthequeProfiles: number | null;
  monthlyScrapeCreditsCap: number;
}

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  starter: {
    id: "starter",
    label: "Starter",
    priceMonthlyCents: 29900,
    maxRecruiters: 3,
    maxActiveJobs: 5,
    maxCvthequeProfiles: 10_000,
    monthlyScrapeCreditsCap: 2_000,
  },
  growth: {
    id: "growth",
    label: "Growth",
    priceMonthlyCents: 69900,
    maxRecruiters: 10,
    maxActiveJobs: 20,
    maxCvthequeProfiles: 50_000,
    monthlyScrapeCreditsCap: 8_000,
  },
  scale: {
    id: "scale",
    label: "Scale",
    priceMonthlyCents: 149900,
    maxRecruiters: 30,
    maxActiveJobs: null,
    maxCvthequeProfiles: null,
    monthlyScrapeCreditsCap: 25_000,
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    priceMonthlyCents: 0,
    maxRecruiters: null,
    maxActiveJobs: null,
    maxCvthequeProfiles: null,
    monthlyScrapeCreditsCap: 100_000,
  },
};
