/**
 * Created by JetBrains PhpStorm.
 * User: calvy
 * Date: 12/01/12
 * Time: 11:52
 * To change this template use File | Settings | File Templates.
 */

//window.console = jstestdriver.console;

var databasev1 = {
    id:"movies-database",
    description:"The database for the Movies",
    migrations:[
        {
            version:1,
            migrate:function (transaction, next) {
                var store = transaction.db.createObjectStore("movies");
                next();
            }
        }
    ]
};

var databasev2 = {
    id:"movies-database",
    description:"The database for the Movies",
    migrations:[
        {
            version:1,
            migrate:function (transaction, next) {
                var store = transaction.db.createObjectStore("movies");
                next();
            }
        },
        {
            version:2,
            migrate:function (transaction, next) {
                var store = undefined;
                if (!transaction.db.objectStoreNames.contains("movies")) {
                    store = transaction.db.createObjectStore("movies");
                }
                store = transaction.objectStore("movies");
                store.createIndex("titleIndex", "title", {
                    unique:false
                });
                store.createIndex("formatIndex", "format", {
                    unique:false
                });
                next();
            }
        }
    ]
};

var MovieV1 = Backbone.Model.extend({
    database:databasev1,
    storeName:"movies"
});

var Movie = Backbone.Model.extend({
    database:databasev2,
    storeName:"movies"
});

var Theater = Backbone.Collection.extend({
    database:databasev2,
    storeName:"movies",
    model:Movie
});

var fallBackDBGuid = guid();

deleteDB(databasev1);
deleteDB(databasev2);


function deleteDB(dbObj) {
    try {

        var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;

        var dbreq = indexedDB.deleteDatabase(dbObj.id);
        dbreq.onsuccess = function (event) {
            var db = event.result;
            jstestdriver.console.log("indexedDB: " + dbObj.id + " deleted");
        }
        dbreq.onerror = function (event) {
            jstestdriver.console.error("indexedDB.delete Error: " + event.message);
        }
    }
    catch (e) {
        jstestdriver.console.error("Error: " + e.message);
        //prefer change id of database to start ont new instance
        dbObj.id = dbObj.id + "." + fallBackDBGuid;
        jstestdriver.console.log("fallback to new database name :" + dbObj.id)
    }
}

// Generate four random hex digits.
function S4() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

// Generate a pseudo-GUID by concatenating random hexadecimal.
function guid() {
    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

var backboneIndexedDBTest = AsyncTestCase('backboneIndexedDBTest');

backboneIndexedDBTest.prototype.testCreateModelV1 = function (queue) {

    queue.call("Try create model v1", function (callbacks) {

        var onSuccess = callbacks.add(function () {
            jstestdriver.console.log("create model v1 Success");
            assertTrue("database & model created", true);
        });

        var onError = callbacks.addErrback(function () {
            jstestdriver.console.log("create model v1 Error");
        });


        var movie = new MovieV1();
        movie.save({
                title:"The Matrix",
                format:"dvd"
            },
            {
                success:onSuccess,
                error:onError});
    });
};


backboneIndexedDBTest.prototype.testCreateModelV2 = function (queue) {
    queue.call("Try create model v2", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                jstestdriver.console.log("create model v2 Success");
                assertTrue("database & model created", true);
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("create model v2 Error");
            });


            var movie = new Movie();
            movie.save({
                    title:"The Matrix 2",
                    format:"dvd"
                },
                {
                    success:onSuccess,
                    error:onError});
        }
    );
};

