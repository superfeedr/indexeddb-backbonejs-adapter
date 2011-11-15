(function () { /*global _: false, Backbone: false */
    // Generate four random hex digits.
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }

    // Generate a pseudo-GUID by concatenating random hexadecimal.
    function guid() {
        return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
    }

    // Naming is a mess!
    var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
    var IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction; // No prefix in moz
    var IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange; // No prefix in moz

    /* Horrible Hack to prevent ' Expected an identifier and instead saw 'continue' (a reserved word).'*/
    if (window.indexedDB) {
         indexedDB.prototype._continue =  indexedDB.prototype.continue;
    } else if (window.webkitIDBRequest) {
        webkitIDBRequest.prototype._continue = webkitIDBRequest.prototype.continue;
    } else if(window.mozIndexedDB) {
        mozIndexedDB.prototype._continue = mozIndexedDB.prototype.continue;
    }

    // Driver object
    // That's the interesting part.
    // There is a driver for each schema provided. The schema is a te combination of name (for the database), a version as well as migrations to reach that 
    // version of the database.
    function Driver(schema, ready) {
        this.schema         = schema;
        this.ready          = ready;
        this.error          = null;
        this.transactions   = []; // Used to list all transactions and keep track of active ones.
        this.db             = null;
        this.dbRequest      = indexedDB.open(this.schema.id, this.schema.description || "");
        
        /* DEBUG PURPOSES */
        window.onbeforeunload = function() { 
            // db.close(); 
            chrome.extension.sendRequest({ signature: "debug", params: {message: "DIE"}}, function (response) {});
            // this.transactions.forEach(function(trans) { 
            //     chrome.extension.sendRequest({ signature: "debug", params: {message: "abort"}}, function (response) {});
            //     trans.abort(); 
            // });
            // this.connection.close(); 
            
        }
        /* DEBUG PURPOSES */
        
        this.dbRequest.onsuccess = function (e) {
            this.db = e.target.result; // Attach the connection ot the queue. 
            
            if (this.db.version === _.last(this.schema.migrations).version) {
                // No migration to perform!
                this.ready();
            } else if (this.db.version < _.last(this.schema.migrations).version) {
                // We need to migrate up to the current migration defined in the database
                this.migrate(this.schema.migrations, this.db.version, {
                    success: function () {
                        this.ready();
                    }.bind(this),
                    error: function () {
                        this.error = "Database not up to date. " + this.db.version + " expected was " + _.last(this.schema.migrations).version;
                    }.bind(this)
                });
            } else {
                // Looks like the IndexedDB is at a higher version than the current driver schema.
                this.error = "Database version is greater than current code " + this.db.version + " expected was " + _.last(this.schema.migrations).version;
            }
        }.bind(this);

        this.dbRequest.onerror = function (e) {
            // Failed to open the database
            this.error = "Couldn't not connect to the database"
        }.bind(this);

        this.dbRequest.onabort = function (e) {
            // Failed to open the database
            this.error = "Connection to the database aborted"
        }.bind(this);
    }

    function debug_log(str) {
        if (typeof window.console !== "undefined" && typeof window.console.log !== "undefined") {
            window.console.log(str);
        }
    }

    // Driver Prototype
    Driver.prototype = {

        // Tracks transactions. Mostly for debugging purposes. TO-IMPROVE
        _track_transaction: function(transaction) {
            this.transactions.push(transaction);
            function removeIt() {
                var idx = this.transactions.indexOf(transaction);
                if (idx !== -1) {this.transactions.splice(idx); }
            };
            transaction.oncomplete = removeIt.bind(this);
            transaction.onabort = removeIt.bind(this);
            transaction.onerror = removeIt.bind(this);
        },

        // Performs all the migrations to reach the right version of the database.
        migrate: function (migrations, version, options) {
            debug_log("Starting migrations from " + version);
            this._migrate_next(migrations, version, options);
        },

        // Performs the next migrations. This method is private and should probably not be called.
        _migrate_next: function (migrations, version, options) {
            var that = this;
            var migration = migrations.shift();
            if (migration) {
                if (!version || version < migration.version) {
                    // We need to apply this migration-
                    if (typeof migration.before == "undefined") {
                        migration.before = function (next) {
                            next();
                        };
                    }
                    if (typeof migration.after == "undefined") {
                        migration.after = function (next) {
                            next();
                        };
                    }
                    // First, let's run the before script
                    migration.before(function () {
                        var versionRequest = this.db.setVersion(migration.version);
                        versionRequest.onsuccess = function (e) {
                            var transaction = versionRequest.result;
                            this._track_transaction(transaction);
                            
                            migration.migrate(this.db, versionRequest, function () {
                                // Migration successfully appliedn let's go to the next one!
                                migration.after(function () {
                                    debug_log("Migrated to " + migration.version);
                                    that._migrate_next(migrations, version, options);
                                });
                            });
                        }.bind(this);
                    }.bind(this));
                } else {
                    // No need to apply this migration
                    debug_log("Skipping migration " + migration.version);
                    this._migrate_next(migrations, version, options);
                }
            } else {
                debug_log("Done migrating");
                // No more migration
                options.success();
            }
        },

        // This is the main method, called by the ExecutionQueue when the driver is ready (database open and migration performed)
        execute: function (storeName, method, object, options) {
            switch (method) {
            case "create":
                this.write(storeName, object, options);
                break;
            case "read":
                if (object instanceof Backbone.Collection) {
                    this.query(storeName, object, options); // It's a collection
                } else {
                    this.read(storeName, object, options); // It's a model
                }
                break;
            case "update":
                this.write(storeName, object, options); // We may want to check that this is not a collection. TOFIX
                break;
            case "delete":
                this.delete(storeName, object, options); // We may want to check that this is not a collection. TOFIX
                break;
            default:
                // Hum what?
            }
        },

        // Writes the json to the storeName in db.
        // options are just success and error callbacks.
        write: function (storeName, object, options) {
            var writeTransaction = this.db.transaction([storeName], IDBTransaction.READ_WRITE);
            this._track_transaction(writeTransaction);
            var store = writeTransaction.objectStore(storeName);
            var json = object.toJSON();

            if (!json.id) json.id = guid();

            var writeRequest = store.put(json, json.id);

            writeRequest.onerror = function (e) {
                options.error(e);
            };
            writeRequest.onsuccess = function (e) {
                options.success(json);
            };
        },

        // Reads from storeName in db with json.id if it's there of with any json.xxxx as long as xxx is an index in storeName 
        read: function (storeName, object, options) {
            var readTransaction = this.db.transaction([storeName], IDBTransaction.READ_ONLY);
            this._track_transaction(readTransaction);
            
            var store = readTransaction.objectStore(storeName);
            var json = object.toJSON();


            var getRequest = null;
            if (json.id) {
                getRequest = store.get(json.id);
            } else {
                // We need to find which index we have
                _.each(store.indexNames, function (key, index) {
                    index = store.index(key);
                    if (json[index.keyPath] && !getRequest) {
                        getRequest = index.get(json[index.keyPath]);
                    }
                });
            }
            if (getRequest) {
                getRequest.onsuccess = function (event) {
                    if (event.target.result) {
                        options.success(event.target.result);
                    } else {
                        options.error("Not Found");
                    }
                };
                getRequest.onerror = function () {
                    options.error("Not Found"); // We couldn't find the record.
                }
            } else {
                options.error("Not Found"); // We couldn't even look for it, as we don't have enough data.
            }
        },

        // Deletes the json.id key and value in storeName from db.
        delete: function (storeName, object, options) {
            var deleteTransaction = this.db.transaction([storeName], IDBTransaction.READ_WRITE);
            this._track_transaction(deleteTransaction);
            
            var store = deleteTransaction.objectStore(storeName);
            var json = object.toJSON();

            var deleteRequest = store.delete(json.id);
            deleteRequest.onsuccess = function (event) {
                options.success(null);
            };
            deleteRequest.onerror = function (event) {
                options.error("Not Deleted");
            };
        },

        // Performs a query on storeName in db.
        // options may include :
        // - conditions : value of an index, or range for an index
        // - range : range for the primary key
        // - limit : max number of elements to be yielded
        // - offset : skipped items.
        query: function (storeName, collection, options) {
            var elements = [];
            var skipped = 0, processed = 0;
            var queryTransaction = this.db.transaction([storeName], IDBTransaction.READ_ONLY);
            this._track_transaction(queryTransaction);
            
            var readCursor = null;
            var store = queryTransaction.objectStore(storeName);
            var index = null,
                lower = null,
                upper = null,
                bounds = null;

            if (options.conditions) {
                // We have a condition, we need to use it for the cursor
                _.each(store.indexNames, function (key) {
                    if (!readCursor) {
                        index = store.index(key);
                        if (options.conditions[index.keyPath] instanceof Array) {
                            lower = options.conditions[index.keyPath][0] > options.conditions[index.keyPath][1] ? options.conditions[index.keyPath][1] : options.conditions[index.keyPath][0];
                            upper = options.conditions[index.keyPath][0] > options.conditions[index.keyPath][1] ? options.conditions[index.keyPath][0] : options.conditions[index.keyPath][1];
                            bounds = IDBKeyRange.bound(lower, upper, true, true);
                            
                            if (options.conditions[index.keyPath][0] > options.conditions[index.keyPath][1]) {
                                // Looks like we want the DESC order
                                readCursor = index.openCursor(bounds, 2);
                            } else {
                                // We want ASC order
                                readCursor = index.openCursor(bounds, 0);
                            }
                        } else if (options.conditions[index.keyPath]) {
                            bounds = IDBKeyRange.only(options.conditions[index.keyPath]);
                            readCursor = index.openCursor(bounds);
                        }
                    }
                });
            } else {
                // No conditions, use the index
                if (options.range) {
                    lower = options.range[0] > options.range[1] ? options.range[1] : options.range[0];
                    upper = options.range[0] > options.range[1] ? options.range[0] : options.range[1];
                    bounds = IDBKeyRange.bound(lower, upper);
                    if (options.range[0] > options.range[1]) {
                        readCursor = store.openCursor(bounds, 2);
                    } else {
                        readCursor = store.openCursor(bounds, 0);
                    }
                } else {
                    readCursor = store.openCursor();
                }
            }
            
            if (typeof (readCursor) == "undefined" || !readCursor) {
                options.error("No Cursor");
            } else {
                // Setup a handler for the cursor’s `success` event:
                readCursor.onsuccess = function (e) {
                    var cursor = e.target.result;
                    if (!cursor) {
                        if (options.addIndividually || options.clear) {
                            // nothing!
                            // We need to indicate that we're done. But, how?
                            collection.trigger("reset");
                        } else {
                            options.success(elements); // We're done. No more elements.
                        }
                    }
                    else {
                        // Cursor is not over yet.
                        if (options.limit && processed >= options.limit) {
                            // Yet, we have processed enough elements. So, let's just skip.
                            if (bounds && options.conditions[index.keyPath]) {
                                cursor.continue(options.conditions[index.keyPath][1] + 1); /* We need to 'terminate' the cursor cleany, by moving to the end */
                            } else {
                                cursor.continue(); /* We need to 'terminate' the cursor cleany, by moving to the end */
                            }
                        }
                        else if (options.offset && options.offset > skipped) {
                            skipped++;
                            cursor.continue(options.offset - skipped); /* We need to Moving the cursor forward */
                        } else {
                            // This time, it looks like it's good!
                            processed++;
                            cursor.continue(); 
                            if (options.addIndividually) {
                                collection.add(cursor.value);
                            } else if (options.clear) {
                                var deleteRequest = store.delete(cursor.value.id);
                                deleteRequest.onsuccess = function (event) {
                                    elements.push(cursor.value);
                                };
                                deleteRequest.onerror = function (event) {
                                    elements.push(cursor.value);
                                };
                                
                            } else {
                                elements.push(cursor.value);
                            }
                        }
                    }
                };
            }
        }
    };

    // ExecutionQueue object
    // The execution queue is an abstraction to buffer up requests to the database.
    // It holds a "driver". When the driver is ready, it just fires up the queue and executes in sync.
    function ExecutionQueue(schema) {
        this.driver     = new Driver(schema, this.ready.bind(this));
        this.started    = false;
        this.stack      = [];
    }

    // ExecutionQueue Prototype
    ExecutionQueue.prototype = {
        // Called when the driver is ready
        // It just loops over the elements in the queue and executes them.
        ready: function () {
            this.started = true;
            _.each(this.stack, function (message) {
                this.execute(message);
            }.bind(this));
        },

        // Executes a given command on the driver. If not started, just stacks up one more element.
        execute: function (message) {
            if (this.started) {
                this.driver.execute(message[1].storeName, message[0], message[1], message[2]); // Upon messages, we execute the query
            } else {
                this.stack.push(message);
            }
        }
    };

    // Method used by Backbone for sync of data with data store. It was initially designed to work with "server side" APIs, This wrapper makes 
    // it work with the local indexedDB stuff. It uses the schema attribute provided by the object.
    // The wrapper keeps an active Executuon Queue for each "schema", and executes querues agains it, based on the object type (collection or
    // single model), but also the method... etc.
    // Keeps track of the connections
    var Databases = {};
    
    Backbone.sync = function (method, object, options) {
        var schema = object.database;
        if (!Databases[schema.id]) {
            Databases[schema.id] = new ExecutionQueue(schema);
        }
        Databases[schema.id].execute([method, object, options]);
    };
})();