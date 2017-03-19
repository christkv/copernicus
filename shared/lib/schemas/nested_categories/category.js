"use strict";

var ObjectID = require('mongodb').ObjectID;

/*
 * Create a new category instance
 */
class Category {
  constructor(collections, id, name, category, parent) {
    this.id = id == null ? new ObjectID() : id;
    this.name = name;
    this.category = category;
    this.categories = collections['categories'];

    // If no parent was passed in
    if(!parent) {
      // Split up the category to locate the parent
      var paths = category.split('/');
      paths.pop();
      // Merged all paths to get parent
      this.parent = paths.join('/');
      // Special case of the root
      if(this.parent == '' && category != '/') this.parent = '/';
    }
  }

  /*
   * Create a new mongodb category document
   */
  async create(options = {}) {
    // Insert a new category
    await this.categories.insertOne({
        _id: this.id
      , name: this.name
      , category: this.category
      , parent: this.parent
    }, options);
    return this;
  }

  /*
   * Reload the product information
   */
  async reload() {
    await this.categories.findOne({_id: this.id});
    return this;
  }

  /*
   * Find all direct children categories of a provided category path
   */
  static async findAllDirectChildCategories(collections, path, options = {}) {
    // Regular expression
    var regexp = new RegExp(`^${path}$`);
    var coveredIndex = typeof options.coveredIndex == 'boolean' ? options.coveredIndex : false;

    // Execute as covered index
    if(coveredIndex) {
      var cursor = collections['categories'].find({parent: regexp})
        .project({_id: 0, name: 1, category:1});

      if(options.readPreference) {
        cursor.setReadPreference(options.readPreference);
      }

      // Locate all the categories
      var docs = await cursor.toArray();

      // Map all the docs to category instances
      return docs.map((x) => {
        return new Category(collections, x._id, x.name, x.category, x.parent);
      });
    }

    // Locate all the categories
    var cursor = collections['categories'].find({parent: regexp});

    if(options.readPreference) {
      cursor.setReadPreference(options.readPreference);
    }

    var docs = await cursor.toArray();

    // Map all the docs to category instances
    return docs.map((x) => {
      return new Category(collections, x._id, x.name, x.category, x.parent);
    });
  }

  /*
   * Find all children categories below the provided category path
   */
  static async findAllChildCategories(collections, path, options = {}) {
    // Regular expression
    var regexp = new RegExp(`^${path}`);
    var coveredIndex = typeof options.coveredIndex == 'boolean' ? options.coveredIndex : false;

    // Execute as covered index
    if(coveredIndex) {
      var cursor = collections['categories'].find({parent: regexp})
        .project({_id: 0, name: 1, category:1, parent:1});

      if(options.readPreference) {
        cursor.setReadPreference(options.readPreference);
      }

      // Locate all the categories
      var docs = await cursor.toArray();

      // Map all the docs to category instances
      return docs.map((x) => {
        return new Category(collections, x._id, x.name, x.category, x.parent);
      });
    }

    // Locate all the categories
    var cursor = collections['categories'].find({parent: regexp});

    if(options.readPreference) {
      cursor.setReadPreference(options.readPreference);
    }

    var docs = await cursor.toArray();

    // Map all the docs to category instances
    return docs.map((x) => {
      return new Category(collections, x._id, x.name, x.category, x.parent);
    });
  }

  /*
   * Find a specific category by it's path
   */
  static async findOne(collections, path, options = {}) {
    var coveredIndex = typeof options.coveredIndex == 'boolean' ? options.coveredIndex : false;

    // Execute as covered index
    if(coveredIndex) {
      options['fields'] = {_id: 0, name: 1, category:1, parent:1};
      // Locate all the categories
      var doc = await collections['categories'].findOne({category: path}, options);

      if(!doc) {
        throw new Error(`could not locate category with path ${path}`);
      }

      // Return the mapped category
      return new Category(collections, doc._id, doc.name, doc.category, doc.parent);
    }

    var finalOptions = {};
    if(options.readPreference) {
      finalOptions.readPreference = options.readPreference;
    }

    // Locate all the categories
    var doc = await collections['categories'].findOne({category: path}, finalOptions);

    if(!doc) {
      throw new Error(`could not locate category with path ${path}`);
    }

    // Return the mapped category
    return new Category(collections, doc._id, doc.name, doc.category, doc.parent);
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
    await collections['categories'].ensureIndex({category:1});
    await collections['categories'].ensureIndex({parent:1});
  }
}

module.exports = Category;
