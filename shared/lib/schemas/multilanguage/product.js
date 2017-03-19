"use strict";

/*
 * Create a new product instance
 */
class Product {
  constructor(collections, id, name, cost, currency, categories) {
    this.id = id == null ? new ObjectID() : id;
    this.name = name;
    this.cost = cost;
    this.currency = currency;
    this.categories = categories;
    this.products = collections['products'];
  }

  /*
   * Create a new mongodb product document
   */
  async create() {
    // Insert a new category
    await this.products.insertOne({
        _id: this.id
      , name: this.name
      , cost: this.cost
      , currency: this.currency
      , categories: this.categories
    });
    
    return this;
  }

  /*
   * Reload the product information
   */
  async reload() {
    var doc = await this.products.findOne({_id: this.id});
    this.id = doc.id;
    this.name = doc.name;
    this.price = doc.price;
    this.currency = doc.currency;
    this.categories = doc.categories;
    return this;
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
    await collections['products'].ensureIndex({'categories._id':1});
  }
}

module.exports = Product;
