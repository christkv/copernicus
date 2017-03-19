"use strict";

const assert = require('assert');
const SliceCache = require('../lib/schemas/array_slice/cache');
const {
  ObjectID,
  MongoClient
} = require('mongodb');

async function setup(db) {
  const SliceCache = require('../lib/schemas/array_slice/cache');

  // All the collections used
  const collections = {
      cache: db.collection('cache')
  }

  try { await collections['cache'].drop(); } catch(err) {}
  await SliceCache.createOptimalIndexes(collections);
}

describe('Cache test', () => {
  it('Should correctly a 5 line cache no pre-allocation', async () => {
    // Connect to mongodb
    const db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    const collections = {
      cache: db.collection('cache')
    }

    // Cleanup
    await setup(db);

    // Cache object
    var cache = new SliceCache(collections, new ObjectID(), 5);
    // Create the cache document on MongoDB
    var cache = await cache.create();

    // Push 6 items and see the cutoff
    var r = await cache.push([
        {a:1}, {a:2}, {a:3}
      , {a:4}, {a:5}, {a:6}
    ]);

    // Fetch the cache
    var doc = await collections['cache'].findOne({_id: cache.id});
    assert.equal(5, doc.data.length);
    assert.equal(2, doc.data[0].a);
    assert.equal(6, doc.data[4].a);

    db.close();
  });

  it('Should correctly a 5 line cache with pre-allocation', async () => {
    // Connect to mongodb
    const db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    const collections = {
      cache: db.collection('cache')
    }

    // Cleanup
    await setup(db);

    // Cache object
    var cache = new SliceCache(collections, new ObjectID(), 5);
    // Create the cache document on MongoDB
    var chache = await cache.create({a:1});

    // Push 6 items and see the cutoff
    var r = await cache.push([
      {a:1}, {a:2}, {a:3}
    ]);

    // Fetch the cache
    var doc = await collections['cache'].findOne({_id: cache.id});
    assert.equal(3, doc.data.length);
    assert.equal(1, doc.data[0].a);
    assert.equal(3, doc.data[2].a);
    assert.equal(null, doc.data[4]);

    db.close();
  });
});