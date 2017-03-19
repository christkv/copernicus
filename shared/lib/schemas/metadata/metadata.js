"use strict";

/*
 * Create a new metadata instance
 */
class MetaData {
  constructor(collections, id, metadata) {
    this.id = id;
    this.metadatas = collections['metadatas'];
    this.metadata = metadata;
  }

  /*
   * Create a new metadata document on mongodb
   */
  async create() {
    // Insert the metadata
    await this.metadatas.insertOne({
        _id: this.id
      , metadata: this.metadata
    });

    return this;
  }

  /*
   * Search using metadata fields
   */
  static async findByFields(collections, fields, options = {}) {
    var queryParts = [];

    for(var name in fields) {
      queryParts.push({$elemMatch: {key: name, value: fields[name] }});
    }

    // Generate correct query
    var finalQuery = queryParts.length == 1
      ? { metadata: queryParts[0] }
      : { metadata: { $all: queryParts } };

    // Create cursor
    var cursor = collections['metadatas'].find(finalQuery);
    if(options.readPreference) {
      cursor.setReadPreference(options.readPreference);
    }

    // Execute the query
    var docs = await cursor.toArray();
    return docs.map((x) => {
      return new MetaData(collections, x._id, x.metadata);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static async createOptimalIndexes(collections) {
    await collections['metadatas'].ensureIndex({"metadata.key": 1, "metadata.value": 1});
  }
}

module.exports = MetaData;
