"use strict";

var ObjectId = require('mongodb').ObjectId;

/*
 * Represents a work item from the queue
 */
class Work {
  constructor(collection, jobId, doc) {
    this.queue = collection;
    // this.doc = doc;
    this.jobId = jobId;
    this.doc = doc;
  }

  /*
   * Sets an end time on the work item signaling it's done
   */
  async done(options = {}) {
    // Set end time for the work item
    var r = await this.queue.updateOne({
      jobId: this.jobId
    }, {
      $set: { endTime: new Date() }
    }, options);

    if(r.modifiedCount == 0) {
      throw new Error(`failed to set work item with jobId ${this.jobId} to done`);
    }

    return this;
  }
}

/*
 * Represents a Queue
 */
class Queue {
  constructor(collections) {
    this.queue = collections['queues'];
    // Used for non findAndModifyQueueLookup
    this.reserved = {};
  }

  /*
   * Publish a new item on the queue with a specific priority
   */
  async publish(priority, object, options = {}) {
    // Create 0 date
    var zeroDate = new Date();
    zeroDate.setTime(0);

    // Insert the new item into the queue
    await this.queue.insertOne({
        startTime: zeroDate
      , endTime: zeroDate
      , jobId: new ObjectId()
      , createdOn: new Date()
      , priority: priority
      , payload: object
    }, options);
  }

  /*
   * Fetch the next highest available priority item
   */
  async fetchByPriority(options = {}) {
    // Set the options
    options = Object.assign({}, options, {sort: {priority: -1, createdOn: 1}});
    // Zero date (done so we can test capped collections where documents cannot grow)
    var zeroDate = new Date();
    zeroDate.setTime(0);

    // Find one and update, returning a work item
    var r = await this.queue.findOneAndUpdate({
      startTime: zeroDate
    }, {
      $set: { startTime: new Date() }
    }, options);

    if(r.value == null) {
      throw new Error('found no message in queue');
    }

    return new Work(this.queue, r.value.jobId, r.value);
  }

  /*
   * Fetch the next item in FIFO fashion (by createdOn timestamp)
   */
  async fetchFIFO(options = {}) {
    // Zero date (done so we can test capped collections where documents cannot grow)
    var zeroDate = new Date();
    zeroDate.setTime(0);

    // Set the options
    options = Object.assign({}, options, {sort: {createdOn: 1}});

    // Find one and update, returning a work item
    var r = await this.queue.findOneAndUpdate({
      startTime: zeroDate
    }, {
      $set: { startTime: new Date() }
    }, options);

    if(r.value == null) {
      throw new Error('found no message in queue');
    }

    return new Work(this.queue, r.value.jobId, r.value);
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
    await collections['queues'].ensureIndex({startTime:1});
    await collections['queues'].ensureIndex({createdOn: 1});
    await collections['queues'].ensureIndex({priority:-1, createdOn: 1});
    await collections['queues'].ensureIndex({jobId: 1});
  }
}

module.exports = Queue;
