var Backbone = require('backbone'),
    backboneIndexeddb = require('../backbone-indexeddb.js'),
    sys = require('sys');

var Thing = Backbone.Model.extend({
    database: {
        id: "things",
        description: "The database for the things",
        migrations: [{
            version:1,
            migrate:function (transaction, next) {
                var store = transaction.db.createObjectStore("things");
                next();
            }
        }]
    },
    storeName: "things"
    
});

//backboneIndexeddb.sync("read", new Thing(), {}); // we just export the sync method.