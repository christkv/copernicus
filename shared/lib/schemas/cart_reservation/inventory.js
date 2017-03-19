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
  async create(options = {}) {
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
   * Reserve a specific quantity of a product for a cart
   */
  async reserve(id, quantity, options = {}) {
    var r = await this.inventories.updateOne({
      _id: this.id, quantity: { $gte: quantity }
    }, {
        $inc: {quantity: -quantity}
      , $push: {
        reservations: {
          quantity: quantity, _id: id, created_on: new Date()
        }
      }
    }, options);

    if(r.modifiedCount == 0) {
      throw new Error(`could not add the reservation for ${id} with the quantity ${quantity}`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    return this;
  }

  /*
   * Change the reservation quantity for a specific cart
   */
  async adjust(id, quantity, delta, options = {}) {
    // Attempt to update a reservation of inventory
    var r = await this.inventories.updateOne({
        _id: this.id
      , 'reservations._id': id
      , quantity: {
        $gte: delta
      }
    }, {
        $inc: { quantity: -delta }
      , $set: {
            'reservations.$.quantity': quantity
        , modified_on: new Date()
      }
    }, options);

    if(r.modifiedCount == 0) {
      throw new Error(`could not adjust the reservation for ${id} with the change of quantity ${delta}`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    return this;
  }

  /*
   * Release all the reservations for a cart across all products
   */
  static async releaseAll(collections, id, options = {}) {
    var docs = await collections['inventories'].find({
      'reservations._id': id
    }).toArray();

    if(docs.length == 0) {
      return;
    }

    // Reverses a specific reservation
    async function reverseReservation(doc, id) {
      // Locate the right cart id
      var reservation = null;
      for(var i = 0; i < doc.reservations.length; i++) {
        if(doc.reservations[i]._id.equals(id)) {
          reservation = doc.reservations[i];
          break;
        }
      }

      // No reservation found return
      if(!reservation) return;
      // Reverse the specific reservation
      var inventory = new Inventory(collections, doc._id)
      await inventory.release(reservation._id, options);
    }

    // For each entry reverse the reservation for this cart
    await Promise.all(docs.map(doc => {
      return reverseReservation(doc, id);
    }));
  }

  /*
   * Release a reservation for a specific cart
   */
  async release(id, options = {}) {
    // Get the latest inventory view to retrieve the amount in the reservation
    var doc = await this.inventories.findOne({
      _id: this.id
    });

    // Keep the reservations quantity
    var quantity = 0;

    // Locate the reservations quantity
    for(var i = 0; i < doc.reservations.length; i++) {
      if(doc.reservations[i]._id.equals(id)) {
        quantity = doc.reservations[i].quantity;
        break;
      }
    }

    // Update the inventory removing the reservations item and returning
    // the quantity
    var r = await this.inventories.updateOne({
        _id: this.id
      , "reservations._id": id
    }, {
        $pull : { reservations: {_id: id } }
      , $inc: { quantity: quantity }
    }, options);

    if(r.modifiedCount == 0) {
      throw new Error(`failed to remove reservation for ${id} from inventory for product ${this.id}`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }
    
    return this;
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

    if(r.modifiedCount == 0) {
      throw new Error(`no reservations for cart ${id} found in inventory`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }
    
    return this;
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
    await collections['inventories'].ensureIndex({"reservations._id": 1});
  }
}

module.exports = Inventory;
