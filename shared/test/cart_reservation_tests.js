"use strict";

const assert = require('assert');
const {
  ObjectID,
  MongoClient
} = require('mongodb');
const Cart = require('../lib/schemas/cart_reservation/cart')
  , Product = require('../lib/schemas/cart_reservation/product')
  , Inventory = require('../lib/schemas/cart_reservation/inventory')
  , Order = require('../lib/schemas/cart_reservation/order');

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

describe('Cart with reservation test', () => {
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

    // Create cart
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
        shipping: {}, payment: {}
      });

    // Validate the state of the cart and product
    var doc = await collections['inventories'].findOne({_id: 1});
    assert.equal(99, doc.quantity);
    assert.equal(0, doc.reservations);

    // Validate the state of the cart
    var doc = await collections['carts'].findOne({_id: cart.id});
    assert.equal('completed', doc.state);

    db.close();
  });

  it('Should correctly add an item to the cart but fail to reserve the item in the inventory due to no availability', async () => {
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

    // Create cart
    var cart = new Cart(collections);
    await cart.create();

    // Fetch a product
    var product = new Product(collections, 1);
    await product.reload();

    try {
      // Add a product to the cart
      await cart.add(product, 1000);
      reject(new Error('should not reach this'));
    } catch(err) {}

    // Retrieve the cart
    var doc = await collections['carts'].findOne({_id: cart.id});
    assert.equal(0, doc.products.length);
    assert.equal('active', doc.state);

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

    // Create cart
    var cart = new Cart(collections);
    await cart.create();

    // Fetch a product
    var product = new Product(collections, 1);
    await product.reload();

    // Add a product to the cart
    async function addProductAndValidate(cart) {
      await cart.add(product, 2);

      // Validate cart and inventory
      var doc = await collections['carts'].findOne({_id: cart.id});
      assert.equal(1, doc.products.length);
      assert.equal(2, doc.products[0].quantity);

      var doc = await collections['inventories'].findOne({_id: product.id});
      assert.equal(1, doc.reservations.length);
      assert.equal(98, doc.quantity);
      assert.equal(cart.id.toString(), doc.reservations[0]._id.toString());
      await updateProductAndValidate(cart);
    }

    // Update the quantity of a product
    async function updateProductAndValidate(cart) {
      // Update the amount of a product
      await cart.update(product, 4);

      // Validate cart and inventory
      var doc = await collections['carts'].findOne({_id: cart.id});
      assert.equal(1, doc.products.length);
      assert.equal(4, doc.products[0].quantity);

      var doc = await collections['inventories'].findOne({_id: product.id});
      assert.equal(1, doc.reservations.length);
      assert.equal(96, doc.quantity);
      assert.equal(cart.id.toString(), doc.reservations[0]._id.toString());
      assert.equal(4, doc.reservations[0].quantity);
      await illegalQuantityAdjustment(cart);
    }

    // Illegal product quantity adjustment
    async function illegalQuantityAdjustment(cart) {
      try {
        // Fail to update due to not enough inventory available
        await cart.update(product, 1000);
        reject(new Error('should not reach this'));
      } catch(err) {}

      // Validate cart and inventory
      var doc = await collections['carts'].findOne({_id: cart.id});
      assert.equal(1, doc.products.length);
      assert.equal(4, doc.products[0].quantity);

      var doc = await collections['inventories'].findOne({_id: product.id});
      assert.equal(1, doc.reservations.length);
      assert.equal(cart.id.toString(), doc.reservations[0]._id.toString());
      assert.equal(96, doc.quantity);
      assert.equal(4, doc.reservations[0].quantity);
      await removeProductAndValidate(cart);
    }

    async function removeProductAndValidate(cart) {
      // Remove product from cart
      await cart.remove(product);

      // Validate cart and inventory
      var doc = await collections['carts'].findOne({_id: cart.id});
      assert.equal(0, doc.products.length);

      var doc = await collections['inventories'].findOne({_id: product.id});
      assert.equal(0, doc.reservations.length);
      assert.equal(100, doc.quantity);
    }

    // Remove product and validate
    await addProductAndValidate(cart);
    db.close();
  });

  it('Should correctly find expired carts and remove any reservations in them', async () => {
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

    // Create cart
    var cart = new Cart(collections);
    await cart.create();

    // Fetch a product
    var product = new Product(collections, 1);
    await product.reload();

    // Add a product to the cart
    async function addProductAndValidate(cart) {
      await cart.add(product, 2);

      // Validate cart and inventory
      var doc = await collections['carts'].findOne({_id: cart.id});
      assert.equal(1, doc.products.length);
      assert.equal(2, doc.products[0].quantity);

      var doc = await collections['inventories'].findOne({_id: product.id});
      assert.equal(1, doc.reservations.length);
      assert.equal(98, doc.quantity);
      assert.equal(cart.id.toString(), doc.reservations[0]._id.toString());
    }

    await addProductAndValidate(cart);
    // Set cart to expired
    var r = await collections['carts'].updateOne({_id: cart.id}, {$set: {state: 'expired'}});
    assert.equal(1, r.modifiedCount);

    // Expire the cart
    await Cart.releaseExpired(collections);

    // Validate cart and inventory
    var doc = await db.collection('carts').findOne({_id: cart.id});
    assert.equal(1, doc.products.length);

    var doc = await db.collection('inventories').findOne({_id: product.id});
    assert.equal(0, doc.reservations.length);
    assert.equal(100, doc.quantity);

    db.close();
  });
});