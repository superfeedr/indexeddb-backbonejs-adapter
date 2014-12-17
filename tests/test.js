var databasev1 = {
    id: "movies-database",
    description: "The database for the Movies",
    migrations: [{
        version: 1,
        migrate: function (transaction, next) {
            var store = transaction.db.createObjectStore("movies");
            next();
        }
    }]
};

var databasev2 = $.extend(true, {}, databasev1);
databasev2.migrations.push(
    {
        version: 2,
        migrate: function (transaction, next) {
            var store = undefined;
            if(!transaction.db.objectStoreNames.contains("movies")){
                store = transaction.db.createObjectStore("movies");
            }
            store = transaction.objectStore("movies");
            store.createIndex("titleIndex", "title", {
                unique: false
            });
            store.createIndex("formatIndex", "format", {
                unique: false
            });
            store.createIndex("yearIndex", "year", {
                unique: false
            });
            store.createIndex("titleAndFormat", ["title", "format"], {
                unique: false
            });
            next();
        }
    }
);

var databasev3 = $.extend(true, {}, databasev2);
databasev3.migrations.push(
    {
        version: 3,
        migrate: function (transaction, next) {
            var store = transaction.db.createObjectStore("torrents", {keyPath: "id"});
            next();
        }
    }
);

var Moviev1 = Backbone.Model.extend({
    database: databasev1,
    storeName: "movies"
});

var Movie = Backbone.Model.extend({
    database: databasev2,
    storeName: "movies"
});

var Torrent = Backbone.Model.extend({
    database: databasev3,
    storeName: "torrents"
});

var Theater = Backbone.Collection.extend({
    database: databasev2,
    storeName: "movies",
    model: Movie
});

