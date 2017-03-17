"use strict";

var Transaction = require('./transaction')
  , co = require('co')
  , ObjectID = require('mongodb').ObjectID;

var clone = function(obj) {
  var o = {};
  for(var name in obj) o[name] = obj[name];
  return o;
}

class Account {
  constructor(collections, name, balance) {
    this.collections = collections;
    this.accounts = collections['accounts'];
    this.transactions = collections['transactions'];
    this.name = name;
    this.balance = balance;
  }

  /*
   * Create a new account document
   */
  async create(options = {}) {
    options = Object.assign({}, options, {upsert:true});

    var r = await this.accounts.updateOne({ name: this.name }, {
      name: this.name, 
      balance:this.balance, 
      pendingTransactions:[]
    }, options);

    if(r.result.writeConcernError) {
      throw new r.result.writeConcernError;
    }

    return this;
  }

  /*
   * Transfer an amount to this account from the provided account
   */
  async transfer(toAccount, amount, options = {}) {
    try {
      // Create a new transaction
      var transaction = new Transaction(this.collections, new ObjectID(), this, toAccount, amount);
      // Create transaction object
      await transaction.create(options);
      // Update the accounts with the transaction
      await transaction.apply(options);
      // Return the transaction
      return transaction;
    } catch(err) {
      err.transaction = transaction;
      throw err;
    }
  }

  /*
   * Debit the account with the specified amount
   */
  async debit(transactionId, amount, options = {}) {
    var r = await this.accounts.updateOne({
      name: this.name, pendingTransactions: {$ne: transactionId}, balance: { $gte: amount}
    }, {
      $inc: {balance: -amount}, $push: {pendingTransactions: transactionId}
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    if(r.result.nUpdated == 0) {
      throw new Error(f('failed to debit account %s the amount %s', this.name, amount));
    }
  }

  /*
   * Credit the account with the specified amount
   */
  async credit(transactionId, amount, options = {}) {
    var r = await this.accounts.updateOne({
      name: this.name, pendingTransactions: {$ne: transactionId}
    }, {
      $inc: {balance: amount}, $push: {pendingTransactions: transactionId}
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    if(r.result.nUpdated == 0) {
      throw new Error(f('failed to credit account %s the amount', this.name, amount));
    }
  }

  /*
   * Clear transaction
   */
  async clear(transactionId, options = {}) {
    var r = await this.accounts.update({name: this.name}, {
      $pull: {pendingTransactions: transactionId}
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    if(r.result.nUpdated == 0) {
      throw new Error('failed to clear pending account1 transaction');
    }
  }

  /*
   * Reload the account information
   */
  async reload(options = {}, callback) {
    let result = await this.accounts.findOne({name: this.name}, options);
    this.balance = result.balance;
    return this;
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections, options = {}) {
    // Ensure we do not have duplicate accounts
    await collections['accounts'].ensureIndex({name:1}, {unique: true});
  }
}

module.exports = Account;
