This is an [IndexedDB](http://www.w3.org/TR/IndexedDB/) adapter for [Backbone.js](http://documentcloud.github.com/backbone/).

# Warnings

This is a very very very first attempt. I was _only_ tested with Google Chrome 11.
It also requires the current development version of BackboneJS ([branch 0.4.0](https://github.com/documentcloud/backbone/tree/0.4.0)).

*It lacks a lot of documentation, so it's good idea to look at the tests if you're interested in using it.*

# Implementation

## Database & Schema

Both your Backbone model and collections need to point to a `database` and a `storeName` attributes that are used by the adapter.

The `storeName` is the name of the store used for the objects of this Model or Collection. You _should_ use the same `storeName` for the model and collections of that same model.

The `database` is a JSON object that define the following :
 * `id` : and unique id for the database
 * `description` :  a description of the database [OPTIONAL]
 * `migrations` : an array of migration to be applied to the database to get the schema that your app needs.

The migrations are JSON objects with the following :
 * `version` : the version of the database once the migration is applied.
 * `migrate` : a Javascript function that will be called by the driver to perform the migration. It is called with a `IDBDatabase` object, a `IDBVersionChangeRequest` object and a function that needs to be called when the migration is performed, so that the next migration can be executed.

### Example

	var database = {
		id: "my-database",
		description: "The database for the Movies",
		migrations : [
			{
				version: "1.0",
				migrate: function(db, versionRequest, next) {
					var store = db.createObjectStore("movies"); // Adds a store, we will use "movies" as the storeName in our Movie model and Collections
					next();
				}
			}, {
				version: "1.1",
				migrate: function(db, versionRequest, next) {
					var store = versionRequest.transaction.objectStore("movies")
					store.createIndex("titleIndex", "title", { unique: false});  // Adds an index on the movies titles
					store.createIndex("formatIndex", "format", { unique: false}); // Adds an index on the movies formats
					next();
				}
			}
		]
	}
