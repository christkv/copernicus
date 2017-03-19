"use strict";

/*
 * Create a new category instance
 */
class Category {
  constructor(collections, id, names) {
    this.id = id == null ? new ObjectID() : id;

    // Hash of all the names by local ('en-us') etc
    // { 'en-us': 'computers' }
    this.names = names || {};

    // Collections used
    this.categories = collections['categories'];
    this.products = collections['products'];
  }

  /*
   * Add a new name local to the category, update relevant products
   */
  async addLocal(local, name, options = {}) {
    // Build set statement
    var setStatement = {}
    // Set the new local
    setStatement[`names.${local}`] = name;

    // Update the category with the new local for the name
    var r = await this.categories.updateOne({
      _id: this.id
    }, {
      $set: setStatement
    }, options);

    if(r.modifiedCount == 0 && r.n == 0) {
      throw new Error(`could not modify category with id ${this.id}`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    // Set up the update statement
    var updateStatement = {};
    updateStatement[`categories.$.names.${local}`] = name;

    // Update all the products that have the category cached
    var r = await this.products.updateMany({
      'categories._id': this.id
    }, {
      $set: updateStatement
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }
  }

  /*
   * Remove a new name local from the category, update relevant products
   */
  async removeLocal(local, options = {}) {
    // Build set statement
    var setStatement = {}
    // UnSet the new local
    setStatement[`names.${local}`] = '';

    // Update the category with the new local for the name
    var r = await this.categories.updateOne({
      _id: this.id
    }, {
      $unset: setStatement
    }, options);

    if(r.modifiedCount == 0 && r.n == 0) {
      throw new Error(`could not modify category with id ${this.id}`);
    }

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    // Set up the update statement
    var updateStatement = {};
    updateStatement[`categories.$.names.${local}`] = '' ;

    // Update all the products that have the category cached
    var r = await this.products.updateMany({
      'categories._id': this.id
    }, {
      $unset: updateStatement
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }
  }

  /*
   * Create a new mongodb category document
   */
  async create(options = {}) {
    // Insert a new category
    var r = await this.categories.insertOne({
        _id: this.id
      , names: this.names
    }, options);

    if(r.result.writeConcernError) {
      throw r.result.writeConcernError;
    }

    return this;
  }

  /*
   * Reload the category information
   */
  async reload() {
    var doc = await this.categories.findOne({_id: this.id});
    this.names = doc.names;
    return this;
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
  }
}

module.exports = Category;
