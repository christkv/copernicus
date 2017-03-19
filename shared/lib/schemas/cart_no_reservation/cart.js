"use strict";

var ObjectID = require('mongodb').ObjectID,
  Inventory = require('./inventory'),
  Order = require('./order');

class Cart {
  constructor(collections, id) {
    this.id = id == null ? new ObjectID() : id;
    this.products = [];
    this.collections = collections;
    this.carts = collections['carts'];
  }

  /*
   * Create a new cart instance and save it to mongodb
   */
  async create(options = {}) {
    var r = await this.carts.updateOne({
        _id: this.id,
      }, {
          _id: this.id
        , state: Cart.ACTIVE
        , modified_on: new Date()
        , products: []
      }, {upsert:true});
    
    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    return this;
  }

  /*
   * Add product to cart, no validation of availability is made
   * as this is determined at check out only
   */
  async add(product, quantity, options = {}) {
    options = Object.assign({}, options, {upsert:true});
    // Add product to cart, and create cart with upsert
    // if it does not already exist
    var r = await this.carts.updateOne({
      _id: this.id, state: Cart.ACTIVE
    }, {
        $set: { modified_on: new Date() }
      , $push: {
        products: {
            _id: product.id
          , quantity: quantity
          , name: product.name
          , price: product.price
        }
      }
    }, options);

    if(r.modifiedCount == 0) {
      throw new Error(f("failed to add product %s to the cart with id %s", product.id, this.id));
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    this.products.push({
        _id: product.id
      , quantity: quantity
      , name: product.name
      , price: product.price
    });

    return this;
  }

  /*
   * Remove product from cart
   */
  async remove(product, options = {}) {
    // Remove the reservation from the cart itself
    var r = await this.carts.updateOne({
        _id: this.id
      , "products._id": product.id
      , state: Cart.ACTIVE
    }, {
      $pull: { products: {_id: product.id }}
    }, options);

    if(r.modifiedCount == 0) {
      throw new Error(`failed to remove product ${product.id} from cart ${this.id}`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    return this;
  }

  /*
   * Update the product quantity in the cart
   */
  async update(product, quantity, options = {}) {
    // Update cart with the new quantity
    var r = await this.carts.updateOne({
        _id: this.id
      , "products._id": product.id
      , state: Cart.ACTIVE
    }, {
      $set: {
          modified_on: new Date()
        , "products.$.quantity": quantity
      }
    }, options);

    if(r.modifiedCount == 0) {
      throw new Error(`failed to set product quantity change of ${quantity} for cart ${this.id}`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }
    
    return this;
  }

  /*
   * Attempt to checkout the products in the cart, late validation (like Amazon does)
   */
  async checkout(details, options = {}) {
    // Fetch latest cart view
    var cart = await this.carts.findOne({
      _id: this.id
    });

    if(!cart) {
      throw new Error(`could not located cart with id ${this.id}`);
    }

    // Reserve the quantities for all the products (rolling back if some are not possible to cover)
    await Inventory.reserve(this.collections, this.id, cart.products, options);

    // Create a new order instance
    var order = new Order(this.collections, new ObjectID()
      , details.shipping
      , details.payment
      , cart.products);

    // Create the document
    var order = await order.create(options);

    // Set the state of the cart as completed
    var r = await this.carts.updateOne({
        _id: this.id
      , state: Cart.ACTIVE
    }, {
      $set: { state: Cart.COMPLETED }
    }, options);

    if(r.modifiedCount == 0) {
      throw new Error(`failed to set cart ${this.id} to completed state`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    // Commit the change to the inventory
    await Inventory.commit(this.collections, this.id, options);
  }

  /*
   * Expired carts can just be set to canceled as there is no need to return inventory
   */
  async releaseExpired(collections, options = {}) {
    var r = await collections['carts'].updateMany(
        {state: Cart.EXPIRED}
      , { $set: { state: Cart.CANCELED} }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
    await collections['carts'].ensureIndex({state: 1});
  }
}

Cart.ACTIVE = 'active';
Cart.EXPIRED = 'expired';
Cart.COMPLETED = 'completed';
Cart.CANCELED = 'canceled';

module.exports = Cart;