backboneIndexedDBTest.prototype.testCreateModelBeforeAndNext = function (queue) {

    queue.call("Try create model with before and next", function (callbacks) {

            var stepOnUpgrade = 1;

            var databasev3 = {
                id:"movies-database-beforeandnext",
                description:"The database for the Movies",
                migrations:[
                    {
                        version:1,
                        migrate:function (transaction, next) {
                            var store = transaction.db.createObjectStore("movies");
                            next();
                        }
                    },
                    {
                        version:2,
                        before:callbacks.add(function (next) {
                            jstestdriver.console.log("before");
                            jstestdriver.console.log("migration path step before #1");
                            assertEquals("migration path step before", 1, stepOnUpgrade);
                            stepOnUpgrade++;
                            next();
                        }),
                        migrate:callbacks.add(function (transaction, next) {
                            var store = undefined;
                            if (!transaction.db.objectStoreNames.contains("movies")) {
                                store = transaction.db.createObjectStore("movies");
                            }
                            store = transaction.objectStore("movies");
                            store.createIndex("titleIndex", "title", {
                                unique:false
                            });
                            store.createIndex("formatIndex", "format", {
                                unique:false
                            });
                            jstestdriver.console.log("migration path step migrate #2");
                            assertEquals("migration path step migrate", 2, stepOnUpgrade);
                            stepOnUpgrade++;
                            next();
                        }),
                        after:callbacks.add(function (next) {
                            jstestdriver.console.log("after");
                            var m = new MovieV3();
                            m.save({
                                title:"The Matrix 3",
                                format:"dvd"
                            }, {
                                success:callbacks.add(function () {
                                    jstestdriver.console.log("migration path step save #4");
                                    assertEquals("migration path step save", 4, stepOnUpgrade);
                                    stepOnUpgrade++;
                                })
                            });
                            jstestdriver.console.log("migration path step after #3");
                            assertEquals("migration path step after", 3, stepOnUpgrade);
                            stepOnUpgrade++;
                            next();
                        })
                    }
                ]
            };

            deleteDB(databasev3);

            var MovieV3 = Backbone.Model.extend({
                database:databasev3,
                storeName:"movies"
            });


            var onSuccess = callbacks.add(function () {
                jstestdriver.console.log("get model v3 Success");
                jstestdriver.console.log("migration path step is 5 #5");
                assertEquals("migration path step is 5", 5, stepOnUpgrade);
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("migration path step is 5 #5");
                jstestdriver.console.log("get model v3 Error");
            });


            var movie = new MovieV3({title:"The Matrix 3"});
            movie.fetch({
                success:onSuccess,
                error:onError});
        }
    );
};

backboneIndexedDBTest.prototype.testReadModel = function (queue) {
    var movie = undefined;
    var savedMovie = undefined;
    queue.call("Try create model", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertTrue("model created", true);
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("model v2 Error");
            });


            movie = new Movie();
            movie.save({
                    title:"The Matrix 3",
                    format:"dvd"
                },
                {
                    success:onSuccess,
                    error:onError});
        }
    );

    queue.call("Try read model with id", function (callbacks) {

            var onSuccess = callbacks.add(function (object) {
                assertEquals("The movie should have the right title vs savedMovie", savedMovie.toJSON().title, movie.toJSON().title);
                assertEquals("The movie should have the right format vs savedMovie", savedMovie.toJSON().format, movie.toJSON().format);
                assertEquals("The movie should have the right title vs object", object.toJSON().title, movie.toJSON().title);
                assertEquals("The movie should have the right format vs object", object.toJSON().format, movie.toJSON().format);
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("create model v2 Error");
            });

            console.log("************" + movie.id);
            savedMovie = new Movie({id:movie.id});
            savedMovie.fetch({
                success:onSuccess,
                error:onError});
        }
    );

    queue.call("Try read model with index", function (callbacks) {

            var onSuccess = callbacks.add(function (object) {
                assertEquals("The movie should have the right title vs savedMovie", savedMovie.toJSON().title, movie.toJSON().title);
                assertEquals("The movie should have the right format vs savedMovie", savedMovie.toJSON().format, movie.toJSON().format);
                assertEquals("The movie should have the right title vs object", object.toJSON().title, movie.toJSON().title);
                assertEquals("The movie should have the right format vs object", object.toJSON().format, movie.toJSON().format);
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("can't find mode with title");
            });

            jstestdriver.console.log("************" + movie.toJSON().title);
            savedMovie = new Movie({title:movie.toJSON().title});
            savedMovie.fetch({
                success:onSuccess,
                error:onError});
        }
    );

    queue.call("Try read model that do not exist with index", function (callbacks) {

            var onError = callbacks.add(function (object) {
                assertTrue(true);
            });

            var onSuccess = callbacks.addErrback(function () {
                jstestdriver.console.log("film exist it's an error");
            });

            var nonExistMovie = new Movie({title:"Invalid film"});
            nonExistMovie.fetch({
                success:onSuccess,
                error:onError});
        }
    );
};


