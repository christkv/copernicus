"use strict";

const assert = require('assert');

async function setup(db) {
  const Account = require('../lib/schemas/account/account');

  // All the collections used
  const collections = {
      accounts: db.collection('accounts')
    , transactions: db.collection('transactions')
  }

  try { await collections['accounts'].drop(); } catch(err) {}
  try { await collections['transactions'].drop(); } catch(err) {}
  await Account.createOptimalIndexes(collections);
}

describe('Account test', () => {
  it('Should correctly perform transfer between account A and account B of 100', async () => {
    const {
      ObjectID,
      MongoClient
    } = require('mongodb');

    const Account = require('../lib/schemas/account/account');

    // Connect to mongodb
    const db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    const collections = {
        accounts: db.collection('accounts')
      , transactions: db.collection('transactions')
    }

    // Cleanup
    await setup(db);

    // Create the two accounts used for a transfer
    let accountA = new Account(collections, "Joe", 1000);
    let accountB = new Account(collections, "Paul", 1000);

    // Instantiate First account
    await accountA.create();
    // Instantiate Second account
    await accountB.create();

    // Transfer 100 from A to B successfully
    const transaction = await accountA.transfer(accountB, 100);

    // Reload both account documents and verify
    // balance
    accountA = await accountA.reload();
    assert.equal(900, accountA.balance);

    accountB = await accountB.reload();
    assert.equal(1100, accountB.balance);

    // Get the transaction
    const doc = await collections['transactions'].findOne({_id: transaction.id});
    assert.equal('done', doc.state);

    db.close();
  });

  it('Should correctly roll back transfer that fails before any application of amounts to accounts', async () => {
    const {
      ObjectID,
      MongoClient
    } = require('mongodb');

    const Account = require('../lib/schemas/account/account');

    // Connect to mongodb
    const db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    const collections = {
        accounts: db.collection('accounts')
      , transactions: db.collection('transactions')
    }

    // Cleanup
    await setup(db);

    // Create the two accounts used for a transfer
    let accountA = new Account(collections, "Joe2", 1000);
    let accountB = new Account(collections, "Paul2", 1000);

    // Instantiate First account
    await accountA.create();
    // Instantiate Second account
    await accountB.create();

    // Contains the transaction
    let transaction = null;

    try {
      // Transfer 100 from A to B successfully
      transaction = await accountA.transfer(accountB, 100, {fail: 'failBeforeApply'});
    } catch(err) {
      transaction = err.transaction;
    }

    // Reload both account documents and verify
    // balance
    accountA = await accountA.reload();
    assert.equal(1000, accountA.balance);

    accountB = await accountB.reload();
    assert.equal(1000, accountA.balance);

    // Get the transaction
    const doc = await collections['transactions'].findOne({_id: transaction.id});
    assert.equal('canceled', doc.state);

    db.close();
  });

  it('Should correctly roll back transfer that fails with only a single account being applied', async () => {
    const {
      ObjectID,
      MongoClient
    } = require('mongodb');

    const Account = require('../lib/schemas/account/account');

    // Connect to mongodb
    const db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    const collections = {
        accounts: db.collection('accounts')
      , transactions: db.collection('transactions')
    }

    // Cleanup
    await setup(db);

    // Create the two accounts used for a transfer
    let accountA = new Account(collections, "Joe3", 1000);
    let accountB = new Account(collections, "Paul3", 1000);

    // Instantiate First account
    await accountA.create();
    // Instantiate Second account
    await accountB.create();

    // Contains the transaction
    let transaction = null;

    try {
      // Transfer 100 from A to B successfully
      transaction = await accountA.transfer(accountB, 100, {fail: 'failAfterFirstApply'});
    } catch(err) {
      transaction = err.transaction;
    }

    // Reload both account documents and verify
    // balance
    await accountA.reload();
    assert.equal(1000, accountA.balance);

    await accountB.reload();
    assert.equal(1000, accountB.balance);

    // Get the transaction
    let doc = await collections['transactions'].findOne({_id: transaction.id});
    assert.equal('canceled', doc.state);

    db.close();
  });

  it('Should correctly roll back transfer that fails after application to accounts', async () => {
    const {
      ObjectID,
      MongoClient
    } = require('mongodb');

    const Account = require('../lib/schemas/account/account');

    // Connect to mongodb
    const db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    const collections = {
        accounts: db.collection('accounts')
      , transactions: db.collection('transactions')
    }

    // Cleanup
    await setup(db);

    // Create the two accounts used for a transfer
    let accountA = new Account(collections, "Joe4", 1000);
    let accountB = new Account(collections, "Paul4", 1000);

    // Instantiate First account
    await accountA.create();
    // Instantiate Second account
    await accountB.create();

    // Contains the transaction
    let transaction = null;

    try {
      // Transfer 100 from A to B successfully
      transaction = await accountA.transfer(accountB, 100, {fail: 'failAfterApply'});
    } catch(err) {
      transaction = err.transaction;
    }

    // Reload both account documents and verify
    // balance
    await accountA.reload();
    assert.equal(1000, accountA.balance);

    await accountB.reload();
    assert.equal(1000, accountB.balance);

    // Get the transaction
    let doc = await collections['transactions'].findOne({_id: transaction.id});
    assert.equal('canceled', doc.state);

    db.close();
  });

  it('Should correctly roll back transfer that fails after transaction set to commit but before clearing', async () => {
    const {
      ObjectID,
      MongoClient
    } = require('mongodb');

    const Account = require('../lib/schemas/account/account');

    // Connect to mongodb
    const db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    const collections = {
        accounts: db.collection('accounts')
      , transactions: db.collection('transactions')
    }

    // Cleanup
    await setup(db);

    // Create the two accounts used for a transfer
    let accountA = new Account(collections, "Joe5", 1000);
    let accountB = new Account(collections, "Paul5", 1000);

    // Instantiate First account
    await accountA.create();
    // Instantiate Second account
    await accountB.create();

    // Contains the transaction
    let transaction = null;

    try {
      // Transfer 100 from A to B successfully
      transaction = await accountA.transfer(accountB, 100, {fail: 'failAfterCommit'});
    } catch(err) {
      transaction = err.transaction;
    }

    // Reload both account documents and verify
    // balance
    await accountA.reload();
    assert.equal(900, accountA.balance);

    await accountB.reload();
    assert.equal(1100, accountB.balance);

    // Get the transaction
    let doc = await collections['transactions'].findOne({_id: transaction.id});
    assert.equal('committed', doc.state);

    db.close();
  });
});