function deleteDB(dbObj) {
    try {

        var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB ;

        var dbreq = indexedDB.deleteDatabase(dbObj.id);
        dbreq.onsuccess = function (event) {
            var db = event.result;
            console.log("indexedDB: " + dbObj.id + " deleted");
        }
        dbreq.onerror = function (event) {
            console.error("indexedDB.delete Error: " + event.message);
        }
    }
    catch (e) {
        console.error("Error: " + e.message);
        //prefer change id of database to start ont new instance
        dbObj.id = dbObj.id + "." + guid();
        console.log("fallback to new database name :" + dbObj.id)
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

function addAllMovies(movies, done) {
    if (!movies) {
        movies = [{
            title: "Hello",
            format: "blueray",
            id: "1",
            year: 2006
        }, {
            title: "Bonjour",
            format: "dvd",
            id: "2",
            year: 2002
        }, {
            title: "Halo",
            format: "blueray",
            id: "3",
            year: 2007
        }, {
            title: "Nihao",
            format: "streaming",
            id: "4",
            year: 2004
        }, {
            title: "Ciao",
            format: "dvd",
            id: "5",
            year: 2009
        }];
    }
    var movie = movies.shift();
    if (movie) {
        var m = new Movie();
        m.save(movie, {
            success: function () {
                addAllMovies(movies, done);
            },
            error: function (o, error) {
                start();
                equal(true, false, error.error.target.webkitErrorMessage);
            }
        });
    } else {
        done();
    }
}

function deleteNext(movies, done) {
    if (movies.length === 0) {
        done();
    } else {
        movies[0].destroy({
            success: function () {
                deleteNext(movies, done);
            }
        });
    }
}

function nextTest() {
    var t = tests.shift();
    if (t) {
        console.log(t[0]);
        asyncTest(t[0], t[1]);
    }
}

deleteDB(databasev2);

var tests = [
    ["create model v1", function () {
         var movie = new Moviev1();
         movie.save({
             title: "The Matrix",
             format: "dvd"
         }, {
             success: function () {
                 start();
                 equal(true, true, "The movie should be saved successfully");
                 nextTest();
             },
             error: function (o, error) {
                 start();
                 if (window.console && window.console.log) window.console.log(error);
                 equal(true, false, error.error.target.webkitErrorMessage);
                 nextTest();
             }
         });
    }],
    ["create duplicate models", function () {
        var m = new Movie();
        m.save({
            title: "The Matrix",
            format: "dvd"
        }, {
            success: function () {
                var n = new Movie();
                n.isNew = function() {
                    return true; // BAckbone uses isNew to detecth whether to do an update or a create, and isNew is by default based on the presence of an "id" attribute.
                }
                n.save({
                    id: m.id,
                    title: "The Matrix, the movie",
                    format: "streaming"
                }, {
                    success: function() {
                        // FAIL
                        start();
                        equal(true, false, "The dupe should not have been saved again.");
                        nextTest();
                    },
                    error: function() {
                        start();
                        equal(true, true, "The dupe should been refused.");
                        nextTest();
                    }
                });
                nextTest();
            },
            error: function (o, error) {
                start();
                if (window.console && window.console.log) window.console.log(error);
                equal(true, false, error.error.target.webkitErrorMessage);
                nextTest();
            }
        });
    }],
    ["create model v2", function () {
        var movie = new Movie();
        movie.save({
            title: "The Matrix",
            format: "dvd"
        }, {
            success: function () {
                start();
                equal(true, true, "The movie should be saved successfully");
                nextTest();
            },
            error: function (o, error) {
                start();
                if (window.console && window.console.log) window.console.log(error);
                equal(true, false, error.error.target.webkitErrorMessage);
                nextTest();
            }
        });
    }],
    ["read model with id", function () {
        var movie = new Movie();
        movie.save({
            title: "Avatar",
            format: "blue-ray"
        }, {
            success: function () {
                // Ok, now we need to create a new movie object and retrieve it
                var saved = new Movie({
                    id: movie.id
                });
                saved.fetch({
                    success: function (object) {
                        // success
                        start();
                        equal(saved.toJSON().title, movie.toJSON().title, "The movie should have the right title");
                        equal(saved.toJSON().format, movie.toJSON().format, "The movie should have the right format");
                        equal(object.toJSON().title, movie.toJSON().title, "The movie should have the right title");
                        equal(object.toJSON().format, movie.toJSON().format, "The movie should have the right format");
                        nextTest();
                    },
                    error: function (object, error) {
                        start();
                        equal(true, false, error);
                        nextTest();
                        // Failure
                    }
                });
            },
            error: function (o, error) {
                start();
                equal(true, false, error.error.target.webkitErrorMessage);
                nextTest();
            }
        });
    }],
    ["read model with promise resolve", function () {
        var movie = new Movie();
        movie.save({
            title: "Avatar",
            format: "blue-ray"
        })
        .then(function () {
            // Ok, now we need to create a new movie object and retrieve it
            var saved = new Movie({
                id: movie.id
            });
            saved.fetch()
            .then(function (object) {
                // success
                start();
                equal(saved.toJSON().title, movie.toJSON().title, "The movie should have the right title");
                equal(saved.toJSON().format, movie.toJSON().format, "The movie should have the right format");
                nextTest();
            },
            function (error) {
                start();
                nextTest();
                // Failure
            });
        }, function (o, error) {
            start();
            equal(true, false, error.error.target.webkitErrorMessage);
            nextTest();
        });
    }],
    ["read model with index", function () {
        function saveMovieAndReadWithIndex(movie) {
            movie.save({}, {
                success: function () {
                    // Ok, now we need to create a new movie object and retrieve it
                    var movie2 = new Movie({
                        title: "Avatar"
                    });
                    movie2.fetch({
                        success: function (object) {
                            // success
                            start();
                            equal(movie2.toJSON().title, movie.toJSON().title, "The movie should have the right title");
                            equal(movie2.toJSON().format, movie.toJSON().format, "The movie should have the right format");
                            nextTest();
                        },
                        error: function (object, error) {
                            start();
                            equal(true, false, error);
                            nextTest();
                        }
                    });
                },
                error: function (o, error) {
                    start();
                    equal(true, false, error.error.target.webkitErrorMessage);
                    nextTest();
                }
            });
        }

        var movie = new Movie({
            title: "Avatar"
        });
        movie.fetch({
            success: function () {
                movie.destroy({
                    success: function () {
                        saveMovieAndReadWithIndex(movie);
                    }
                });
            },
            error: function () {
                saveMovieAndReadWithIndex(movie);
            }
        });



    }],
    ["read model that do not exist with index", function () {
        var movie = new Movie({
            title: "Memento"
        });
        movie.fetch({
            success: function (object) {
                // success
                start();
                equal(true, false, error);
                nextTest();
            },
            error: function (object, error) {
                start();
                equal(true, true, error);
                nextTest();
            }
        });
    }],
    ["read model with compound index", function() {
        function saveMovieAndReadWithIndex(movie) {
            movie.save({}, {
                success: function () {
                    // Ok, now we need to create a new movie object and retrieve it
                    var movie2 = new Movie({
                        title: "Halo",
                        format: "dvd"
                    });
                    movie2.fetch({
                        success: function (object) {
                            // success
                            start();
                            equal(movie2.id, movie.id, "The movie should have the right id");
                            equal(movie2.toJSON().title, movie.toJSON().title, "The movie should have the right title");
                            equal(movie2.toJSON().format, movie.toJSON().format, "The movie should have the right format");
                            nextTest();
                        },
                        error: function (object, error) {
                            start();
                            equal(true, false, error);
                            nextTest();
                        }
                    });
                },
                error: function (o, error) {
                    start();
                    equal(true, false, error.error.target.webkitErrorMessage);
                    nextTest();
                }
            });
        }

        var movie = new Movie({
            title: "Halo",
            format: "dvd"
        });
        saveMovieAndReadWithIndex(movie);

    }],
    ["read model with index options", function() {
        function saveMovieAndReadWithIndex(movie) {
            movie.save({}, {
                success: function () {
                    // Ok, now we need to create a new movie object and retrieve it
                    var movie2 = new Movie({
                    });
                    movie2.fetch({
                        index: {
                            name: 'titleAndFormat',
                            value: ['Django Unchained', 'blueray']
                        },
                        success: function (object) {
                            // success
                            start();
                            equal(movie2.id, movie.id, "The movie should have the right id");
                            equal(movie2.toJSON().title, movie.toJSON().title, "The movie should have the right title");
                            equal(movie2.toJSON().format, movie.toJSON().format, "The movie should have the right format");
                            nextTest();
                        },
                        error: function (object, error) {
                            start();
                            equal(true, false, error);
                            nextTest();
                        }
                    });
                },
                error: function (o, error) {
                    start();
                    equal(true, false, error.error.target.webkitErrorMessage);
                    nextTest();
                }
            });
        }

        var movie = new Movie({
            title: "Django Unchained",
            format: "blueray"
        });
        saveMovieAndReadWithIndex(movie);

    }],
    ["update model", function () {
        var movie = new Movie();
        movie.save({
            title: "Star Wars, Episode IV",
            format: "dvd"
        }, {
            success: function () {
                movie.save({
                    title: "Star Wars, Episode V"
                }, {
                    success: function () {
                        movie.fetch({
                            success: function (object) {
                                // success
                                start();
                                equal("Star Wars, Episode V", movie.toJSON().title, "The movie should have the right title");
                                equal("dvd", movie.toJSON().format, "The movie should have the right format");
                                nextTest();
                            },
                            error: function (object, error) {
                                start();
                                equal(true, false, error);
                                nextTest();
                            }
                        });
                    },
                    error: function () {
                        start();
                        equal(true, false, "Would not update");
                        nextTest();
                    }
                });
            },
            error: function (object, error) {
                start();
                equal(true, false, error.error.target.webkitErrorMessage);
                nextTest();
            }
        });
    }],
    ["delete model", function () {
        var movie = new Movie();
        movie.save({
            title: "Avatar",
            format: "blue-ray"
        }, {
            success: function (object) {
                // success
                movie.destroy({
                    success: function (object) {
                        // success
                        equal(true, true, "It should delete the object");
                        movie.fetch({
                            success: function () {
                                start();
                                equal(true, false, "Object was not deleted");
                                nextTest();
                            },
                            error: function (object, error) {
                                start();
                                equal(error, "Not Found", "Object was deleted");
                                nextTest();
                            }
                        });
                    },
                    error: function (object, error) {
                        // error
                        start();
                        equal(true, false, error);
                        nextTest();
                    }
                });
            },
            error: function (error) {
                // error
                start();
                equal(true, false, error.error.target.webkitErrorMessage);
                nextTest();
            }
        });
    }],
    ["read collection with no options", function () {
        var theater = new Theater();
        theater.fetch({
            success: function () {
                deleteNext(theater.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        theater.fetch({
                            success: function () {
                                start();
                                equal(theater.models.length, 5, "Should have 5 elements");
                                deepEqual(theater.pluck("title"), ["Hello", "Bonjour", "Halo", "Nihao", "Ciao"], "Should have [\"Hello\", \"Bonjour\", \"Halo\", \"Nihao\", \"Ciao\"]");

                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection with limit", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            limit: 3,
                            success: function () {
                                start();
                                equal(theater.models.length, 3, "Should have 3 elements");
                                deepEqual(theater.pluck("title"), ["Hello", "Bonjour", "Halo"], "Should have [\"Hello\", \"Bonjour\", \"Halo\"]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection with offset", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            offset: 2,
                            success: function () {
                                start();
                                equal(theater.models.length, 3, "Should have 3 elements");
                                deepEqual(theater.pluck("title"), ["Halo", "Nihao", "Ciao"], "Should have [\"Halo\", \"Nihao\", \"Ciao\"]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection with lowerBound $gte (like mongodb)", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            conditions: {year:{$gte:2006}},
                            success: function () {
                                start();
                                equal(theater.models.length, 3, "Should have 3 elements");
                                deepEqual(theater.pluck("year"), [2006, 2007, 2009], "Should have [2006, 2007, 2009]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection with lowerBound $gt (like mongodb)", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            conditions: {year:{$gt:2006}},
                            success: function () {
                                start();
                                equal(theater.models.length, 2, "Should have 2 elements");
                                deepEqual(theater.pluck("year"), [2007, 2009], "Should have [2007, 2009]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection with upperBound $lte (like mongodb)", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            conditions: {year:{$lte:2006}},
                            success: function () {
                                start();
                                equal(theater.models.length, 3, "Should have 3 elements");
                                deepEqual(theater.pluck("year"), [2002, 2004, 2006], "Should have [2002, 2004, 2006]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection with upperBound $lt (like mongodb)", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            conditions: {year:{$lt:2006}},
                            success: function () {
                                start();
                                equal(theater.models.length, 2, "Should have 2 elements");
                                deepEqual(theater.pluck("year"), [2002, 2004], "Should have [2002, 2004]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection with offset and limit", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            offset: 1,
                            limit: 2,
                            success: function () {
                                start();
                                equal(theater.models.length, 2, "Should have 2 elements");
                                deepEqual(theater.pluck("title"), ["Bonjour", "Halo"], "Should have [\"Bonjour\", \"Halo\"]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection with range", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            range: ["1.5", "4.5"],
                            success: function () {
                                start();
                                equal(theater.models.length, 3, "Should have 3 elements");
                                deepEqual(theater.pluck("title"), ["Bonjour", "Halo", "Nihao"], "Should have [\"Bonjour\", \"Halo\", \"Nihao\"]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection via condition on index with a single value", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            conditions: {
                                format: "dvd"
                            },
                            success: function () {
                                start();
                                equal(theater.models.length, 2, "Should have 2 elements");
                                deepEqual(theater.pluck("title"), ["Bonjour", "Ciao"], "Should have [\"Bonjour\", \"Ciao\"]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection via condition on index with a range", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            conditions: {
                                format: ["a", "f"]
                            },
                            success: function () {
                                start();
                                equal(theater.models.length, 4, "Should have 4 elements");
                                deepEqual(theater.pluck("title"), ["Hello", "Halo", "Bonjour", "Ciao"], "Should have [\"Hello\", \"Halo\", \"Bonjour\", \"Ciao\"]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection via condition on index with a range and filter function", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            conditions: {
                                format: ["a", "f"]
                            },
                            filter: function (movie) {
                                return movie && movie.title && movie.title.charAt(0) === 'H';
                            }
                        }).done(function () {
                            start();
                            equal(theater.models.length, 2, "Should have 2 elements");
                            deepEqual(theater.pluck("title"), ["Hello", "Halo"], "Should have [\"Hello\", \"Halo\"]");
                        }).always(function () {
                            nextTest();
                        });
                    });
                });
            }
        });
    }],
    ["read collection via sort index ascending", function () {
        var theater = new Theater();
        theater.fetch({
            success: function () {
                deleteNext(theater.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        theater.fetch({
                            sort: {
                                index: "yearIndex"
                            },
                            success: function () {
                                start();
                                equal(theater.models.length, 5, "Should have 5 elements");
                                deepEqual(theater.pluck("title"), ["Bonjour", "Nihao", "Hello", "Halo", "Ciao"], "Should have [\"Bonjour\", \"Nihao\", \"Hello\", \"Halo\", \"Ciao\"]");

                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection via sort index descending", function () {
        var theater = new Theater();
        theater.fetch({
            success: function () {
                deleteNext(theater.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        theater.fetch({
                            sort: {
                                index: "yearIndex",
                                order: -1
                            }
                        }).done(function () {
                            start();
                            equal(theater.models.length, 5, "Should have 5 elements");
                            deepEqual(theater.pluck("title"), ["Ciao", "Halo", "Hello", "Nihao", "Bonjour"], "Should have [\"Ciao\", \"Halo\", \"Hello\", \"Nihao\", \"Bonjour\"]");
                        }).always(function () {
                            nextTest();
                        });
                    });
                });
            }
        });
    }],
    ["read collection via sort index descending with filter function", function () {
        var theater = new Theater();
        theater.fetch({
            success: function () {
                deleteNext(theater.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        theater.fetch({
                            sort: {
                                index: "yearIndex",
                                order: -1
                            },
                            filter: function (movie) {
                                return movie && movie.title && movie.title.indexOf("a") !== -1;
                            }
                        }).done(function () {
                            start();
                            equal(theater.models.length, 3, "Should have 3 elements");
                            deepEqual(theater.pluck("title"), ["Ciao", "Halo", "Nihao"], "Should have [\"Ciao\", \"Halo\", \"Nihao\"]");
                        }).always(function () {
                            nextTest();
                        });
                    });
                });
            }
        });
    }],
    ["read collection via condition on index with a range and a limit", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            limit: 2,
                            conditions: {
                                format: ["a", "f"]
                            },
                            success: function () {
                                start();
                                equal(theater.models.length, 2, "Should have 2 elements");
                                deepEqual(theater.pluck("title"), ["Hello", "Halo"], "Should have [\"Hello\", \"Halo\"]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection via condition on index with a range, an offset and a limit", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            offset: 2,
                            limit: 2,
                            conditions: {
                                format: ["a", "f"]
                            },
                            success: function () {
                                start();
                                equal(theater.models.length, 2, "Should have 2 elements");
                                deepEqual(theater.pluck("title"), ["Bonjour", "Ciao"], "Should have [\"Bonjour\", \"Ciao\"]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["read collection via condition on index with a range reversed", function () {
        var theaterToClean = new Theater();
        theaterToClean.fetch({
            success: function () {
                deleteNext(theaterToClean.models, function () {
                    addAllMovies(null, function () {
                        // Now all movies are inserted. Which is good.
                        var theater = new Theater();
                        theater.fetch({
                            conditions: {
                                format: ["f", "a"]
                            },
                            success: function () {
                                start();
                                equal(theater.models.length, 4, "Should have 4 elements");
                                deepEqual(theater.pluck("title"), ["Ciao", "Bonjour", "Halo", "Hello"], "Should have [\"Ciao\", \"Bonjour\", \"Halo\", \"Hello\"]");
                                nextTest();
                            }
                        });
                    });
                });
            }
        });
    }],
    ["support for the 'addIndividually' property", function () {
        var counter = 0,
            theater = new Theater();

        addAllMovies(null, function () {
            expect(5);
            start();
            theater.bind('add', function (model, collection) {
                equal(collection.length, ++counter);
            });
            theater.fetch({ addIndividually: true }).always(nextTest);
        });
    }],
    ["support for the 'abort' function", function () {
        var counter = 0,
            promise,
            theater = new Theater();

        addAllMovies(null, function () {
            expect(5);
            start();
            theater.bind('add', function () {
                counter += 1;
                equal(!!promise, true, "Should return a promise");
                equal(!!promise.abort, true, "Returned promise should have an abort function");
                if (counter === 2) {
                    promise.abort();
                }
            });
            promise = theater.fetch({
                addIndividually: true
            }).always(function () {
                equal(theater.models.length, 2, "Should have 2 elements");
                nextTest();
            });
        });
    }],
    ["support for model specific sync override", function(){
      start();
      equal(typeof Backbone.ajaxSync,'function', "should not be the original Backbone.sync function" );
      nextTest();
    }],
    ["model add with keyPath specified", function(){
        var torrent = new Torrent();
        torrent.isnew = function() { return true};
        torrent.save({
            id: 1,
            title: "The Matrix",
            format: "dvd"
        }, {
            success: function () {
                start();
                equal(true, true, "The torrent should be added successfully");
                nextTest();
            },
            error: function (object, response, error) {
                start();
                if (window.console && window.console.log) window.console.log(error);
                equal(true, false, error.target.webkitErrorMessage);
                nextTest();
            }
        });
    }],
    ["model update with keyPath specified", function(){

        var t = new Torrent();
        t.isnew = function() { return true};
        t.save({
            id: 1,
            title: "The Matrix",
            format: "dvd"
        }, {
            success: function () {
                var torrent = new Torrent({id: 1});
                torrent.fetch({
                    success: function () {
                        start();
                        equal("The Matrix", torrent.get("title"), "The torrent should be fetched successfully");
                        torrent.save({rating: 5}, {
                            success: function() {
                                equal(true, true, "The torrent should be updated succesfully");
                                nextTest();
                            },
                            error: function (object, response, error) {
                              if (window.console && window.console.log) window.console.log(error);
                              equal(true, false, response);
                              nextTest();
                          }
                      });
                    },
                    error: function (object, response, options) {
                        if (window.console && window.console.log) window.console.log(response);
                        equal(true, false, response);
                        nextTest();
                    }
                });
            },
            error: function (object, response, error) {
                start();
                if (window.console && window.console.log) window.console.log(error);
                equal(true, false, error.target.webkitErrorMessage);
                nextTest();
            }
        });
    }],
    ["Use AjaxSync when no database is specified", function(){
        var testModel = Backbone.Model.extend({});

        var testCollection = Backbone.Collection.extend({
            model: testModel,
            url: "mockAjax.json"
        });

        var testCollectionInstance = new testCollection();

        testCollectionInstance.fetch({
            success: function(){
                start();
                equal(testCollectionInstance.length, 2, "Collection successfully fetched");
                nextTest();
            },
            error : function(){
                start();
                ok(false, "Collection not fetched");
                nextTest();
            }
        });
    }]
];

// Let's go run the tests

nextTest();