backboneIndexedDBTest.prototype.testUpdateModel = function (queue) {
    var movie = undefined;
    queue.call("Try create model", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertTrue("model created", true);
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("model v2 Error");
            });


            movie = new Movie();
            movie.save({
                    title:"Star vars V",
                    format:"dvd"
                },
                {
                    success:onSuccess,
                    error:onError});
        }
    );

    queue.call("Try update model", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertEquals("The movie should have the right title", movie.toJSON().title, "Star Wars V");
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("create model v2 Error");
            });

            movie.save({
                title:"Star Wars V"}, {
                success:onSuccess,
                error:onError});
        }
    );

};


backboneIndexedDBTest.prototype.testDeleteModel = function (queue) {
    var movie = undefined;
    queue.call("Try create model", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertTrue("model created", true);
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("model v2 Error");
            });


            movie = new Movie();
            movie.save({
                    title:"Star vars V",
                    format:"dvd"
                },
                {
                    success:onSuccess,
                    error:onError});
        }
    );

    queue.call("Try delete model", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertTrue(true);
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("create model v2 Error");
            });

            movie.destroy({
                success:onSuccess,
                error:onError});
        }
    );

    queue.call("Try get deleted model", function (callbacks) {

            var onError = callbacks.add(function () {
                assertTrue("can't find deleted model", true);
            });

            var onSuccess = callbacks.addErrback(function () {
                jstestdriver.console.log("deleted object model fetched successfully?");
            });

            movie.fetch({
                success:onSuccess,
                error:onError});
        }
    );
};

function resetMovies(collection) {

    var modelsToDestroy = _.clone(collection.models);
    _.each(modelsToDestroy, function (movie) {
        movie.destroy({wait:false});
    })

    collection.reset();

    var movies = [
        {
            title:"Hello",
            format:"blueray",
            id:"1"
        },
        {
            title:"Bonjour",
            format:"dvd",
            id:"2"
        },
        {
            title:"Halo",
            format:"blueray",
            id:"3"
        },
        {
            title:"Nihao",
            format:"streaming",
            id:"4"
        },
        {
            title:"Ciao",
            format:"dvd",
            id:"5"
        }
    ];

    _.each(movies, function (movie) {
        var m = new Movie();
        m.save(movie);
    });

    collection.reset(movies);

}
;


