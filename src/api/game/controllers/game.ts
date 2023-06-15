/**
 * game controller
 */

import { factories } from "@strapi/strapi";

const gameService = "api::game.game";

export default factories.createCoreController(
  "api::game.game",
  ({ strapi }) => ({
    async populate(ctx) {
    
      const options = {
        sort: "popularity",
        page: "1",
        ...ctx.query
      }

      await strapi.service(gameService).populate(options);

      ctx.send("Finished populating!");
    },
  })
);
