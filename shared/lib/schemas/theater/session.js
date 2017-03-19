"use strict";

var f = require('util').format,
  co = require('co'),
  ObjectID = require('mongodb').ObjectID;

/*
 * Create a new session instance
 */
class Session {
  constructor(collections, id, theaterId, name, description, start, end, price) {
    this.id = id == null ? new ObjectID() : id;
    this.theaterId = theaterId;
    this.name = name;
    this.description = description;
    this.start = start;
    this.end = end;
    this.price = price;
    this.sessions = collections['sessions'];
    this.theaters = collections['theaters'];
  }

  /*
   *  Create a new session instance and save the document in mongodb
   */
  async create(options = {}) {
    var doc = await this.theaters.findOne({_id: this.theaterId});
    if(!doc) {
      throw new Error(`no theater instance found for id ${this.theaterId}`);
    }

    // Set current values
    this.seatsAvailable = doc.seatsAvailable;
    this.seats = doc.seats;

    // Create a session for this theater
    var r = await this.sessions.insertOne({
        _id: this.id
      , theaterId: this.theaterId
      , name: this.name
      , description: this.description
      , start: this.start
      , end: this.end
      , price: this.price
      , seatsAvailable: doc.seatsAvailable
      , seats: doc.seats
      , reservations: []
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    return this;
  }

  /*
   *  Perform a reservation of a set of seats in this specific session
   */
  async reserve(id, seats, options = {}) {
    var seatsQuery = [];
    var setSeatsSelection = {};

    // Build the seats check
    for(var i = 0; i < seats.length; i++) {
      var seatSelector = {};
      // Build the $and that ensures that we only reserve seats if they are all available
      seatSelector[`seats.${seats[i][0]}.${seats[i][1]}`] = 0;
      seatsQuery.push(seatSelector)
      // Set all the seats to occupied
      setSeatsSelection[`seats.${seats[i][0]}.${seats[i][1]}`] = 1;
    }

    // Attempt to reserve the seats
    var r = await this.sessions.updateOne({
        _id: this.id, theaterId: this.theaterId
      , $and: seatsQuery
    }, {
        $set: setSeatsSelection
      , $inc: { seatsAvailable: -seats.length }
      , $push: {
        reservations: {
            _id: id
          , seats: seats
          , price: this.price
          , total: this.price * seats.length
        }
      }
    }, options);

    if(r.modifiedCount == 0) {
      throw new Error(`could not reserve seats ${seats}`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    return this;
  }

  /*
   * Release a specific reservation and clear seats
   */
  async release(id, seats, options = {}) {
    var setSeatsSelection = {};
    // Release all the seats
    for(var i = 0; i < seats.length; i++) {
      setSeatsSelection[`seats.${seats[i][0]}.${seats[i][1]}`] = 0;
    }

    // Remove the reservation
    var r = await this.sessions.updateOne({
      _id: this.id
    }, {
        $set: setSeatsSelection
      , $pull: { reservations: { _id: id }}
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }
  }

  /*
   * Release all the reservations for a cart across all sessions
   */
  static async releaseAll(collections, id, options = {}) {
    var docs = await collections['sessions'].find({
      'reservations._id': id
    }).toArray();
    if(docs.length == 0) return;

    // Reverses a specific reservation
    async function reverseReservation(doc, id) {
      // Locate the right cart id
      var reservation = null;

      for(var i = 0; i < doc.reservations.length; i++) {
        if(doc.reservations[i]._id.toString() == id.toString()) {
          reservation = doc.reservations[i];
          break;
        }
      }

      // No reservation found return
      if(!reservation) return;
      // Reverse the specific reservation
      var session = new Session(collections, doc._id)
      await session.release(reservation._id, reservation.seats, options);
    }

    // For each entry reverse the reservation for this cart
    Promise.all(docs.map(doc => {
      return reverseReservation(doc, id);
    }));
  }

  /*
   * Apply all the reservations for a specific id across all sessions
   */
  static async apply(collections, id, options = {}) {
    // Apply the cart by removing the cart from all sessions
    var r = await collections['sessions'].updateMany({
      'reservations._id': id
    }, {
      $pull: { reservations: { _id: id }}
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
    await collections['sessions'].ensureIndex({'reservations._id':1});
  }
}

module.exports = Session;
