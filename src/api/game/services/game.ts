/**
 * game service
 */

import { factories } from "@strapi/strapi";
import axios from "axios";
import { JSDOM } from "jsdom";
import slugify from "slugify";
import qs from "querystring";

const gameService = "api::game.game";
const publisherService = "api::publisher.publisher";
const developerService = "api::developer.developer";
const categoryService = "api::category.category";
const platformService = "api::platform.platform";

const baseURl = "https://www.gog.com";

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function Exception(e) {
  return { e, data: e.data && e.data.errors && e.data.errors}
}

async function getGameInfo(slug) {
  try {
    const body = await axios.get(`${baseURl}/game/${slug}`);
  const dom = new JSDOM(body.data);

  const description = dom.window.document.querySelector(".description");

  return {
    rating: "BR0",
    short_description: description.textContent.slice(0, 160),
    description: description.innerHTML,
  };
  } catch (error) {
    console.log("getGameInfo:", Exception(error))
    
  }
}

async function getByName(name, entityService) {
  const item: any = await strapi.service(`${entityService}`).find({ name });

  return item.results.length ? item.results[0] : null;
}

async function create(name, entityService) {
  const item = await getByName(name, entityService);

  if (item === null) {
    return await strapi.service(`${entityService}`).create({
      data: {
        name,
        slug: slugify(name, { lower: true }),
        publishedAt: new Date(),
      },
    });
  }

  return item;
}

async function createManyToManyData(products) {
  const developers = {};
  const publishers = {};
  const categories = {};
  const platforms = {};

  products.forEach((product) => {
    const { developer, publisher, genres, supportedOperatingSystems } = product;

    genres &&
      genres.forEach((genre) => {
        categories[genre] = true;
      });
    supportedOperatingSystems &&
      supportedOperatingSystems.forEach((support) => {
        platforms[support] = true;
      });
    developers[developer] = true;
    publishers[publisher] = true;
  });

  return Promise.all([
    ...Object.keys(developers).map((name) => create(name, developerService)),
    ...Object.keys(publishers).map((name) => create(name, publisherService)),
    ...Object.keys(categories).map((name) => create(name, categoryService)),
    ...Object.keys(platforms).map((name) => create(name, platformService)),
  ]);
}

async function setImage({ image, game, field = "cover" }) {

  const url = `https:${image}_bg_crop_1680x655.jpg`;
  const { data } = await axios.get(url, { responseType: "arraybuffer" });
  const buffer = Buffer.from(data, "base64");

  const FormData = require('form-data')

  const formData: any = new FormData();

  formData.append("refId", game.id);
  formData.append("ref", `${gameService}`);
  formData.append("field", field);
  formData.append("files", buffer, { filename: `${game.slug}.jpg` });

  console.info(`Uploading ${field} image: ${game.slug}.jpg`);

  try {
    await axios({
      method: "POST",
      url: `http://localhost:1337/api/upload/`,
      data: formData,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
      },
    });
  } catch (error) {
    console.log("setImage:", Exception(error))
  }

  
}

async function createGames(products) {
  await Promise.all(
    products.map(async (product) => {
      const item = await getByName(product.title, gameService);

      if (item === null) {
        console.info(`Creating: ${product.title}...`);

        const game = await strapi.service(`${gameService}`).create({
          data: {
            name: product.title,
            slug: product.slug.replace(/_/g, "-"),
            price: product.price.amount,
            release_date: new Date(
              Number(product.globalReleaseDate) * 1000
            ).toISOString(),
            categories: await Promise.all(
              product.genres.map((name) => getByName(name, categoryService))
            ),
            platforms: await Promise.all(
              product.supportedOperatingSystems.map((name) =>
                getByName(name, platformService)
              )
            ),
            developers: [await getByName(product.developer, developerService)],
            publisher: await getByName(product.publisher, publisherService),
            ...(await getGameInfo(product.slug)),
            publishedAt: new Date(),
          },
        });

        await setImage({ image: product.image, game });
        await Promise.all(
          product.gallery.slice(0,5).map((url) => setImage({ image: url, game, field: 'gallery'}))
        )

        await timeout(2000)

        return game;
      }
    })
  );
}

export default factories.createCoreService(gameService, ({ strapi }) => ({
  async populate(params) {
    try {
      const gogApiURL = `${baseURl}/games/ajax/filtered?mediaType=game&${qs.stringify(params)}`;

    const {
      data: { products },
    } = await axios.get(gogApiURL);

    await createManyToManyData(products);

    await createGames(products);
    } catch (error) {
      console.log('populate:', Exception(error))
    }
    
  },
}));
