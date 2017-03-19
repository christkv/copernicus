"use strict";

var ObjectID = require('mongodb').ObjectID,
  Inventory = require('./inventory'),
  Order = require('./order');

class Cart {
  constructor(collections, id) {
    this.id = id == null ? new ObjectID() : id;
    this.collections = collections;
    this.products = [];
    this.carts = collections['carts'];
  }

  /*
   * Create a new cart instance and save it to mongodb
   */
  async create(options = {}) {
    options = Object.assign({}, options, {upsert:true});

    var r = await this.carts.updateOne({
        _id: this.id,
      }, {
          state: Cart.ACTIVE
        , modified_on: new Date()
        , products: []
      }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }
  }

  async add(product, quantity, options) {
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
      throw new Error(`failed to add product ${product.id} to the cart with id ${this.id}`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    // Next update the inventory, if there is enough
    // quantity available, push the cart information to the
    // list of reservations product quantities
    var inventory = new Inventory(this.collections, product.id);

    try {
      await inventory.reserve(this.id, quantity, options);
    } catch(err) {
      await rollback(this, product, quantity);
      return reject(err);
    }

    this.products.push({
        _id: product.id
      , quantity: quantity
      , name: product.name
      , price: product.price
    });

    // return
    return this;
  }

  /*
   * Remove product from cart and return quantity to inventory
   */
  async remove(product, options = {}) {
    var inventory = new Inventory(this.collections, product.id);
    // Remove from inventory reservation
    await inventory.release(this.id, options);

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
   * Update the quantity of a product in the cart
   */
  async update(product, quantity, options = {}) {
    // Get the latest cart view
    var doc = await this.carts.findOne({_id: this.id})
    if(!doc) {
      throw new Error(`could not locate cart with id ${this.id}`);
    }

    // Old quantity for the product
    var oldQuantity = 0;
    // Locate the product we wish to update
    for(var i = 0; i < doc.products.length; i++) {
      if(doc.products[i]._id == product.id) {
        oldQuantity = doc.products[i].quantity;
      }
    }

    // Calculate the delta
    var delta = quantity - oldQuantity;

    // Update the quantity in the cart
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
      throw new Error(`could not locate the cart with id ${this.id} or product not found in cart`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    try {
      var inventory = new Inventory(this.collections, product.id);
      // Attempt to reserve the quantity from the product inventory
      await inventory.adjust(this.id, quantity, delta, options);
      return true;
    } catch(err) {
      // Rollback as we could not apply the adjustment in the reservation
      var r = await this.carts.updateOne({
          _id: this.id
        , "products._id": product.id
        , state: Cart.ACTIVE
      }, {
        $set: {
            modified_on: new Date()
          , "products.$.quantity": oldQuantity
        }
      }, options);

      if(r.modifiedCount == 0) {
        throw new Error(`failed to rollback product quantity change of ${delta} for cart ${this.id}`);
      }

      if(r.result.writeConcernError) {
        throw r.result.writeConcernError;
      }

      // Return original error message from the inventory reservation attempt
      throw err;
    }
  }

  /*
   * Perform the checkout of the products in the cart
   */
  async checkout(details, options = {}) {
    var cart = await this.carts.findOne({_id: this.id});
    if(!cart) {
      throw new Error(`could not locate cart with id ${this.id}`);
    }

    // Create a new order instance
    var order = new Order(this.collections, new ObjectID()
      , details.shipping
      , details.payment
      , cart.products);
    // Create the document
    await order.create(options);

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
    return this;
  }

  /*
   * Release any of the expired carts
   */
  static async releaseExpired(collections, options = {}) {
    var carts = await collections['carts'].find({state: Cart.EXPIRED}).toArray();
    if(carts.length == 0) {
      return;
    }

    // Process each cart
    async function processCart(cart) {
      // Release all reservations for this cart
      await Inventory.releaseAll(collections, cart._id, options);
      // Set cart to expired
      await collections['carts'].updateOne(
          { _id: cart._id }
        , { $set: { state: Cart.CANCELED }}, options);
    }

    // Release all the carts
    for(var i = 0; i < carts.length; i++) {
      await processCart(carts[i]);
    }
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections, options = {}) {
    await collections['carts'].ensureIndex({state: 1});
  }
}

Cart.ACTIVE = 'active';
Cart.EXPIRED = 'expired';
Cart.COMPLETED = 'completed';
Cart.CANCELED = 'canceled';

async function rollback(cart, product, quantity, options = {}) {
  var r = await cart.carts.updateOne({
    _id: cart.id, state: Cart.ACTIVE, 'products._id': product.id
  }, {
    $pull: { products: { _id: product.id } }
  }, options);

  if(r.result.writeConcernError) {
    throw r.result.writeConcernError;
  }

  throw new Error(`failed to reserve the quantity ${quantity} of product ${product.id} for cart ${cart.id}`);
}

module.exports = Cart;
