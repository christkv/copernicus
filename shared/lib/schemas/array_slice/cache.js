"use strict";

/*
  Uses $slice to keep the latest X number of items in the cache avoiding
  growing documents

  Allow for layered cache

  a positive sliceAt will slice from the front and a negative from the end

  ex:
    var array =  [ 40, 50, 60 ]
    var sliceAt = -5
    var items = [ 80, 78, 86 ]
    var result = [  50,  60,  80,  78,  86 ]

    var array =  [ 89, 90 ]
    var sliceAt = 3
    var items = [ 100, 20 ]
    var result = [  89,  90,  100 ]
*/
class SliceCache {
  constructor(collections, id, sliceAt) {
    this.id = id == null ? new ObjectID() : id;
    this.collections = collections;
    this.sliceAt = sliceAt;
    this.cache = collections['cache'];
  }

  /*
   * Create a new cache entry with optional pre-allocation
   */
  async create(object) {
    // Pre-allocated array
    var data = [];

    // If we have an object we can pre-allocate the maximum array size
    if(object) {
      // Create array of max object size
      for(var i = 0; i < this.sliceAt; i++) {
        data.push(object);
      }
    }

    // Insert the metadata
    var r = await this.cache.insertOne({
        _id: this.id
      , sliceAt: this.sliceAt
      , data: data
    });

    // If we have an object, remove the array with an
    // update leaving the document pre-allocated
    if(!object) return this;

    // Remove array (keeps the document in place with pre-allocated space)
    var r = await this.cache.updateOne({
      _id: this.id
    }, { $set: { data: [] } })

    if(r.modifiedCount == 0) {
      throw new Error(`failed to clear out pre-allocated array for object ${this.id}`);
    }
  }

  /*
   * Push the object to the end of the list keeping in mind our slice option
   */
  async push(items, position, options = {}) {
    // Treat this as an array operation
    if(!Array.isArray(items)) {
      items = [items];
    }

    // The push operation
    var pushOperation =  {
      data: {
          $each: items
        , $slice: -this.sliceAt
      }
    }

    // We provided a position for adding the items
    if(typeof position == 'number') {
      pushOperation.data['$position'] = position;
    }

    // Push and slice
    var r = await this.cache.updateOne({
      _id: this.id
    }, {
      $push: pushOperation
    }, options);

    if(r.modifiedCount == 0) {
      throw new Error(`failed to push items to cache object with id ${this.id}`);
    }
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(cachesCollection, options = {}) {}
}

module.exports = SliceCache;