backboneIndexedDBTest.prototype.testReadCollection = function (queue) {
    var theater = undefined;
    queue.call("Try clean collection", function (callbacks) {

            var onSuccess = callbacks.add(function (model) {
                resetMovies(theater);
                assertEquals("collection created", 5, model.models.length);
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("clean collection Error");
            });

            theater = new Theater();
            var model = theater.fetch(
                {
                    "success":onSuccess,
                    "error":onError
                }
            );

        }
    );

    queue.call("Try read collection with no options", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertEquals("Should have 5 elements", 5, theater.models.length);
                assertEquals("Should have [\"Hello\", \"Bonjour\", \"Halo\", \"Nihao\", \"Ciao\"]", ["Hello", "Bonjour", "Halo", "Nihao", "Ciao"], theater.pluck("title"));
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("read collection with no options Error");
            });

            theater.fetch({
                success:onSuccess,
                error:onError});
        }
    );

    queue.call("Try read collection with limit", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertEquals("Should have 3 elements", 3, theater.models.length);
                assertEquals("Should have [\"Hello\", \"Bonjour\", \"Halo\"]", ["Hello", "Bonjour", "Halo"], theater.pluck("title"));
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("ead collection with limit Error");
            });

            theater.fetch({
                limit:3,
                success:onSuccess,
                error:onError});
        }
    );

    queue.call("Try read collection with offset", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertEquals("Should have 3 elements", 3, theater.models.length);
                assertEquals("Should have [\"Halo\", \"Nihao\", \"Ciao\"]", ["Halo", "Nihao", "Ciao"], theater.pluck("title"));
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("read collection with offset Error");
            });

            theater.fetch({
                offset:2,
                success:onSuccess,
                error:onError});
        }
    );

    queue.call("Try read collection with offset and limit", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertEquals("Should have 3 elements", 3, theater.models.length);
                assertEquals("Should have [\"Halo\", \"Nihao\", \"Ciao\"]", ["Halo", "Nihao", "Ciao"], theater.pluck("title"));
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("read collection with offset and limit Error");
            });

            theater.fetch({
                offset:2,
                success:onSuccess,
                error:onError});
        }
    );

    queue.call("Try read collection with range", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertEquals("Should have 3 elements", 3, theater.models.length);
                assertEquals("Should have [\"Bonjour\", \"Halo\", \"Nihao\"]", ["Bonjour", "Halo", "Nihao"], theater.pluck("title"));
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("ead collection with range Error");
            });

            theater.fetch({
                range:["1.5", "4.5"],
                success:onSuccess,
                error:onError});
        }
    );

    queue.call("Try read collection via condition on index with a single value", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertEquals("Should have 2 elements", 2, theater.models.length);
                assertEquals("Should have [\"Bonjour\", \"Ciao\"]", ["Bonjour", "Ciao"], theater.pluck("title"));
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("read collection via condition on index with a single value Error");
            });

            theater.fetch({
                conditions:{
                    format:"dvd"
                },
                success:onSuccess,
                error:onError});
        }
    );

    queue.call("Try read collection via condition on index with a range and a limit", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertEquals("Should have 2 elements", 2, theater.models.length);
                assertEquals("Should have [\"Hello\", \"Halo\"]", ["Hello", "Halo"], theater.pluck("title"));
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("read collection via condition on index with a range and a limit Error");
            });

            theater.fetch({
                limit:2,
                conditions:{
                    format:["a", "f"]
                },
                success:onSuccess,
                error:onError});
        }
    );

    queue.call("Try read collection via condition on index with a range, an offset and a limit", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertEquals("Should have 2 elements", 2, theater.models.length);
                assertEquals("Should have [\"Bonjour\", \"Ciao\"]", ["Bonjour", "Ciao"], theater.pluck("title"));
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("read collection via condition on index with a range, an offset and a limit Error");
            });

            theater.fetch({
                offset:2,
                limit:2,
                conditions:{
                    format:["a", "f"]
                },
                success:onSuccess,
                error:onError});
        }
    );

    queue.call("Try read collection via condition on index with a range reversed", function (callbacks) {

            var onSuccess = callbacks.add(function () {
                assertEquals("Should have 4 elements", 4, theater.models.length);
                assertEquals("Should have [\"Ciao\", \"Bonjour\", \"Halo\", \"Hello\"]", ["Ciao", "Bonjour", "Halo", "Hello"], theater.pluck("title"));
            });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("read collection via condition on index with a range reversed");
            });

            theater.fetch({
                conditions:{
                    format:["f", "a"]
                },
                success:onSuccess,
                error:onError});
        }
    );


    queue.call("Try support for the 'addIndividually' property", function (callbacks) {


            var onSuccess = callbacks.add(function (model, collection) {

                if(collection.length == 5){
                assertEquals("Should have 5 elements", 5, collection.length);
                }
             });

            var onError = callbacks.addErrback(function () {
                jstestdriver.console.log("support for the 'addIndividually' property error");
            });

            theater = new Theater();
            theater.bind("add", onSuccess);

            theater.fetch({
                addIndividually:true,
                success:onSuccess,
                error:onError});
        }
    );


};
backboneIndexedDBTest.prototype.testRememberAjaxSync = function(queue){
  queue.call("Backbone.ajaxSync should be remembered for models that need async actions",function(callbacks){
      assertEquals("Should be the original Backbone.sync function",typeof Backbone.ajaxSync, "function")
    }
  );
}