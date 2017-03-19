"use strict";

var ObjectID = require('mongodb').ObjectID;

class Order {
  constructor(collections, id, shipping, payment, products) {
    this.id = id == null ? new ObjectID() : id;
    this.shipping = shipping;
    this.payment = payment;
    this.products = products

    // Orders collection
    this.orders = collections['orders'];
  }

  /*
   * Create a new order after checkout of the cart
   */
  async create(options = {}) {
    var total = 0;

    for(var i = 0; i < this.products.length; i++) {
      total = total + (this.products[i].quantity * this.products[i].price);
    }

    // Create a new order
    var r = await this.orders.insertOne({
        _id: this.id
      , total: total
      , shipping: this.shipping
      , payment: this.payment
      , products: this.products
    }, options);

    if(r.result.nInserted == 0) {
      throw new Error(`failed to insert order for cart ${this.id}`);
    }

    return this;
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections, options = {}) {
  }
}

module.exports = Order;
