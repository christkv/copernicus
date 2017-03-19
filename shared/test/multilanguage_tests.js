"use strict";

var co = require('co');

const assert = require('assert');
const {
  ObjectID,
  MongoClient
} = require('mongodb');
const Category = require('../lib/schemas/multilanguage/category')
  , Product = require('../lib/schemas/multilanguage/product')

async function setup(db) {
  // All the collections used
  var collections = {
      products: db.collection('products')
    , categories: db.collection('categories')
  }

  try { await collections['products'].drop(); } catch(err) {}
  try { await collections['categories'].drop(); } catch(err) {}

  await Category.createOptimalIndexes(collections);
  await Product.createOptimalIndexes(collections);
}

async function setupCategories(db, categories) {
  // All the collections used
  var collections = {
      products: db.collection('products')
    , categories: db.collection('categories')
  }

  // Iterate over all the categories
  for(var i = 0; i < categories.length; i++) {
    var category = new Category(collections, categories[i][0], categories[i][1]);
    await category.create();
  }
}

async function setupProducts(db, products) {
  // All the collections used
  var collections = {
      products: db.collection('products')
    , categories: db.collection('categories')
  }

  for(var i = 0; i < products.length; i++) {
    var product = new Product(collections, new ObjectId(), products[i][0], products[i][1], products[i][2], products[i][3]);
    await product.create();
  }
}

describe('Multi language', () => {
  it('Correctly add new local for a category and see it reflected in the products', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        products: db.collection('products')
      , categories: db.collection('categories')
    }

    // Cleanup
    await setup(db);

    // Setup a bunch of categories
    var categories = [
      [1, {'en-us': 'car', 'de-de': 'auto'}]
    ];

    // Create all the categories
    await setupCategories(db, categories);

    // Locate the categories
    var categories = await collections['categories'].find().toArray();

    // Create a product
    var product = new Product(collections, 1, 'car', 100, 'usd', categories);
    await product.create();

    // Let's attempt to add a local to the category
    var cat = new Category(collections, 1);
    await cat.addLocal('es-es', 'coche');

    // Reload the product
    await product.reload();
    assert.equal('coche', product.categories[0].names['es-es']);

    await cat.reload();
    assert.equal('coche', cat.names['es-es']);

    db.close();
  });

  it('Correctly remove a local for a category and see it reflected in the products', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        products: db.collection('products')
      , categories: db.collection('categories')
    }

    // Setup a bunch of categories
    var categories = [
      [1, {'en-us': 'car', 'de-de': 'auto'}]
    ];

    // Cleanup
    await setup(db);

    // Create all the categories
    await setupCategories(db, categories);

    // Locate the categories
    var categories = await collections['categories'].find().toArray();

    // Create a product
    var product = new Product(collections, 1, 'car', 100, 'usd', categories);
    await product.create();

    // Let's attempt to add a local to the category
    var cat = new Category(collections, 1);
    await cat.removeLocal('de-de');

    // Reload the product
    await product.reload();
    assert.equal(null, product.categories[0].names['de-de']);

    await cat.reload();
    assert.equal(null, cat.names['de-de']);

    db.close();
  });    
});