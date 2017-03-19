"use strict";

const assert = require('assert');
const {
  ObjectId,
  MongoClient
} = require('mongodb');
const Metadata = require('../lib/schemas/metadata/metadata')

async function setup(db) {
  // All the collections used
  var collections = {
    metadatas: db.collection('metadatas')
  }

  try { await collections['metadatas'].drop(); } catch(err) {}

  await Metadata.createOptimalIndexes(collections);
}

describe('Metadata', () => {
  it('Correctly random metadata and query by metadata field', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
      metadatas: db.collection('metadatas')
    }

    // Cleanup
    await setup(db);

    // Create metadata instance
    var metadata1 = new Metadata(collections, new ObjectId(), [
        { key: 'name', value: 'test image' }
      , { key: 'type', value: 'image' }
      , { key: 'iso', value: 100 }
    ]);

    // Create metadata instance
    var metadata2 = new Metadata(collections, new ObjectId(), [
        { key: 'name', value: 'test image 2' }
      , { key: 'type', value: 'image' }
      , { key: 'iso', value: 200 }
    ]);

    // Create metadata instance
    await metadata1.create();
    await metadata2.create();

    // Locate by single metadata field
    var items = await Metadata.findByFields(collections, {type: 'image'});
    assert.equal(2, items.length);

    // Locate by multiple metadata fields
    var items = await Metadata.findByFields(collections, {type: 'image', iso: 100});
    assert.equal(1, items.length);

    db.close();
  });
});