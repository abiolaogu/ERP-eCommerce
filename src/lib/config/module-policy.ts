import { env, type AuthPolicy } from "@/lib/config/env";

export const modulePolicy = {
  name: "ERP-eCommerce",
  slug: "ecommerce",
  authPolicy: env.authPolicy as AuthPolicy,
  notes: "Demo-token fallback preserved for local development.",
  altUrls: "none",
};
