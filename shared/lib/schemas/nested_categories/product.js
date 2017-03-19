"use strict";

var f = require('util').format,
  co = require('co'),
  Category = require('./category');

/*
 * Create a product instance
 */
class Product {
  constructor(collections, id, name, cost, currency, categories) {
    this.id = id;
    this.name = name;
    this.cost = cost;
    this.currency = currency;
    this.categories = categories;
    this.products = collections['products'];
  }

  /*
   * Create a new mongodb product document
   */
  async create(options = {}) {
    // Insert a new category
    await this.products.insertOne({
        _id: this.id
      , name: this.name
      , cost: this.cost
      , currency: this.currency
      , categories: this.categories
    }, options);
    return this;
  }

  /*
   * Find all products for a specific category
   */
  static async findByCategory(collections, path, options = {}) {
    // Get all the products
    var cursor = collections['products'].find({
      categories: path
    })

    if(options.readPreference) {
      cursor.setReadPreference(options.readPreference);
    }

    var products = await cursor.toArray();
    return products.map((x) => {
      return new Product(collections, x._id, x.name, x.cost, x.currency, x.categories);
    });
  }

  /*
   * Find all products for a categories direct children
   */
  static async findByDirectCategoryChildren(collections, path, options = {}) {
    // Locate all the categories
    var categories = await Category.findAllDirectChildCategories(collections, path, options);
    // Convert to paths
    var paths = categories.map((x) => {
      return x.category;
    });

    // Get all the products
    var cursor = collections['products'].find({
      categories: { $in: paths }
    })

    if(options.readPreference) {
      cursor.setReadPreference(options.readPreference);
    }

    var products = await cursor.toArray();
    return products.map((x) => {
      return new Product(collections, x._id, x.name, x.cost, x.currency, x.categories);
    });
  }

  /*
   * Find all products for a specific category tree
   */
  static async findByCategoryTree(collections, path, options = {}) {
    // Locate all the categories
    var categories = await Category.findAllChildCategories(collections, path, options);

    // Convert to paths
    var paths = categories.map((x) => {
      return x.category;
    });

    // Get all the products
    var cursor = collections['products'].find({
      categories: { $in: paths }
    });

    if(options.readPreference) {
      cursor.setReadPreference(options.readPreference);
    }

    var products = await cursor.toArray();
    return products.map(function(x) {
      return new Product(collections, x._id, x.name, x.cost, x.currency, x.categories);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
    await collections['products'].ensureIndex({categories:1});
  }
}

module.exports = Product;
