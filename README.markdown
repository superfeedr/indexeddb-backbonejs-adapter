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

I added a lot of fun things to the collections, that make use of the `options` param used in Backbone to take advantage of IndexedDB's features, namely indices and cursors and bounds.

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

You can also get all items with a given value for a a specific value of an index. We use the `conditions` keyword.

	var theater = new Theater() // Theater is a collection of movies
	theater.fetch({
		conditions: {genre: "adventure"},
		success: function() {
			// The theater collection will be populated with all the movies whose genre is "adventure"
		}
	});

You can also get all items for which an indexed value is comprised between 2 values. The collection will be sorted based on the order of these 2 keys.

	var theater = new Theater() // Theater is a collection of movies
	theater.fetch({
		conditions: {genre: ["a", "e"]},
		success: function() {
			// The theater collection will be populated with all the movies whose genre is "adventure", "comic", "drama", but not "thriller". 
		}
	});
	


You can also obviously combine all these.








