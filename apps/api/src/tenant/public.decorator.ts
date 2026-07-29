import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
/** Marque une route comme non soumise à la résolution tenant (ex: /health, webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
