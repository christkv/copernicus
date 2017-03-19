"use strict";

/*
 * Create a new receipt instance
 */
class Receipt {
  constructor(collections, reservations, total) {
    this.reservations = reservations;
    this.total = total
    this.receipts = collections['receipts'];
  }

  /*
   * Create a new receipt mongod document
   */
  async create(options = {}) {
    var r = await this.receipts.insertOne({
        createdOn: new Date()
      , reservations: this.reservations
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    return this;
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
  }
}

module.exports = Receipt;
