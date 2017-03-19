"use strict";

var ObjectID = require('mongodb').ObjectID,
  Receipt = require('./receipt'),
  Session = require('./session');

/*
 * Create a new cart instance
 */
class Cart {
  constructor(collections, id) {
    this.id = id == null ? new ObjectID() : id;
    this.collections = collections;
    this.carts = collections['carts'];
    this.sessions = collections['sessions'];
    this.theaters = collections['theaters'];
    this.receipts = collections['receipts'];
  }

  /*
   * Create a new cart
   */
  async create(options = {}) {
    // Create a new cart
    var r = await this.carts.insertOne({
        _id: this.id
      , state: Cart.ACTIVE
      , total: 0
      , reservations: []
      , modifiedOn: new Date()
      , createdOn: new Date()
    });

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    return this;
  }

  /*
   * Attempt to reserve seats
   */
  async reserve(theater, session, seats, options = {}) {
    // Reserve seats in the session
    await session.reserve(this.id, seats, options);
    var err = null;
    var r = null;

    try {
      // Put reservation in the cart
      var r = await this.carts.updateOne({
        _id: this.id
      }, {
          $push: {
            reservations: {
                sessionId: session.id
              , seats: seats
              , price: session.price
              , total: session.price * seats.length
            }
          }
        , $inc: { total: session.price * seats.length }
        , $set: { modifiedOn: new Date() }
      });
    } catch(e) {
      err = e;
    }

    // If we have an error or no modified documents
    if(err || r.modifiedCount == 0) {
      // Release the seats in the session
      var r = await session.release(this.id, seats, options);

      if(r.modifiedCount == 0) {
        throw new Error('could not add seats to cart');
      }

      if(r.result.writeConcernError) {
        throw r.result.writeConcernError;
      }

        // Could not add the seats to the cart
      throw new Error('could not add seats to cart');
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    // Success in reserving the seats and putting them in the cart
    return this;
  }

  /*
   * Attempt to checkout the cart
   */
  async checkout(options = {}) {
    // Fetch the newest cart
    var doc = await this.carts.findOne({_id: this.id});
    if(!doc) {
      // Cart is gone force clean all sessions for this cart
      await Session.releaseAll(this.collections, this.id, options);
      return new Error(`could not locate cart with id ${this.id}`);
    }

    var receipt = new Receipt(this.collections, doc.reservations);
    await receipt.create(options);

    // Apply all reservations in the cart
    await Session.apply(this.collections, doc._id);

    // Update state of Cart to DONE
    var r = await this.carts.updateOne({
      _id: this.id
    }, {
      $set: {state: Cart.DONE }
    }, options);

    if(r.modifiedCount == 0) {
      throw new Error(`could not find cart with id ${this.id}`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }
  }

  /*
   * Release a reservation
   */
  async release(reservation, options = {}) {
    // Release all reservations in a specific reservation
    await new Session(collections, reservation.sessionId).release(this.id, reservation.seats, options);
  }


  /*
   * Destroy the cart and cleanup
   */
  async destroy(options = {}) {
    // Fetch the cart
    var doc = await this.carts.findOne({_id: this.id});

    if(!doc) {
      throw new Error(`could not locate cart with id ${this.id}`);
    }

    // Reservations left
    var left = doc.reservations.length;

    // Any errors collected
    var errors = [];

    // Release all reservations
    await Promise.all(doc.reservations.map(reservation => {
      return this.release(reservation, options);
    }));
  }

  /*
   * Locate all expired carts and release all reservations
   */
  static async releaseExpired(collections, options = {}) {
    var carts = await collections['carts'].find({state: Cart.EXPIRED}).toArray();
    if(carts.length == 0) return;
    
    // Process each cart
    async function processCart(cart, options) {
      // Release all reservations for this cart
      await Session.releaseAll(collections, cart._id, options);
      // Set cart to expired
      await collections['carts'].updateOne(
          { _id: cart._id }
        , { $set: { state: Cart.CANCELED }}, options);
    }

    // Release all the carts
    await Promise.all(carts.map(cart => {
      return processCart(cart, options);
    }))
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
    await collections['carts'].ensureIndex({state:1});
  }
}

Cart.ACTIVE = 'active';
Cart.DONE = 'done';
Cart.CANCELED = 'canceled';
Cart.EXPIRED = 'expired';

module.exports = Cart;
