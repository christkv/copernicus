"use strict";

var co = require('co');

const assert = require('assert');
const {
  ObjectId,
  MongoClient
} = require('mongodb');
const Category = require('../lib/schemas/nested_categories/category')
const Product = require('../lib/schemas/nested_categories/product')

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
    var category = new Category(collections, new ObjectId(), categories[i][0], categories[i][1]);
    await category.create();
  }
}

async function setupProducts(db, products) {
  // All the collections used
  var collections = {
      products: db.collection('products')
    , categories: db.collection('categories')
  }

  // Iterate over all the categories
  for(var i = 0; i < products.length; i++) {
    var product = new Product(collections, new ObjectId(), products[i][0], products[i][1], products[i][2], products[i][3]);
    await product.create();
  }
}

describe('Nested Categories', () => {
  it('Correctly category and fetch all immediate children of root node', async () => {
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
        ['root', '/']
      , ['1', '/1'], ['2', '/2'], ['3', '/3']
      , ['1-1', '/1/1'], ['1-2', '/1/2']
      , ['2-1', '/2/1'], ['2-2', '/2/2']
      , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
    ];

    // Create all the categories
    await setupCategories(db, categories);
    // Get all the immediate children of the root
    var categories = await Category.findAllDirectChildCategories(collections, '/');
    assert.equal(3, categories.length);
    var paths = {'/1':true, '/2':true, '/3':true};

    for(var i = 0; i < categories.length; i++) {
      if(paths[categories[i].category]) {
        delete paths[categories[i].category];
      }
    }

    assert.equal(0, Object.keys(paths).length);

    db.close();
  });

  it('Correctly fetch Category tree under a specific path', async () => {
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
        ['root', '/']
      , ['1', '/1'], ['2', '/2'], ['3', '/3']
      , ['1-1', '/1/1'], ['1-2', '/1/2']
      , ['2-1', '/2/1'], ['2-2', '/2/2']
      , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
    ];

    // Create all the categories
    await setupCategories(db, categories);

    // Get all the immediate children of the root
    var categories = await Category.findAllChildCategories(collections, '/1');
    assert.equal(2, categories.length);
    var paths = {'/1/1':true, '/1/2':true};

    for(var i = 0; i < categories.length; i++) {
      if(paths[categories[i].category]) {
        delete paths[categories[i].category];
      }
    }

    assert.equal(0, Object.keys(paths).length);

    db.close();
  });

  it('Correctly fetch specific category', async () => {
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
        ['root', '/']
      , ['1', '/1'], ['2', '/2'], ['3', '/3']
      , ['1-1', '/1/1'], ['1-2', '/1/2']
      , ['2-1', '/2/1'], ['2-2', '/2/2']
      , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
    ];

    // Create all the categories
    await setupCategories(db, categories);

    // Get all the immediate children of the root
    var category = await Category.findOne(collections, '/1/1');
    assert.equal('/1/1', category.category);

    db.close();
  });

  it('Correctly fetch all products of a specific category', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        products: db.collection('products')
      , categories: db.collection('categories')
    }

    // Cleanup
    await setup(db);

    //name, cost, currency, categories
    // Setup a bunch of categories
    var products = [
        ['prod1', 100, 'usd', ['/']]
      , ['prod2', 200, 'usd', ['/1']], ['prod3', 300, 'usd', ['/2']], ['prod4', 400, 'usd', ['/3']]
      , ['prod2-1', 200, 'usd', ['/1/1']], ['prod2-2', 200, 'usd', ['/1/2']]
      , ['prod3-1', 300, 'usd', ['/2/1']], ['prod3-2', 200, 'usd', ['/2/2']]
      , ['prod4-1', 300, 'usd', ['/3/1']], ['prod4-2', 200, 'usd', ['/3/2']], ['prod4-3', 200, 'usd', ['/3/3']]
    ];

    // Create all the categories
    await setupProducts(db, products);

    // Get all the immediate children of the root
    var products = await Product.findByCategory(collections, '/');
    assert.equal(1, products.length);
    assert.equal('/', products[0].categories[0]);

    db.close();
  });

  it('Correctly fetch all products of a specific category', async () => {
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
        ['root', '/']
      , ['1', '/1'], ['2', '/2'], ['3', '/3']
      , ['1-1', '/1/1'], ['1-2', '/1/2']
      , ['2-1', '/2/1'], ['2-2', '/2/2']
      , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
    ];

    // Create all the categories
    await setupCategories(db, categories);

    // Setup a bunch of categories
    var products = [
        ['prod1', 100, 'usd', ['/']]
      , ['prod2', 200, 'usd', ['/1']], ['prod3', 300, 'usd', ['/2']], ['prod4', 400, 'usd', ['/3']]
      , ['prod2-1', 200, 'usd', ['/1/1']], ['prod2-2', 200, 'usd', ['/1/2']]
      , ['prod3-1', 300, 'usd', ['/2/1']], ['prod3-2', 200, 'usd', ['/2/2']]
      , ['prod4-1', 300, 'usd', ['/3/1']], ['prod4-2', 200, 'usd', ['/3/2']], ['prod4-3', 200, 'usd', ['/3/3']]
    ];

    // Create all the categories
    await setupProducts(db, products);

    // Get all the immediate children of the root
    var products = await Product.findByDirectCategoryChildren(collections, '/');
    assert.equal(3, products.length);
    var paths = {'/1':true, '/2':true, '/3':true};

    for(var i = 0; i < products.length; i++) {
      if(paths[products[i].categories[0]]) {
        delete paths[products[i].categories[0]];
      }
    }

    assert.equal(0, Object.keys(paths).length);

    db.close();
  });

  it('Correctly fetch all products of a specific category', async () => {
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
        ['root', '/']
      , ['1', '/1'], ['2', '/2'], ['3', '/3']
      , ['1-1', '/1/1'], ['1-2', '/1/2']
      , ['2-1', '/2/1'], ['2-2', '/2/2']
      , ['3-1', '/3/1'], ['3-2', '/3/2', '/3/3']
    ];

    // Create all the categories
    await setupCategories(db, categories);

    // Setup a bunch of categories
    var products = [
        ['prod1', 100, 'usd', ['/']]
      , ['prod2', 200, 'usd', ['/1']], ['prod3', 300, 'usd', ['/2']], ['prod4', 400, 'usd', ['/3']]
      , ['prod2-1', 200, 'usd', ['/1/1']], ['prod2-2', 200, 'usd', ['/1/2']]
      , ['prod3-1', 300, 'usd', ['/2/1']], ['prod3-2', 200, 'usd', ['/2/2']]
      , ['prod4-1', 300, 'usd', ['/3/1']], ['prod4-2', 200, 'usd', ['/3/2']], ['prod4-3', 200, 'usd', ['/3/3']]
    ];

    // Create all the categories
    await setupProducts(db, products);

    // Get all the immediate children of the root
    var products = await Product.findByCategoryTree(collections, '/1');
    assert.equal(2, products.length);

    var paths = {'/1/1':true, '/1/2':true};

    for(var i = 0; i < products.length; i++) {
      if(paths[products[i].categories[0]]) {
        delete paths[products[i].categories[0]];
      }
    }

    assert.equal(0, Object.keys(paths).length);

    db.close();
  });
});