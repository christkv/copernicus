"use strict";

const assert = require('assert');
const {
  ObjectID,
  MongoClient
} = require('mongodb');
const Cart = require('../lib/schemas/cart_no_reservation/cart')
  , Product = require('../lib/schemas/cart_no_reservation/product')
  , Inventory = require('../lib/schemas/cart_no_reservation/inventory')
  , Order = require('../lib/schemas/cart_no_reservation/order');

async function createProducts(collections) {
  var products = [
      { _id: 1, name: 'product 1', price: 100}
    , { _id: 2, name: 'product 2', price: 200}
    , { _id: 3, name: 'product 3', price: 300}
    , { _id: 4, name: 'product 4', price: 400}
    , { _id: 5, name: 'product 5', price: 500}
    , { _id: 6, name: 'product 6', price: 600}
    , { _id: 7, name: 'product 7', price: 700}
  ];

  var inventories = [
      { _id: 1, quantity: 100}
    , { _id: 2, quantity: 100}
    , { _id: 3, quantity: 100}
    , { _id: 4, quantity: 100}
    , { _id: 5, quantity: 100}
    , { _id: 6, quantity: 1}
    , { _id: 7, quantity: 0}
  ]

  // All the collections used
  var collections = {
      products: collections['products']
    , inventories: collections['inventories']
  }

  // Insert all the products
  await collections['products'].insertMany(products);
  // Insert all the associated product inventories
  await collections['inventories'].insertMany(inventories);
}

async function setup(db) {
  // All the collections used
  var collections = {
      products: db.collection('products')
    , orders: db.collection('orders')
    , carts: db.collection('carts')
    , inventories: db.collection('inventories')
  }

  try { await collections['products'].drop(); } catch(err) {}
  try { await collections['carts'].drop(); } catch(err) {}
  try { await collections['inventories'].drop(); } catch(err) {}
  try { await collections['orders'].drop(); } catch(err) {}

  await Cart.createOptimalIndexes(collections);
  await Product.createOptimalIndexes(collections);
  await Inventory.createOptimalIndexes(collections);
  await Order.createOptimalIndexes(collections);
  await createProducts(collections);
}

describe('Cart no reservation test', () => {
  it('Should correctly add an item to the cart and checkout the cart successfully', async () => {
    // Connect to mongodb
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        products: db.collection('products')
      , orders: db.collection('orders')
      , carts: db.collection('carts')
      , inventories: db.collection('inventories')
    }

    // Cleanup
    await setup(db);
    // Create a cart
    var cart = new Cart(collections);
    await cart.create();

    // Fetch a product
    var product = new Product(collections, 1);
    await product.reload();

    // Add a product to the cart
    await cart.add(product, 1);
    assert.equal(cart.products.length, 1);

    // Checkout the cart
    await cart.checkout({
        shipping: {}
      , payment: {}});

    // Validate the state of the cart and product
    var doc = await collections['inventories'].findOne({_id: 1});
    assert.equal(99, doc.quantity);
    assert.equal(0, doc.reservations);

    // Validate the state of the cart
    var doc = await collections['carts'].findOne({_id: cart.id});
    assert.equal('completed', doc.state);

    db.close();
  });

  it('Should correctly add an item to the cart but fail to reserve the item in the inventory', async () => {
    // Connect to mongodb
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        products: db.collection('products')
      , orders: db.collection('orders')
      , carts: db.collection('carts')
      , inventories: db.collection('inventories')
    }

    // Cleanup
    await setup(db);

    // Create a cart
    var cart = new Cart(collections);
    await cart.create();

    // Fetch a product
    var product = new Product(collections, 1);
    await product.reload();

    // Add a product to the cart
    await cart.add(product, 1000);

    try {
      // Attempt to checkout the cart
      await cart.checkout({
          shipping: {}
        , payment: {}});
    } catch(err) {}

    // Validate the state of the cart and product
    var doc = await collections['inventories'].findOne({_id: 1});
    assert.equal(100, doc.quantity);

    // Validate the state of the cart
    var doc = await collections['carts'].findOne({_id: cart.id});
    assert.equal('active', doc.state);

    db.close();
  });

  it('Should correctly add multiple items to the cart but fail to reserve the item in the inventory', async () => {
    // Connect to mongodb
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        products: db.collection('products')
      , orders: db.collection('orders')
      , carts: db.collection('carts')
      , inventories: db.collection('inventories')
    }

    // Cleanup
    await setup(db);

    // Create a cart
    var cart = new Cart(collections);
    await cart.create();

    // Fetch a product
    var product = new Product(collections, 1);
    await product.reload();

    // Fetch a product
    var product1 = new Product(collections, 2);
    await product1.reload();

    // Add a product to the cart
    await cart.add(product1, 10);

    // Add a product to the cart
    await cart.add(product, 1000);

    // Attempt to checkout the cart
    try {
      await cart.checkout({
          shipping: {}
        , payment: {}});
    } catch(err) {
      assert.equal(1, err.products.length);
    }

    // Validate the state of the cart and product
    var doc = await collections['inventories'].findOne({_id: 1});
    assert.equal(100, doc.quantity);

    // Validate the state of the cart
    var doc = await collections['carts'].findOne({_id: cart.id});
    assert.equal('active', doc.state);

    db.close();
  });
});