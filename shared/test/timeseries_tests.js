"use strict";

var co = require('co');

const assert = require('assert');
const {
  ObjectId,
  MongoClient
} = require('mongodb');
const TimeSeries = require('../lib/schemas/time_series/timeseries')

async function setup(db) {
  // All the collections used
  var collections = {
    timeseries: db.collection('timeseries')
  }

  try { await collections['timeseries'].drop(); } catch(err) {}

  await TimeSeries.createOptimalIndexes(collections);
}

describe('Timeseries', () => {
  it('Correctly create and execute ten increments on a timeseries object', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
      timeseries: db.collection('timeseries')
    }

    // Cleanup
    await setup(db);

    // Create a fake range of one second
    var timestamp = new Date();
    timestamp.setHours(1);
    timestamp.setMinutes(0);
    timestamp.setSeconds(0);

    // Create a new TimeSeries instance
    var timeSeries = new TimeSeries(collections, new ObjectId(), 'device1', {}, timestamp, 'minute');
    await timeSeries.create();

    // Increment the counters for all seconds
    for(var i = 0; i < 60; i++) {
      var date = new Date();
      date.setHours(1);
      date.setMinutes(0);
      date.setSeconds(i);

      // Increment the point
      await timeSeries.inc(date, 1);

      // Grab the document and validate correctness
      var doc = await collections['timeseries'].findOne({_id: timeSeries.id});
      assert.ok(doc != null);

      for(var n in doc.series) {
        assert.equal(doc.series[n], 1);
      }
    }

    db.close();
  });

  it('Correctly create and execute ten increments on a timeseries object that is pre allocated for minute', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
      timeseries: db.collection('timeseries')
    }

    // Cleanup
    await setup(db);

    // Create a fake range of one second
    var timestamp = new Date();
    timestamp.setHours(1);
    timestamp.setMinutes(0);
    timestamp.setSeconds(0);

    // Create a new pre-allocated TimeSeries instance
    var timeSeries = await TimeSeries.preAllocateMinute(collections, new ObjectId(), 'device1', timestamp);
    assert.ok(timeSeries != null);

    var date = new Date();
    date.setHours(1);
    date.setMinutes(0);
    date.setSeconds(1);

    // Increment the point
    await timeSeries.inc(date, 1);

    // Grab the document and validate correctness
    var doc = await collections['timeseries'].findOne({_id: timeSeries.id});
    assert.ok(doc != null);
    assert.equal(1, doc.series[1]);
    assert.equal(0, doc.series[0]);

    db.close();
  });

  it('Correctly create and execute ten increments on a timeseries object that is pre allocated for hour', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
      timeseries: db.collection('timeseries')
    }

    // Cleanup
    await setup(db);

    // Create a fake range of one second
    var timestamp = new Date();
    timestamp.setHours(0);
    timestamp.setMinutes(0);
    timestamp.setSeconds(0);

    // Create a new pre-allocated TimeSeries instance
    var timeSeries = await TimeSeries.preAllocateHour(collections, new ObjectId(), 'device1', timestamp);
    assert.ok(timeSeries != null);

    var date = new Date();
    date.setHours(0);
    date.setMinutes(0);
    date.setSeconds(1);

    // Increment the point
    await timeSeries.inc(date, 1);

    // Grab the document and validate correctness
    var doc = await collections['timeseries'].findOne({_id: timeSeries.id});
    assert.ok(doc != null);

    assert.equal(1, doc.series[0][1]);
    assert.equal(0, doc.series[0][0]);

    db.close();
  });

  it('Correctly create and execute ten increments on a timeseries object that is pre allocated for day', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
      timeseries: db.collection('timeseries')
    }

    // Cleanup
    await setup(db);

    // Create a fake range of one second
    var timestamp = new Date();
    timestamp.setDate(10)
    timestamp.setHours(0);
    timestamp.setMinutes(0);
    timestamp.setSeconds(0);

    // Create a new pre-allocated TimeSeries instance
    var timeSeries = await TimeSeries.preAllocateDay(collections, new ObjectId(), 'device1', timestamp);
    assert.ok(timeSeries != null);

    var date = new Date();
    date.setDate(10)
    date.setHours(0);
    date.setMinutes(0);
    date.setSeconds(1);

    // Increment the point
    await timeSeries.inc(date, 1);

    // Grab the document and validate correctness
    var doc = await collections['timeseries'].findOne({_id: timeSeries.id});
    assert.ok(doc != null);

    assert.equal(1, doc.series[0][0][1]);
    assert.equal(0, doc.series[0][0][0]);

    db.close();
  });

  it('Set up 1000 time slots and ensureIndex', async () => {
    var db = await MongoClient.connect('mongodb://localhost:27017/test');

    // All the collections used
    var collections = {
      timeseries: db.collection('timeseries')
    }

    // Cleanup
    await setup(db);

    var left = 1000;

    await TimeSeries.createOptimalIndexes(collections);

    for(var i = 0; i < 1000; i++) {
      var timestamp = new Date();
      timestamp.setMinutes(i);
      timestamp.setSeconds(0);

      // Create a new minute allocation
      await TimeSeries.preAllocateMinute(collections, new ObjectId(), 'device1', timestamp);
    }

    db.close();
  });
});