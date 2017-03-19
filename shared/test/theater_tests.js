"use strict";

var co = require('co');

const assert = require('assert');
const {
  ObjectId,
  MongoClient
} = require('mongodb');
const Theater = require('../lib/schemas/theater/theater')
const Session = require('../lib/schemas/theater/session');
const Cart = require('../lib/schemas/theater/cart');

async function setup(db) {
  // All the collections used
  var collections = {
      theaters: db.collection('theaters')
    , sessions: db.collection('sessions')
    , carts: db.collection('carts')
    , receipts: db.collection('receipts')
  }

  try { await collections['theaters'].drop(); } catch(err) {};
  try { await collections['sessions'].drop(); } catch(err) {};
  try { await collections['carts'].drop(); } catch(err) {};
  try { await collections['receipts'].drop(); } catch(err) {};
  await Session.createOptimalIndexes(collections);
  await Cart.createOptimalIndexes(collections);
}

async function validateSeats(collections, session, seats, seatsLeft) {
  var doc = await collections['sessions'].findOne({_id: session.id});
  assert.ok(doc != null);
  assert.equal(doc.seatsAvailable, seatsLeft);

  for(var i = 0; i < seats.length; i++) {
    var seat = seats[i];
    assert.equal(doc.seats[seat[0]][seat[1]], 1);
  }

  assert.equal(0, doc.reservations.length);
}

async function validateCart(collections, cart, state, reservations) {
  var doc = await collections['carts'].findOne({_id: cart.id});
  assert.ok(doc != null);
  assert.equal(reservations.length, doc.reservations.length);
  assert.equal(state, doc.state);

  // Validate all the reservations in the cart
  for(var i = 0; i < reservations.length; i++) {
    assert.equal(doc.reservations[i].total, reservations[i].total);
    assert.deepEqual(doc.reservations[i].seats, reservations[i].seats);
  }
}

describe('Theater', () => {
  it('Should correctly set up theater and session and buy tickets for some row seats', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        theaters: db.collection('theaters')
      , sessions: db.collection('sessions')
      , carts: db.collection('carts')
      , receipts: db.collection('receipts')
    }

    // Cleanup
    await setup(db);

    // Create a new Theater
    var theater = new Theater(collections, 1, 'The Royal', [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]);

    // Create a theater instance
    var theater = await theater.create();
    assert.ok(theater != null);

    // Add a session to the theater
    var session = await theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10);
    assert.ok(session != null);

    // Create a cart
    var cart = new Cart(collections, 1);
    await cart.create();
    assert.ok(cart != null);

    // Seats to reserve [y cord, x cord]
    var seats = [[1, 5], [1, 6], [1, 7]];

    // Reserve some seats at the movie
    var cart = await cart.reserve(theater, session, seats);

    // Reservation ok, checkout the cart
    await cart.checkout();

    // Validate seat reservations
    await validateSeats(collections
      , session, seats, (session.seatsAvailable - seats.length));

    // Our expected cart reservations
    var expectedReservations = [{
          seats: seats
        , total: seats.length * session.price
      }
    ];

    // validateCart
    await validateCart(collections, cart, 'done', expectedReservations);

    db.close();
  });

  it('Should correctly set up theater and session and book tickets but fail to reserve the tickets', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        theaters: db.collection('theaters')
      , sessions: db.collection('sessions')
      , carts: db.collection('carts')
      , receipts: db.collection('receipts')
    }

    // Cleanup
    await setup(db);

    // Create a new Theater
    var theater = new Theater(collections, 1, 'The Royal', [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]);

    // Create a theater instance
    await theater.create();
    assert.ok(theater != null);

    // Add a session to the theater
    var session = await theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10);
    assert.ok(session != null);

    // Create a cart
    var cart = new Cart(collections, 1)
    await cart.create();
    assert.ok(cart != null);

    // Seats to reserve [y cord, x cord]
    var seats = [[1, 5], [1, 6], [1, 7]]

    // Reserve some seats at the movie
    var cart = await cart.reserve(theater, session, seats);

    // Reservation ok, checkout the cart
    await cart.checkout();

    // Create a cart
    var cart = new Cart(collections, 2)
    await cart.create();
    assert.ok(cart != null);

    // Seats to reserve [y cord, x cord]
    var seats = [[1, 5], [1, 6], [1, 7]]

    try {
      // Reserve some seats at the movie
      await cart.reserve(theater, session, seats);
      assert.ok(false);
    } catch(err) {
    }

    // Our expected cart reservations
    await validateCart(collections, cart, 'active', []);
    db.close();
  });

  it('Should correctly set up theater and session and book tickets but fail to apply to cart as it is gone', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        theaters: db.collection('theaters')
      , sessions: db.collection('sessions')
      , carts: db.collection('carts')
      , receipts: db.collection('receipts')
    }

    // Cleanup
    await setup(db);

    // Create a new Theater
    var theater = new Theater(collections, 1, 'The Royal', [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]);

    // Create a theater instance
    await theater.create();
    assert.ok(theater != null);

    // Add a session to the theater
    var session = await theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10);
    assert.ok(session != null);

    // Create a cart
    var cart = new Cart(collections, 1)
    await cart.create();
    assert.ok(cart != null);

    // Seats to reserve [y cord, x cord]
    var seats = [[1, 5], [1, 6], [1, 7]]
    // Reserve some seats at the movie
    await cart.reserve(theater, session, seats);

    // Destroy the cart
    var r = await collections['carts'].removeOne({_id: cart.id});
    assert.equal(1, r.deletedCount);

    // Reservation ok, checkout the cart
    await cart.checkout();

    var doc = await collections['sessions'].findOne({_id: session.id});

    // Validate that no seats are reserved after cart destroyed
    for(var i = 0; i < doc.seats.length; i++) {
      for(var j = 0; j < doc.seats[i].length; j++) {
        assert.equal(0, doc.seats[i][j]);
      }
    }

    db.close();
  });

  it('Should correctly find expired carts and remove any reservations in them', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        theaters: db.collection('theaters')
      , sessions: db.collection('sessions')
      , carts: db.collection('carts')
      , receipts: db.collection('receipts')
    }

    // Cleanup
    await setup(db);

    // Create a new Theater
    var theater = new Theater(collections, 1, 'The Royal', [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      , [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]);

    // Create a theater instance
    await theater.create();
    assert.ok(theater != null);

    // Add a session to the theater
    var session = await theater.addSession("Action Movie 5", "Another action movie", new Date(), new Date(), 10);
    assert.ok(session != null);

    // Create a cart
    var cart = new Cart(collections, 1)
    await cart.create();
    assert.ok(cart != null);

    // Seats to reserve [y cord, x cord]
    var seats = [[1, 5], [1, 6], [1, 7]];

    // Reserve some seats at the movie
    await cart.reserve(theater, session, seats);

    // Force expire the cart
    var r = await collections['carts'].updateOne({_id: cart.id}, {$set: {state: Cart.EXPIRED}});
    assert.equal(1, r.modifiedCount);

    // Release all the carts that are expired
    await Cart.releaseExpired(collections);

    var doc = await collections['sessions'].findOne({_id: session.id});

    // Validate that no seats are reserved after cart destroyed
    for(var i = 0; i < doc.seats.length; i++) {
      for(var j = 0; j < doc.seats[i].length; j++) {
        assert.equal(0, doc.seats[i][j]);
      }
    }

    var c = await collections['carts'].count({state:'expired'});
    assert.equal(0, c);

    db.close();
  });
});
