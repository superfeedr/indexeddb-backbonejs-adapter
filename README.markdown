[![build status](https://secure.travis-ci.org/superfeedr/indexeddb-backbonejs-adapter.png)](http://travis-ci.org/superfeedr/indexeddb-backbonejs-adapter)
This is an [IndexedDB](http://www.w3.org/TR/IndexedDB/) adapter for [Backbone.js](http://documentcloud.github.com/backbone/).

# Warnings

*It lacks a lot of documentation, so it's good idea to look at the tests if you're interested in using it.*

# Browser support and limitations

In Firefox, `backbone-indexeddb.js` should work from 4.0 up; but it

* won't work at all with local files (`file:///` URLs). As soon as you try to create the database it will raise an error `Permission denied for <file://> to create wrapper for object of class UnnamedClass`
* will ask the user for permission before creating a database
* requests permission again when the database grows to a certain size (50MB by default). After this the disk is the limit, unlike the fairly concrete and currently fixed limit (5MB by default) that `localStorage` gets (which will just fail after that with no way to ask the user to increase it).

Chrome 11 and later are supported. (Chrome 9 and 10 should also work but are untested.) In Chrome 11, `backbone-indexeddb.js`

* will work with `file:///` URLs, but
* poses some hard size limit (5MB? quantity untested) unless Chrome is started with `--unlimited-quota-for-indexeddb`, with apparently no way to request increasing the quota.

IE10 support has been added thanks to [lcalvy](https://github.com/lcalvy).

Other browsers implementing the Indexed Database API Working Draft should work, with some of these limitations possibly cropping up or possibly not. Support and ease of use is expected to improve in upcoming releases of browsers.

# Tests

Just open the <code>/tests/test.html</code> in your favorite browser. (or serve if from a webserver for Firefox, which can't run indexedDB on local file.)

# Node

This is quite useless to most people, but there is also an npm module for this. It's useless because IndexedDB hasn't been (yet?) ported to node.js.
It can be used in the context of [browserify](https://github.com/substack/node-browserify) though... and this is exactly why this npm version exists.

# Implementation

## Database & Schema

Both your Backbone model and collections need to point to a `database` and a `storeName` attributes that are used by the adapter.

The `storeName` is the name of the store used for the objects of this Model or Collection. You _should_ use the same `storeName` for the model and collections of that same model.

The `database` is an object literal that define the following :

 * `id` : and unique id for the database
 * `description` :  a description of the database [OPTIONAL]
 * `migrations` : an array of migration to be applied to the database to get the schema that your app needs.

The migrations are object literals with the following :

 * `version` : the version of the database once the migration is applied.
 * `migrate` : a Javascript function that will be called by the driver to perform the migration. It is called with a `IDBDatabase` object, a `IDBVersionChangeRequest` object and a function that needs to be called when the migration is performed, so that the next migration can be executed.
 * `before` *[optional]* : a Javascript function that will be called with the database, before the transaction is run. It's useful to update fields before updating the schema.
 * `after` *[optional]* : a Javascript function that will be called with the database, after the transaction has been run. It's useful to update fields after updating the schema.

### Example

	var database = {
		id: "my-database",
		description: "The database for the Movies",
		migrations : [
			{
				version: "1.0",
				before: function(db, next) {
				    // Do magic stuff before the migration. For example, before adding indices, the Chrome implementation requires to set define a value for each of the objects.
				    next();
				}
				migrate: function(db, versionRequest, next) {
					var store = db.createObjectStore("movies"); // Adds a store, we will use "movies" as the storeName in our Movie model and Collections
					next();
				}
			}, {
				version: "1.1",
				migrate: function(db, versionRequest, next) {
					var store = versionRequest.transaction.objectStore("movies")
					store.createIndex("titleIndex", "title", { unique: true});  // Adds an index on the movies titles
					store.createIndex("formatIndex", "format", { unique: false}); // Adds an index on the movies formats
					store.createIndex("genreIndex", "genre", { unique: false}); // Adds an index on the movies genres
					next();
				}
			}
		]
	}

## Models

Not much change to your usual models. The only significant change is that you can now fetch a given model with its id, or with a value for one of its index.

For example, in your traditional backbone apps, you would do something like :

	var movie = new Movie({id: "123"})
	movie.fetch()

to fetch from the remote server the Movie with the id `123`. This is convenient when you know the id. With this adapter, you can do something like

	var movie = new Movie({title: "Avatar"})
	movie.fetch()

Obviously, to perform this, you need to have and index on `title`, and a movie with "Avatar" as a title obviously. If the index is not unique, the database will only return the first one.

## Collections

I added a lot of fun things to the collections, that make use of the `options` param used in Backbone to take advantage of IndexedDB's features, namely **indices, cursors and bounds**.

First, you can `limit` and `offset` the number of items that are being fetched by a collection.

	var theater = new Theater() // Theater is a collection of movies
	theater.fetch({
		offset: 1,
		limit: 3,
		success: function() {
			// The theater collection will be populated with at most 3 items, skipping the first one
		}
	});

You can also *provide a range* applied to the id.

	var theater = new Theater() // Theater is a collection of movies
	theater.fetch({
		range: ["a", "b"],
		success: function() {
			// The theater collection will be populated with all the items with an id comprised between "a" and "b" ("alphonse" is between "a" and "b")
		}
	});

You can also get *all items with a given value for a specific value of an index*. We use the `conditions` keyword.

	var theater = new Theater() // Theater is a collection of movies
	theater.fetch({
		conditions: {genre: "adventure"},
		success: function() {
			// The theater collection will be populated with all the movies whose genre is "adventure"
		}
	});

You can also *get all items for which an indexed value is comprised between 2 values*. The collection will be sorted based on the order of these 2 keys.

	var theater = new Theater() // Theater is a collection of movies
	theater.fetch({
		conditions: {genre: ["a", "e"]},
		success: function() {
			// The theater collection will be populated with all the movies whose genre is "adventure", "comic", "drama", but not "thriller".
		}
	});

You can also *get all items after a certain object (excluding that object), or from a certain object (including) to a certain object (including)* (using their ids). This combined with the addIndividually option allows you to lazy load a full collection, by always loading the next element.

    	var theater = new Theater() // Theater is a collection of movies
    	theater.fetch({
    		from: new Movie({id: 12345, ...}),
    		after: new Movie({id: 12345, ...}),
    		to: new Movie({id: 12345, ...}),
    		success: function() {
    			// The theater collection will be populated with all the movies whose genre is "adventure", "comic", "drama", but not "thriller".
    		}
    	});


You can also obviously combine all these.

## Optional Persistence
If needing to persist via ajax as well as indexed-db, just override your model's sync to use ajax instead.

```coffeescript
class MyMode extends Backbone.Model

  sync: Backbone.ajaxSync
```

Any more complex dual persistence can be provided in method overrides, which could eventually drive out the design for a multi-layer persistence adapter.



