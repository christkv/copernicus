"use strict";

var co = require('co');

const assert = require('assert');
const {
  ObjectId,
  MongoClient
} = require('mongodb');
const Queue = require('../lib/schemas/queue/queue');
const Topic = require('../lib/schemas/queue/topic');

async function setup(db) {
  // All the collections used
  var collections = {
      queues: db.collection('queues')
    , queues2: db.collection('queues2')
    , topics: db.collection('topics')
    , topics2: db.collection('topics2')
  }

  try { await collections['queues'].drop(); } catch(err) {};
  try { await collections['queues2'].drop(); } catch(err) {};
  try { await collections['topics'].drop(); } catch(err) {};
  try { await collections['topics2'].drop(); } catch(err) {};
  await Queue.createOptimalIndexes(collections);
  await Topic.createOptimalIndexes(collections);
}

describe('Queue', () => {
  it('Should correctly insert job into queue', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        queues: db.collection('queues')
      , topics: db.collection('topics')
    }

    // Cleanup
    await setup(db);

    // Create a queue
    var queue = new Queue(collections);

    // Add some items to queue
    async function addToQueue() {
      await queue.publish(1, {work:1});
      await queue.publish(5, {work:2});
      await queue.publish(3, {work:3});
    }

    // Add the queues
    await addToQueue();
    var work = await queue.fetchByPriority();
    assert.ok(work != null);
    assert.equal(5, work.doc.priority);

    var work = await queue.fetchFIFO();
    assert.ok(work != null);
    assert.equal(1, work.doc.priority);

    db.close();
  });

  it('Should correctly insert job into topic and listen to it', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
        queues: db.collection('queues')
      , topics: db.collection('topics')
    }

    // Cleanup
    await setup(db);

    // Create a queue
    var topic = new Topic(collections, 10000, 10000);
    await topic.create()
    assert.ok(topic != null);

    // Add some items to queue
    async function addToTopic(callback) {
      await topic.publish({work:1});
      await topic.publish({work:2});
      await topic.publish({work:3});
    }

    // Add the queues
    await addToTopic();

    // Set the timeout
    setTimeout(() => {
      var docs = [];
      var cursor = topic.listen(null, {awaitData: false});
      cursor.on('data', function(doc) {
        docs.push(doc);
      });

      cursor.on('end', function() {
        assert.equal(3, docs.length);

        db.close();
        assert.done();
      });
    }, 2000);
  });
});