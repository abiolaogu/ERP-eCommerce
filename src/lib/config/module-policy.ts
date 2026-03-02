import { env, type AuthPolicy } from "@/lib/config/env";

export const modulePolicy = {
  name: "ERP-eCommerce",
  slug: "ecommerce",
  authPolicy: env.authPolicy as AuthPolicy,
  notes: "",
  altUrls: "",
};
