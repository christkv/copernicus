"use strict";

var ObjectID = require('mongodb').ObjectID
  , f = require('util').format;

class Transaction {
  constructor(collections, id, fromAccount, toAccount, amount) {
    this.id = id == null ? new ObjectID() : id;
    this.collections = collections;
    this.transactions = collections['transactions'];
    this.accounts = collections['accounts'];
    this.fromAccount = fromAccount;
    this.toAccount = toAccount;
    this.amount = amount;
  }

  /*
   * Create a new transaction mongodb document
   */
  async create(options = {}) {
    // Insert the initial transaction
    var r = await this.transactions.insertOne({
        _id : this.id
      , source: this.fromAccount.name
      , destination: this.toAccount.name
      , amount: this.amount
      , state: Transaction.INITIAL
    }, options);

    if(r.result.writeConcernError) throw r.result.writeConcernError;
    this.state = Transaction.INITIAL;
  }

  /*
   * Apply transaction to the accounts
   */
  async apply(options = {}) {
    // Advance the state of the transaction to pending
    await this.advance(options)

    if(options.fail == 'failBeforeApply') {
      await this.cancel();
      throw new Error('failed to apply transaction');
    }

    try {
      // Attempt to debit amount from the first account
      await this.fromAccount.debit(this.id, this.amount, options);

      if(options.fail == 'failAfterFirstApply') {
        await reverse(this);
        throw new Error('failed to apply transaction to both accounts');
      }

      // Attempt to credit the second account
      await this.toAccount.credit(this.id, this.amount, options);

      if(options.fail == 'failAfterApply') {
        await reverse(this);
        throw new Error('failed after applying transaction to both accounts');
      }

      // Correctly set transaction to committed
      await this.advance(options);
    } catch(err) {
      await reverse(this);
      throw err;
    }

    // Clear out the applied transaction on the first account
    await this.fromAccount.clear(this.id, options);

    // Fail after the transaction was commited
    if(options.fail == 'failAfterCommit') {
      throw new Error(f('failed to clear transaction with %s from account %s', this.id, this.fromAccount.name));
    }

    // Clear out the applied transaction on the second account
    await this.toAccount.clear(this.id, options);
    // Advance the transaction to done
    await this.advance(options);
  }

  /*
   * Advance the transaction to the next step
   */
  async advance(options = {}) {
    if(this.state == Transaction.INITIAL) {
      var r = await this.transactions.updateOne({_id: this.id, state: Transaction.INITIAL}, {$set : {state: Transaction.PENDING}}, options);
      if(r.result.writeConcernError)
        return reject(r.result.writeConcernError);

      if(r.result.nUpdated == 0) {
        throw new Error(f('no initial state transaction found for %s', this.id));
      }

      this.state = Transaction.PENDING;
    } else if(this.state == Transaction.PENDING) {
      var r = await this.transactions.updateOne({_id: this.id, state: Transaction.PENDING}, {$set : {state: Transaction.COMMITTED}}, options);
      if(r.result.writeConcernError) {
        throw r.result.writeConcernError;
      }

      if(r.result.nUpdated == 0) {
        throw new Error(f('no pending state transaction found for %s', this.id));
      }

      this.state = Transaction.COMMITTED;
    } else if(this.state == Transaction.COMMITTED) {
      var r = await this.transactions.updateOne({_id: this.id, state: Transaction.COMMITTED}, {$set : {state: Transaction.DONE}}, options);
      if(r.result.writeConcernError) {
        throw r.result.writeConcernError;
      }

      if(r.result.nUpdated == 0) {
        throw new Error(f('no pending state transaction found for %s', this.id));
      }

      this.state = Transaction.DONE;
    }
  }

  /*
   * Cancel the transaction
   */
  async cancel(options = {}) {
    var r = await this.transactions.updateOne({_id: this.id}, {$set : {state: 'canceled'}}, options);
    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    if(r.result.nUpdated == 0) {
      throw new Error(f('no transaction found for %s', this.id));
    }
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(transactionCollection) {}
}

Transaction.INITIAL = 'initial';
Transaction.PENDING = 'pending';
Transaction.COMMITTED = 'committed';
Transaction.DONE = 'done';
Transaction.CANCELED = 'canceled';

/*
 * Reverse the transactions on the current account if it exists
 */
async function reverse(self, options = {}) {
  // Reverse the debit
  var r = await self.accounts.updateOne(
    {name: self.fromAccount.name, pendingTransactions: {$in: [self.id]}
  }, {$inc: {balance: self.amount}, $pull: {pendingTransactions: self.id}}, options);

  if(r.result.writeConcernError) {
    throw r.result.writeConcernError;
  }

  // Reverse the credit (if any)
  var r = await self.accounts.updateOne(
    {name: self.toAccount.name, pendingTransactions: {$in: [self.id]}
  }, {$inc: {balance: -self.amount}, $pull: {pendingTransactions: self.id}}, options);
  if(r.result.writeConcernError) {
    throw r.result.writeConcernError;
  }

  // Finally cancel the transaction
  await self.cancel(options);
}

module.exports = Transaction;
