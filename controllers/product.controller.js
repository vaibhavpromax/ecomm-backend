const { response } = require("express");
const db = require("../db/models");
const addImagetoProduct = require("../helpers/addImageToProduct");

const logger = require("../utils/logger");
const { serverErrorResponse, successResponse } = require("../utils/response");
const addProductToStripe = require("../services/stripe/addProductToStripe");
const addPriceToStripe = require("../services/stripe/addPriceToStripe");
const updateStripePrice = require("../services/stripe/updateStripePrice");

const Product = db.Product;

const Review = db.Review;

const getProducts = async (req, res) => {
  try {
    const products = await Product.findAll();
    return successResponse(res, "all products fetched successfully", products);
  } catch (err) {
    logger.error(`Error while fetching products ${err}`);
    return serverErrorResponse(res, "Error while fetching products");
  }
};

const getSingleProduct = async (req, res) => {
  const { product_id } = req.params;
  let review, product;
  try {
    await Product.findOne({
      where: {
        product_id: product_id,
      },
    }).then(async (dbValue) => {
      product = dbValue.dataValues;
      review = await Review.findAll({
        where: {
          product_id: product_id,
        },
      });
    });

    return successResponse(res, "product fetched successfully", {
      product,
      review,
    });
  } catch (err) {
    logger.error(`Error while fetching product ${err}`);
    return serverErrorResponse(res, "Error while fetching product");
  }
};

const createProduct = async (req, res) => {
  const { name, description, price, category, inventory_quantity } = req.body;
  try {
    const product = await Product.create({
      name,
      description,
      price,
      category,
      inventory_quantity,
      image: "first",
    });

    //create product in stripe

    const [stripeProduct, stripeProductError] = await addProductToStripe(
      name,
      product.product_id
    );
    if (stripeProductError) {
      return serverErrorResponse(
        "Error while creating product in stripe",
        stripeProductError
      );
    }

    const [stripePrice, stripePriceError] = await addPriceToStripe(
      "usd",
      price,
      product.product_id
    );

    // add stripe price id to the db
    product.stripe_price_id = stripePrice.id;
    product.save();

    if (stripePriceError) {
      return serverErrorResponse(
        "Error while creating price in stripe",
        stripePriceError
      );
    }
    //add the price in stripe

    return successResponse(res, "product created successfully", product);
  } catch (err) {
    logger.error(`Error while creating product ${err} `);
    return serverErrorResponse(res, "Error while creating product");
  }
};

const deleteProduct = async (req, res) => {
  const { product_id } = req.params;
  try {
    const product = await Product.destroy({
      where: {
        product_id: product_id,
      },
    });
    return successResponse(res, "product deleted successfully", product);
  } catch (err) {
    logger.error(`Error while deleting product ${err} `);
    return serverErrorResponse(res, "Error while deleting product");
  }
};

const updateProduct = async (req, res) => {
  const { product_id } = req.params;
  const { name, description, price, category, inventory_quantity } = req.body;
  try {
    const product = await Product.update(
      {
        name,
        description,
        price,
        category,
        inventory_quantity,
      },
      {
        where: {
          product_id: product_id,
        },
      }
    );

    // if the price is updated
    if (price) {
      const [updatePriceStripe, updateStripePriceError] =
        await updateStripePrice(product.stripe_price_id, price);
      if (updateStripePriceError)
        logger.error(`Error while updating the price of a product in stripe ${updateStripePriceError}` )
        return serverErrorResponse(res, "Error while updating the product info" )
    }

    return successResponse(res, "product updated successfully", product);
  } catch (err) {
    logger.error(`Error while updating product ${err}`);
    return serverErrorResponse(res, "Error while updating product");
  }
};

const addImage = async (req, res) => {
  const { product_id } = req.params;
  addImagetoProduct({ product_id: product_id, image: req }, res);
};

module.exports = {
  getProducts,
  getSingleProduct,
  createProduct,
  deleteProduct,
  updateProduct,
  addImage,
};
