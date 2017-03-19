"use strict";

/*
 * Create a new Timeseries instance
 */
class TimeSeries {
  constructor(collections, id, tag, series, timestamp, resolution) {
    this.collections = collections;
    this.id = id == null ? new ObjectID() : id;
    this.series = series;
    this.timestamp = timestamp;
    this.tag = tag;
    this.resolution = resolution;
    this.timeseries = collections['timeseries'];
  }

  /*
   * Create a new timeseries bucket document on mongodb
   */
  async create(options = {}) {
    // Insert the metadata
    await this.timeseries.insertOne({
        _id: this.id
      , tag: this.tag
      , series: this.series || {}
      , timestamp: this.timestamp
      , modifiedOn: new Date()
    }, options);
    return this;
  }

  /*
   * Increment a measurement
   */
  async inc(time, measurement, options = {}) {
    // Update statement for time series
    var updateStatement = {
        $inc: {}
      , $setOnInsert: {
          tag: this.tag
        , timestamp: this.timestamp
        , resolution: this.resolution
      }
      , $set: {
        modifiedOn: new Date()
      }
    };

    // Handle the resolution
    if(this.resolution == 'minute') {
      updateStatement['$inc'][`series.${time.getSeconds()}`] = measurement;
    } else if(this.resolution == 'hour') {
      updateStatement['$inc'][`series.${time.getMinutes()}.${time.getSeconds()}`] = measurement;
    } else if(this.resolution == 'day') {
      updateStatement['$inc'][`series.${time.getHours()}.${time.getMinutes()}.${time.getSeconds()}`] = measurement;
    }

    // Clone options
    options = Object.assign({}, options, {upsert:true});

    // Execute the update
    var r = await this.timeseries.updateOne({
        _id: this.id
      , tag: this.tag
      , timestamp: this.timestamp
    }, updateStatement, options);

    if(r.upsertedCount == 0 && r.modifiedCount == 0) {
      throw new Error(`could not correctly update or upsert the timeseries document with id ${this.id}`);
    }

    return this;
  }

  /*
   * Pre allocate a minute worth of measurements in a document
   */
  static async preAllocateMinute(collections, id, tag, timestamp) {
    var series = {};

    for(var i = 0; i < 60; i++) {
      series[i] = 0
    }

    var timeSeries = new TimeSeries(collections, id, tag, series, timestamp, 'minute');
    await timeSeries.create();
    return timeSeries;
  }

  /*
   * Pre allocate an hour worth of measurements in a document
   */
  static async preAllocateHour(collections, id, tag, timestamp) {
    var series = {};

    // Allocate minutes
    for(var j = 0; j < 60; j++) {
      series[j] = {};

      // Allocate seconds
      for(var i = 0; i < 60; i++) {
        series[j][i] = 0
      }
    }

    var timeSeries = new TimeSeries(collections, id, tag, series, timestamp, 'hour');
    await timeSeries.create();
    return timeSeries;
  }

  /*
   * Pre allocate a day worth of measurements in a document
   */
  static async preAllocateDay(collections, id, tag, timestamp) {
    var series = {};

    // Allocate hours
    for(var k = 0; k < 24; k++) {
      series[k] = {};

      // Allocate minutes
      for(var j = 0; j < 60; j++) {
        series[k][j] = {};

        // Allocate seconds
        for(var i = 0; i < 60; i++) {
          series[k][j][i] = 0
        }
      }
    }

    var timeSeries = new TimeSeries(collections, id, tag, series, timestamp, 'day');
    await timeSeries.create();
    return timeSeries;
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
    await collections['timeseries'].ensureIndex({tag: 1, timestamp:1});
  }
}

module.exports = TimeSeries;
