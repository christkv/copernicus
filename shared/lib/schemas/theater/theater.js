"use strict";

var f = require('util').format,
  ObjectID = require('mongodb').ObjectID,
  Session = require('./session'),
  co = require('co');

/*
 * Create a new theater instance
 */
class Theater {
  constructor(collections, id, name, seats) {
    this.id = id == null ? new ObjectID() : id;
    this.collections = collections;
    this.name = name;
    this.seats = seats;
    this.theaters = collections['theaters'];
    this.sessions = [];
  }

  /*
   *  Create a new theater instance
   */
  async create(options = {}) {
    var seatsAvailable = 0;
    for(var i = 0; i < this.seats.length; i++) {
      seatsAvailable += this.seats[i].length;
    }

    // Theater
    var theater = {
        _id: this.id
      , name: this.name
      , seats: this.seats
      , seatsAvailable: seatsAvailable
    }

    // Save the document
    await this.theaters.insertOne(theater, options);
    return this;
  }

  /*
   *  Add a new screening session to the theater
   */
  async addSession(name, description, start, end, price, options = {}) {
    // Create a new session
    var session = new Session(this.collections, options.id == null ? new ObjectID() : options.id, this.id, name, description, start, end, price);
    session = await session.create(options);
    this.sessions.push(session);
    return session;
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
  }
}

module.exports = Theater;
