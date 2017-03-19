"use strict";

/*
 * Represents a topic
 */
class Topic {
  constructor(collections, sizeInBytes, maxMessages) {
    this.sizeInBytes = sizeInBytes;
    this.maxMessages = maxMessages;
    this.topic = collections['topics'];
  }

  /*
   * Push an object to the topic
   */
  async publish(object, options = {}) {
    // Insert a document into topic
    await this.topic.insertOne({
        createdOn: new Date()
      , payload: object
    }, options);
  }

  /*
   * Simple cursor builder, does not try to deal with reconnect etc
   */
  async listen(from, options = {awaitData: true}) {
    var query = {}
    // We provided a filter allowing us to skip ahead
    if(from) query.createdOn = { $gte: from };
    // Create cursor
    var cursor = this.topic.find(query);
    // Set the tailable cursor options
    cursor = cursor.addCursorFlag('tailable', true)
      .addCursorFlag('awaitData', options.awaitData);
    // Return the cursor
    return cursor;
  }

  /*
   * Create a topic
   */
  async create() {
    // Collection options
    var options = {
        capped:true
      , size: this.sizeInBytes
    }
    // Get the collection name
    var collectionName = this.topic.collectionName;
    // Get the db object associated with the collection
    var db = this.topic.s.db;

    // Create the capped collection
    var collection = await db.createCollection(collectionName, options);
    this.topic = collection;
    return this;
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
  }
}

module.exports = Topic;
