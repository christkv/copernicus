"use strict";

var ObjectID = require('mongodb').ObjectID;

class Inventory {
  constructor(collections, id, quantity) {
    this.id = id == null ? new ObjectID() : id;
    this.quantity = quantity;
    this.inventories = collections['inventories'];
  }

  /*
   * Create an inventory mongodb document
   */
  async create(options= {}) {
    var r = await this.inventories.insertOne({
        _id: this.id
      , quantity: this.quantity
      , reservations: []
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    return this;
  }

  /*
   * Attempt to reserve a list of products and their quantities
   * rolls back if if it cannot satisfy all the product reservations and
   * returns the list of the ones that could not be covered
   */
  static async reserve(collections, id, products, options = {}) {
    if(products.length == 0) return;

    // Attempt to reserve a product
    async function reserveProduct(inventories, id, product) {
      try {
        var r = await inventories.updateOne({
            _id: product._id
          , quantity: { $gte: product.quantity }
        }, {
            $inc: {quantity: -product.quantity}
          , $push: {
            reservations: {
              quantity: product.quantity, _id: id, created_on: new Date()
            }
          }
        }, options);

        if(r.modifiedCount == 0) {
          throw new Error(`failed to reserve product ${product._id} for cart ${id}`);
        }

        if(r.result.writeConcernError) {
          throw r.result.writeConcernError;
        }
      } catch(err) {
        err.product = product;
        throw product;
      }
    }

    // Rollback products
    async function rollback(inventories, id, products) {
      try {
        // If we have no products return
        if(products.length == 0) return;

        // Rollback all the products
        for(var i = 0; i < products.length; i++) {
          await inventories.updateOne({
              _id: products[i]._id
            ,  "reservations._id": id
          }, {
              $inc: { quantity: products[i].quantity }
            , $pull : { reservations: {_id: id } }
          }, options);
        }
      } catch(err) {
        err.product = product;
        throw err;
      }
    }

    // Get inventories collection
    var inventories = collections['inventories'];
    var left = products.length;

    // Gather any errors
    var errors = [];
    var applied = [];

    // Attempt to reserve all the products for the cart in parallel
    await Promise.all(products.map(product => {
      return reserveProduct(inventories, id, product)
        .catch(e => errors.push(e))
        .then(r => { 
          if(r && errors.indexOf(product) == -1) {
            applied.push(product);
          }
        });
    }));

    // Success in registering all the products
    if (errors.length == 0) {
      return;
    }

    // Rollback the products
    await rollback(inventories, id, applied);
    // Throw the cart error
    var error = new Error(`failed to checkout cart ${id}`);
    error.products = errors;
    throw error;
  }

  /*
   * Commit all the reservations by removing them from the reservations array
   */
  static async commit(collections, id, options = {}) {
    var r = await collections['inventories'].updateMany({
      'reservations._id': id
    }, {
      $pull: { reservations: {_id: id } }
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
    await collections['inventories'].ensureIndex({"reservations._id": 1});
  }
}

module.exports = Inventory;
