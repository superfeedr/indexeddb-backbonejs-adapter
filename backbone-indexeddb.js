// Generate four random hex digits.
function S4() {
   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
};

// Generate a pseudo-GUID by concatenating random hexadecimal.
function guid() {
   return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
};

window.indexedDB      = window.webkitIndexedDB;
window.IDBTransaction = window.webkitIDBTransaction;
window.IDBKeyRange    = window.webkitIDBKeyRange;

// Contact object
function Driver() {
};

Driver.prototype = {
	migrate: function(db, migrations, version, options) {
		console.log("Starting migrations from " + version)
		this._migrate_next(db, migrations, version, options);
	},
	
	_migrate_next: function(db, migrations, version, options) {
		that = this
		var migration = migrations.shift()
		if( migration ) {
			if(!version || version < migration.version) {
				// We need to apply this migration
				var versionRequest = db.setVersion(migration.version );
				versionRequest.onsuccess = function ( e ) {
					migration.migrate(db, versionRequest, function() {
						// Migration successfully appliedn let's go to the next one!
						console.log("Migrated to " + migration.version)
						that._migrate_next(db, migrations, version, options)
					});
				};
			}
			else {
				// No need to apply this migration
				console.log("Skipping migration " + migration.version)
				this._migrate_next(db, migrations, version, options)
			}
		} else {
			// No more migration
			options.success();
		}
	},
	
	/* This is the main method. */
	/*
	create → POST   /collection
	read → GET   /collection[/id]
	update → PUT   /collection/id
	delete → DELETE   /collection/id
	*/
	execute: function(db, storeName, method, json, options) {
		switch(method) {
			case "create":
				this.write(db, storeName, json, options)
				break;
			case "read":
				if(json instanceof Array ) {
					this.query(db, storeName, json, options) // It's a collection
				} else {
					this.read(db, storeName, json, options) // It's a Model
				}
				break;
			case "update":
				this.write(db, storeName, json, options) // We may want to check that this is not a collection
				break;
			case "delete":
				this.delete(db, storeName, json, options) // We may want to check that this is not a collection
				break;
			default:
				// Hum what?
		}
	},

	write: function(db, storeName, json, options) {
		var writeTransaction = db.transaction([storeName], IDBTransaction.READ_WRITE, 0);
		var store = writeTransaction.objectStore( storeName );

	    if (!json.id) json.id = guid();
		
		var writeRequest = store.put(json, json.id);
		
		writeRequest.onerror = function ( e ) {
			options.error(e)
		};
		writeRequest.onsuccess = function ( e ) {
			options.success(json)
		};
	},
	
	read: function(db, storeName, json, options) {
		var readTransaction = db.transaction([storeName], IDBTransaction.READ_ONLY);
		var store = readTransaction.objectStore(storeName);
		var getRequest = null
		if(json.id) {
			getRequest = store.get(json.id);
		} else {
			// We need to find which index we have
			_.each(store.indexNames, function(key, index) {
				index = store.index(key);
				if(json[index.keyPath]) {
					getRequest = index.get(json[index.keyPath]);
				}
			})
		}
		getRequest.onsuccess = function(event){
			if(event.target.result) {
				options.success(event.target.result)
			}
			else {
				options.error("Not Found")
			}
		};
	},
	
	delete: function(db, storeName, json, options) {
		var deleteTransaction = db.transaction([storeName], IDBTransaction.READ_WRITE);
		var store = deleteTransaction.objectStore( storeName );
		var deleteRequest = store.delete(json.id );
		deleteRequest.onsuccess = function(event){
			options.success(null)
		};
		deleteRequest.onerror = function(event){
			options.error("Not Found")
		}
	},
	
	query: function(db, storeName, json, options) {
		var elements = [];
		var skipped = 0;
		var queryTransaction = db.transaction([storeName], IDBTransaction.READ_ONLY);
		var readCursor = null;
		var store = queryTransaction.objectStore( storeName );

		if(options.conditions) {
			// We have a condition, we need to use it for the cursor
			_.each(store.indexNames, function(key, index) {
				index = store.index(key);
				if(options.conditions[index.keyPath] instanceof Array) {
					bounds = new IDBKeyRange.bound(options.conditions[index.keyPath][0], options.conditions[index.keyPath][1])
					readCursor = index.openCursor(bounds);
				} else if(options.conditions[index.keyPath]) {
					bounds = new IDBKeyRange.only(options.conditions[index.keyPath])
					readCursor = index.openCursor(bounds);
				}
			});
		} else {
			// No conditions, use the index
			if(options.range) {
				bounds = new IDBKeyRange.bound(options.range[0], options.range[1])
				readCursor = store.openCursor(bounds);
			} else {
				readCursor = store.openCursor();
			}
		}

		// Setup a handler for the cursor’s `success` event:
		readCursor.onsuccess = function ( e ) {
			cursor = event.target.result;
			if( (cursor) && 
				(!options.limit || options.limit > elements.length)
			  ) {
				if(!options.offset || options.offset <= skipped ) {
					elements.push(event.target.result.value)
				} else {
					skipped ++;
				}
				cursor.continue();
			}
			else {
				options.success(elements)
			}
		};
	}
};


window.driver 		= new Driver();

Backbone.sync = function(method, object, options) {
	database = object.database
	storeName = object.storeName

	console.log(database.id + " :: " + storeName + " :: " + method)

	dbRequest = window.indexedDB.open(database.id, database.description || "");

	dbRequest.onsuccess = function ( e ) { 
		var db = e.target.result;		
		
		if ( db.version === _.last(object.database.migrations).version ) {
			driver.execute(db, storeName, method, object.toJSON(), options)
		} else if(db.version < _.last(object.database.migrations).version ) {
			driver.migrate(db, object.database.migrations, db.version, {
				success: function() {
					driver.execute(db, storeName, method, object.toJSON(), options)
				}, 
				error: function() {
					options.error("Database not up to date. " + db.version + " expected was " + _.last(object.database.migrations).version)
				}
			});
		} else {
			options.error("Database version is greater than current code " + db.version + " expected was " +_.last(object.database.migrations).version)
		}
	};
	
	dbRequest.onerror   = function ( e ) { 
		// Failed to open the database
		options.error("Couldn't not connect to the database") // We probably need to show a better error log.
	};

};