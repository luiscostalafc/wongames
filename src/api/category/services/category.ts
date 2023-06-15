/**
 * category service
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreService(
  "api::category.category",
  ({ strapi }) => ({
    async find(params) {
      const { results, pagination } = await super.find(params);

      return { results, pagination };
    },
  })
);
