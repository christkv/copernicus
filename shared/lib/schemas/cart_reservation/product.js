"use strict";

var ObjectID = require('mongodb').ObjectID,
  co = require('co');

class Product {
  constructor(collections, id, name, properties) {
    this.id = id == null ? new ObjectID() : id;
    this.name = name;
    this.properties = properties;
    this.products = collections['products'];
  }

  /*
   * Create a new product MongoDB document
   */
  async create(options = {}) {
    // Insert a product
    var r = await this.products.insertOne({
        _id: this.id
      , name: this.name
      , properties: this.properties
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    return this;
  }

  /*
   * Reload the product information
   */
  async reload() {
    // Find a product
    var doc = await this.products.findOne({_id: this.id});
    if(!doc) {
      return this;
    }

    this.name = doc.name;
    this.price = doc.price;
    return this;
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections, options = {}) {
  }
}

module.exports = Product;
