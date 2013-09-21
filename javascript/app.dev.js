/**
 * Lawnchair!
 * --- 
 * clientside json store 
 *
 */
var Lawnchair = function (options, callback) {
    // ensure Lawnchair was called as a constructor
    if (!(this instanceof Lawnchair)) return new Lawnchair(options, callback);

    // lawnchair requires json 
    if (!JSON) throw 'JSON unavailable! Include http://www.json.org/json2.js to fix.'
    // options are optional; callback is not
    if (arguments.length <= 2 && arguments.length > 0) {
        callback = (typeof arguments[0] === 'function') ? arguments[0] : arguments[1];
        options  = (typeof arguments[0] === 'function') ? {} : arguments[0];
    } else {
        throw 'Incorrect # of ctor args!'
    }
    // TODO perhaps allow for pub/sub instead?
    if (typeof callback !== 'function') throw 'No callback was provided';
    
    // default configuration 
    this.record = options.record || 'record'  // default for records
    this.name   = options.name   || 'records' // default name for underlying store
    
    // mixin first valid  adapter
    var adapter
    // if the adapter is passed in we try to load that only
    if (options.adapter) {
        for (var i = 0, l = Lawnchair.adapters.length; i < l; i++) {
            if (Lawnchair.adapters[i].adapter === options.adapter) {
              adapter = Lawnchair.adapters[i].valid() ? Lawnchair.adapters[i] : undefined;
              break;
            }
        }
    // otherwise find the first valid adapter for this env
    } 
    else {
        for (var i = 0, l = Lawnchair.adapters.length; i < l; i++) {
            adapter = Lawnchair.adapters[i].valid() ? Lawnchair.adapters[i] : undefined
            if (adapter) break 
        }
    } 
    
    // we have failed 
    if (!adapter) throw 'No valid adapter.' 
    
    // yay! mixin the adapter 
    for (var j in adapter)  
        this[j] = adapter[j]
    
    // call init for each mixed in plugin
    for (var i = 0, l = Lawnchair.plugins.length; i < l; i++) 
        Lawnchair.plugins[i].call(this)

    // init the adapter 
    this.init(options, callback)
}

Lawnchair.adapters = [] 

/** 
 * queues an adapter for mixin
 * ===
 * - ensures an adapter conforms to a specific interface
 *
 */
Lawnchair.adapter = function (id, obj) {
    // add the adapter id to the adapter obj
    // ugly here for a  cleaner dsl for implementing adapters
    obj['adapter'] = id
    // methods required to implement a lawnchair adapter 
    var implementing = 'adapter valid init keys save batch get exists all remove nuke'.split(' ')
    ,   indexOf = this.prototype.indexOf
    // mix in the adapter   
    for (var i in obj) {
        if (indexOf(implementing, i) === -1) throw 'Invalid adapter! Nonstandard method: ' + i
    }
    // if we made it this far the adapter interface is valid 
	// insert the new adapter as the preferred adapter
	Lawnchair.adapters.splice(0,0,obj)
}

Lawnchair.plugins = []

/**
 * generic shallow extension for plugins
 * ===
 * - if an init method is found it registers it to be called when the lawnchair is inited 
 * - yes we could use hasOwnProp but nobody here is an asshole
 */ 
Lawnchair.plugin = function (obj) {
    for (var i in obj) 
        i === 'init' ? Lawnchair.plugins.push(obj[i]) : this.prototype[i] = obj[i]
}

/**
 * helpers
 *
 */
Lawnchair.prototype = {

    isArray: Array.isArray || function(o) { return Object.prototype.toString.call(o) === '[object Array]' },
    
    /**
     * this code exists for ie8... for more background see:
     * http://www.flickr.com/photos/westcoastlogic/5955365742/in/photostream
     */
    indexOf: function(ary, item, i, l) {
        if (ary.indexOf) return ary.indexOf(item)
        for (i = 0, l = ary.length; i < l; i++) if (ary[i] === item) return i
        return -1
    },

    // awesome shorthand callbacks as strings. this is shameless theft from dojo.
    lambda: function (callback) {
        return this.fn(this.record, callback)
    },

    // first stab at named parameters for terse callbacks; dojo: first != best // ;D
    fn: function (name, callback) {
        return typeof callback == 'string' ? new Function(name, callback) : callback
    },

    // returns a unique identifier (by way of Backbone.localStorage.js)
    // TODO investigate smaller UUIDs to cut on storage cost
    uuid: function () {
        var S4 = function () {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        }
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    },

    // a classic iterator
    each: function (callback) {
        var cb = this.lambda(callback)
        // iterate from chain
        if (this.__results) {
            for (var i = 0, l = this.__results.length; i < l; i++) cb.call(this, this.__results[i], i) 
        }  
        // otherwise iterate the entire collection 
        else {
            this.all(function(r) {
                for (var i = 0, l = r.length; i < l; i++) cb.call(this, r[i], i)
            })
        }
        return this
    }
// --
};
/**
 * dom storage adapter 
 * === 
 * - originally authored by Joseph Pecoraro
 *
 */ 
//
// TODO does it make sense to be chainable all over the place?
// chainable: nuke, remove, all, get, save, all    
// not chainable: valid, keys
//
Lawnchair.adapter('dom', (function() {
    var storage = window.localStorage
    // the indexer is an encapsulation of the helpers needed to keep an ordered index of the keys
    var indexer = function(name) {
        return {
            // the key
            key: name + '._index_',
            // returns the index
            all: function() {
				var a  = storage.getItem(this.key)
				if (a) {
					a = JSON.parse(a)
				}
                if (a === null) storage.setItem(this.key, JSON.stringify([])) // lazy init
                return JSON.parse(storage.getItem(this.key))
            },
            // adds a key to the index
            add: function (key) {
                var a = this.all()
                a.push(key)
                storage.setItem(this.key, JSON.stringify(a))
            },
            // deletes a key from the index
            del: function (key) {
                var a = this.all(), r = []
                // FIXME this is crazy inefficient but I'm in a strata meeting and half concentrating
                for (var i = 0, l = a.length; i < l; i++) {
                    if (a[i] != key) r.push(a[i])
                }
                storage.setItem(this.key, JSON.stringify(r))
            },
            // returns index for a key
            find: function (key) {
                var a = this.all()
                for (var i = 0, l = a.length; i < l; i++) {
                    if (key === a[i]) return i 
                }
                return false
            }
        }
    }
    
    // adapter api 
    return {
    
        // ensure we are in an env with localStorage 
        valid: function () {
            return !!storage 
        },

        init: function (options, callback) {
            this.indexer = indexer(this.name)
            if (callback) this.fn(this.name, callback).call(this, this)  
        },
        
        save: function (obj, callback) {
            var key = obj.key ? this.name + '.' + obj.key : this.name + '.' + this.uuid()
            // if the key is not in the index push it on
            if (this.indexer.find(key) === false) this.indexer.add(key)
            // now we kil the key and use it in the store colleciton    
            delete obj.key;
            storage.setItem(key, JSON.stringify(obj))
            obj.key = key.slice(this.name.length + 1)
            if (callback) {
                this.lambda(callback).call(this, obj)
            }
            return this
        },

        batch: function (ary, callback) {
            var saved = []
            // not particularily efficient but this is more for sqlite situations
            for (var i = 0, l = ary.length; i < l; i++) {
                this.save(ary[i], function(r){
                    saved.push(r)
                })
            }
            if (callback) this.lambda(callback).call(this, saved)
            return this
        },
       
        // accepts [options], callback
        keys: function(callback) {
            if (callback) { 
                var name = this.name
                ,   keys = this.indexer.all().map(function(r){ return r.replace(name + '.', '') })
                this.fn('keys', callback).call(this, keys)
            }
            return this // TODO options for limit/offset, return promise
        },
        
        get: function (key, callback) {
            if (this.isArray(key)) {
                var r = []
                for (var i = 0, l = key.length; i < l; i++) {
                    var k = this.name + '.' + key[i]
                    var obj = storage.getItem(k)
                    if (obj) {
						obj = JSON.parse(obj)
                        obj.key = key[i]
                        r.push(obj)
                    } 
                }
                if (callback) this.lambda(callback).call(this, r)
            } else {
                var k = this.name + '.' + key
                var  obj = storage.getItem(k)
                if (obj) {
					obj = JSON.parse(obj)
					obj.key = key
				}
                if (callback) this.lambda(callback).call(this, obj)
            }
            return this
        },

        exists: function (key, cb) {
            var exists = this.indexer.find(this.name+'.'+key) === false ? false : true ;
            this.lambda(cb).call(this, exists);
            return this;
        },
        // NOTE adapters cannot set this.__results but plugins do
        // this probably should be reviewed
        all: function (callback) {
            var idx = this.indexer.all()
            ,   r   = []
            ,   o
            ,   k
            for (var i = 0, l = idx.length; i < l; i++) {
                k     = idx[i] //v
                o     = JSON.parse(storage.getItem(k))
                o.key = k.replace(this.name + '.', '')
                r.push(o)
            }
            if (callback) this.fn(this.name, callback).call(this, r)
            return this
        },
        
        remove: function (keyOrObj, callback) {
            var key = this.name + '.' + ((keyOrObj.key) ? keyOrObj.key : keyOrObj)
            this.indexer.del(key)
            storage.removeItem(key)
            if (callback) this.lambda(callback).call(this)
            return this
        },
        
        nuke: function (callback) {
            this.all(function(r) {
                for (var i = 0, l = r.length; i < l; i++) {
                    this.remove(r[i]);
                }
                if (callback) this.lambda(callback).call(this)
            })
            return this 
        }
}})());
// window.name code courtesy Remy Sharp: http://24ways.org/2009/breaking-out-the-edges-of-the-browser
Lawnchair.adapter('window-name', (function(index, store) {

    var data = window.top.name ? JSON.parse(window.top.name) : {}

    return {

        valid: function () {
            return typeof window.top.name != 'undefined' 
        },

        init: function (options, callback) {
            data[this.name] = data[this.name] || {index:[],store:{}}
            index = data[this.name].index
            store = data[this.name].store
            this.fn(this.name, callback).call(this, this)
        },

        keys: function (callback) {
            this.fn('keys', callback).call(this, index)
            return this
        },

        save: function (obj, cb) {
            // data[key] = value + ''; // force to string
            // window.top.name = JSON.stringify(data);
            var key = obj.key || this.uuid()
            if (obj.key) delete obj.key 
            this.exists(key, function(exists) {
                if (!exists) index.push(key)
                store[key] = obj
                window.top.name = JSON.stringify(data) // TODO wow, this is the only diff from the memory adapter
                obj.key = key
                if (cb) {
                    this.lambda(cb).call(this, obj)
                }
            })
            return this
        },

        batch: function (objs, cb) {
            var r = []
            for (var i = 0, l = objs.length; i < l; i++) {
                this.save(objs[i], function(record) {
                    r.push(record)
                })
            }
            if (cb) this.lambda(cb).call(this, r)
            return this
        },
        
        get: function (keyOrArray, cb) {
            var r;
            if (this.isArray(keyOrArray)) {
                r = []
                for (var i = 0, l = keyOrArray.length; i < l; i++) {
                    r.push(store[keyOrArray[i]]) 
                }
            } else {
                r = store[keyOrArray]
                if (r) r.key = keyOrArray
            }
            if (cb) this.lambda(cb).call(this, r)
            return this 
        },
        
        exists: function (key, cb) {
            this.lambda(cb).call(this, !!(store[key]))
            return this
        },

        all: function (cb) {
            var r = []
            for (var i = 0, l = index.length; i < l; i++) {
                var obj = store[index[i]]
                obj.key = index[i]
                r.push(obj)
            }
            this.fn(this.name, cb).call(this, r)
            return this
        },
        
        remove: function (keyOrArray, cb) {
            var del = this.isArray(keyOrArray) ? keyOrArray : [keyOrArray]
            for (var i = 0, l = del.length; i < l; i++) {
                delete store[del[i]]
                index.splice(this.indexOf(index, del[i]), 1)
            }
            window.top.name = JSON.stringify(data)
            if (cb) this.lambda(cb).call(this)
            return this
        },

        nuke: function (cb) {
            storage = {}
            index = []
            window.top.name = JSON.stringify(data)
            if (cb) this.lambda(cb).call(this)
            return this 
        }
    }
/////
})())

/**
 * indexed db adapter
 * === 
 * - originally authored by Vivian Li
 *
 */ 

Lawnchair.adapter('indexed-db', (function(){
    
  function fail(e, i) { console.log('error in indexed-db adapter!', e, i); debugger; } ;
     
  function getIDB(){
    return window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.oIndexedDB || window.msIndexedDB;
  }; 
  
  
    
  return {
    
    valid: function() { return !!getIDB(); },
    
    init:function(options, callback) {
        this.idb = getIDB();
        this.waiting = [];
        var request = this.idb.open(this.name);
        var self = this;
        var cb = self.fn(self.name, callback);
        var win = function(){ return cb.call(self, self); }
        
        request.onsuccess = function(event) {
           self.db = request.result; 
            
            if(self.db.version != "1.0") {
              var setVrequest = self.db.setVersion("1.0");
              // onsuccess is the only place we can create Object Stores
              setVrequest.onsuccess = function(e) {
                  self.store = self.db.createObjectStore("teststore", { autoIncrement: true} );
                  for (var i = 0; i < self.waiting.length; i++) {
                      self.waiting[i].call(self);
                  }
                  self.waiting = [];
                  win();
              };
              setVrequest.onerror = function(e) {
                  console.log("Failed to create objectstore " + e);
                  fail(e);
              }
            } else {
                self.store = {};
                for (var i = 0; i < self.waiting.length; i++) {
                      self.waiting[i].call(self);
                }
                self.waiting = [];
                win();
            }
        }
        request.onerror = fail;
    },

    save:function(obj, callback) {
        if(!this.store) {
            this.waiting.push(function() {
                this.save(obj, callback);
            });
            return;
         }
         
         var self = this;
         var win  = function (e) { if (callback) { obj.key = e.target.result; self.lambda(callback).call(self, obj) }};
         
         var trans = this.db.transaction(["teststore"], webkitIDBTransaction.READ_WRITE);
         var store = trans.objectStore("teststore");
         var request = obj.key ? store.put(obj, obj.key) : store.put(obj);
         
         request.onsuccess = win;
         request.onerror = fail;
         
         return this;
    },
    
    // FIXME this should be a batch insert / just getting the test to pass...
    batch: function (objs, cb) {
        
        var results = []
        ,   done = false
        ,   self = this

        var updateProgress = function(obj) {
            results.push(obj)
            done = results.length === objs.length
        }

        var checkProgress = setInterval(function() {
            if (done) {
                if (cb) self.lambda(cb).call(self, results)
                clearInterval(checkProgress)
            }
        }, 200)

        for (var i = 0, l = objs.length; i < l; i++) 
            this.save(objs[i], updateProgress)
        
        return this
    },
    

    get:function(key, callback) {
        if(!this.store) {
            this.waiting.push(function() {
                this.get(key, callback);
            });
            return;
        }
        
        
        var self = this;
        var win  = function (e) { if (callback) { self.lambda(callback).call(self, e.target.result) }};
        
        
        if (!this.isArray(key)){
            var req = this.db.transaction("teststore").objectStore("teststore").get(key);

            req.onsuccess = win;
            req.onerror = function(event) {
                console.log("Failed to find " + key);
                fail(event);
            };
        
        // FIXME: again the setInterval solution to async callbacks..    
        } else {

            // note: these are hosted.
            var results = []
            ,   done = false
            ,   keys = key

            var updateProgress = function(obj) {
                results.push(obj)
                done = results.length === keys.length
            }

            var checkProgress = setInterval(function() {
                if (done) {
                    if (callback) self.lambda(callback).call(self, results)
                    clearInterval(checkProgress)
                }
            }, 200)

            for (var i = 0, l = keys.length; i < l; i++) 
                this.get(keys[i], updateProgress)
            
        }

        return this;
    },

    all:function(callback) {
        if(!this.store) {
            this.waiting.push(function() {
                this.all(callback);
            });
            return;
        }
        var cb = this.fn(this.name, callback) || undefined;
        var self = this;
        var objectStore = this.db.transaction("teststore").objectStore("teststore");
        var toReturn = [];
        objectStore.openCursor().onsuccess = function(event) {
          var cursor = event.target.result;
          if (cursor) {
               toReturn.push(cursor.value);
               cursor.continue();
          }
          else {
              if (cb) cb.call(self, toReturn);
          }
        };
        return this;
    },

    remove:function(keyOrObj, callback) {
        if(!this.store) {
            this.waiting.push(function() {
                this.remove(keyOrObj, callback);
            });
            return;
        }
        if (typeof keyOrObj == "object") {
            keyOrObj = keyOrObj.key;
        }
        var self = this;
        var win  = function () { if (callback) self.lambda(callback).call(self) };
        
        var request = this.db.transaction(["teststore"], webkitIDBTransaction.READ_WRITE).objectStore("teststore").delete(keyOrObj);
        request.onsuccess = win;
        request.onerror = fail;
        return this;
    },

    nuke:function(callback) {
        if(!this.store) {
            this.waiting.push(function() {
                this.nuke(callback);
            });
            return;
        }
        
        var self = this
        ,   win  = callback ? function() { self.lambda(callback).call(self) } : function(){};
        
        try {
            this.db
                .transaction(["teststore"], webkitIDBTransaction.READ_WRITE)
                .objectStore("teststore").clear().onsuccess = win;
            
        } catch(e) {
            fail();
        }
        return this;
    }
    
  };
  
})());
Lawnchair.adapter('webkit-sqlite', (function () {
    // private methods 
    var fail = function (e, i) { console.log('error in sqlite adaptor!', e, i) }
    ,   now  = function () { return new Date() } // FIXME need to use better date fn
	// not entirely sure if this is needed...
    if (!Function.prototype.bind) {
        Function.prototype.bind = function( obj ) {
            var slice = [].slice
            ,   args  = slice.call(arguments, 1) 
            ,   self  = this
            ,   nop   = function () {} 
            ,   bound = function () {
                    return self.apply(this instanceof nop ? this : (obj || {}), args.concat(slice.call(arguments))) 
                }
            nop.prototype   = self.prototype
            bound.prototype = new nop()
            return bound
        }
    }

    // public methods
    return {
    
        valid: function() { return !!(window.openDatabase) },

        init: function (options, callback) {
            var that   = this
            ,   cb     = that.fn(that.name, callback)
            ,   create = "CREATE TABLE IF NOT EXISTS " + this.name + " (id NVARCHAR(32) UNIQUE PRIMARY KEY, value TEXT, timestamp REAL)"
            ,   win    = function(){ return cb.call(that, that); }
            // open a connection and create the db if it doesn't exist 
            this.db = openDatabase(this.name, '1.0.0', this.name, 65536)
            this.db.transaction(function (t) { 
                t.executeSql(create, [], win, fail) 
            })
        }, 

        keys:  function (callback) {
            var cb   = this.lambda(callback)
            ,   that = this
            ,   keys = "SELECT id FROM " + this.name + " ORDER BY timestamp DESC"

            this.db.transaction(function(t) {
                var win = function (xxx, results) {
                    if (results.rows.length == 0 ) {
                        cb.call(that, [])
                    } else {
                        var r = [];
                        for (var i = 0, l = results.rows.length; i < l; i++) {
                            r.push(results.rows.item(i).id);
                        }
                        cb.call(that, r)
                    }
                }
                t.executeSql(keys, [], win, fail)
            })
            return this
        },
        // you think thats air you're breathing now?
        save: function (obj, callback) {
            var that = this
            ,   id   = obj.key || that.uuid()
            ,   ins  = "INSERT INTO " + this.name + " (value, timestamp, id) VALUES (?,?,?)"
            ,   up   = "UPDATE " + this.name + " SET value=?, timestamp=? WHERE id=?"
            ,   win  = function () { if (callback) { obj.key = id; that.lambda(callback).call(that, obj) }}
            ,   val  = [now(), id]
			// existential 
            that.exists(obj.key, function(exists) {
                // transactions are like condoms
                that.db.transaction(function(t) {
					// TODO move timestamp to a plugin
                    var insert = function (obj) {
                        val.unshift(JSON.stringify(obj))
                        t.executeSql(ins, val, win, fail)
                    }
					// TODO move timestamp to a plugin
                    var update = function (obj) {
                        delete(obj.key)
                        val.unshift(JSON.stringify(obj))
                        t.executeSql(up, val, win, fail)
                    }
					// pretty
                    exists ? update(obj) : insert(obj)
                })
            });
            return this
        }, 

		// FIXME this should be a batch insert / just getting the test to pass...
        batch: function (objs, cb) {
			
			var results = []
			,   done = false
			,   that = this

			var updateProgress = function(obj) {
				results.push(obj)
				done = results.length === objs.length
			}

			var checkProgress = setInterval(function() {
				if (done) {
					if (cb) that.lambda(cb).call(that, results)
					clearInterval(checkProgress)
				}
			}, 200)

			for (var i = 0, l = objs.length; i < l; i++) 
				this.save(objs[i], updateProgress)
			
            return this
        },

        get: function (keyOrArray, cb) {
			var that = this
			,   sql  = ''
            // batch selects support
			if (this.isArray(keyOrArray)) {
				sql = 'SELECT id, value FROM ' + this.name + " WHERE id IN ('" + keyOrArray.join("','") + "')"
			} else {
				sql = 'SELECT id, value FROM ' + this.name + " WHERE id = '" + keyOrArray + "'"
			}	
			// FIXME
            // will always loop the results but cleans it up if not a batch return at the end..
			// in other words, this could be faster
			var win = function (xxx, results) {
				var o = null
				,   r = []
				if (results.rows.length) {
					for (var i = 0, l = results.rows.length; i < l; i++) {
						o = JSON.parse(results.rows.item(i).value)
						o.key = results.rows.item(i).id
						r.push(o)
					}
				}
				if (!that.isArray(keyOrArray)) r = r.length ? r[0] : null
				if (cb) that.lambda(cb).call(that, r)
            }
            this.db.transaction(function(t){ t.executeSql(sql, [], win, fail) })
            return this 
		},

		exists: function (key, cb) {
			var is = "SELECT * FROM " + this.name + " WHERE id = ?"
			,   that = this
			,   win = function(xxx, results) { if (cb) that.fn('exists', cb).call(that, (results.rows.length > 0)) }
			this.db.transaction(function(t){ t.executeSql(is, [key], win, fail) })
			return this
		},

		all: function (callback) {
			var that = this
			,   all  = "SELECT * FROM " + this.name
			,   r    = []
			,   cb   = this.fn(this.name, callback) || undefined
			,   win  = function (xxx, results) {
				if (results.rows.length != 0) {
					for (var i = 0, l = results.rows.length; i < l; i++) {
						var obj = JSON.parse(results.rows.item(i).value)
						obj.key = results.rows.item(i).id
						r.push(obj)
					}
				}
				if (cb) cb.call(that, r)
			}

			this.db.transaction(function (t) { 
				t.executeSql(all, [], win, fail) 
			})
			return this
		},

		remove: function (keyOrObj, cb) {
			var that = this
			,   key  = typeof keyOrObj === 'string' ? keyOrObj : keyOrObj.key
			,   del  = "DELETE FROM " + this.name + " WHERE id = ?"
			,   win  = function () { if (cb) that.lambda(cb).call(that) }

			this.db.transaction( function (t) {
				t.executeSql(del, [key], win, fail);
			});

			return this;
		},

		nuke: function (cb) {
			var nuke = "DELETE FROM " + this.name
			,   that = this
			,   win  = cb ? function() { that.lambda(cb).call(that) } : function(){}
				this.db.transaction(function (t) { 
				t.executeSql(nuke, [], win, fail) 
			})
			return this
		}
//////
}})())

/*

Copyright (C) 2011 by Yehuda Katz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/

// lib/handlebars/browser-prefix.js
var Handlebars = {};

(function(Handlebars, undefined) {
;
// lib/handlebars/base.js

Handlebars.VERSION = "1.0.0";
Handlebars.COMPILER_REVISION = 4;

Handlebars.REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '>= 1.0.0'
};

Handlebars.helpers  = {};
Handlebars.partials = {};

var toString = Object.prototype.toString,
    functionType = '[object Function]',
    objectType = '[object Object]';

Handlebars.registerHelper = function(name, fn, inverse) {
  if (toString.call(name) === objectType) {
    if (inverse || fn) { throw new Handlebars.Exception('Arg not supported with multiple helpers'); }
    Handlebars.Utils.extend(this.helpers, name);
  } else {
    if (inverse) { fn.not = inverse; }
    this.helpers[name] = fn;
  }
};

Handlebars.registerPartial = function(name, str) {
  if (toString.call(name) === objectType) {
    Handlebars.Utils.extend(this.partials,  name);
  } else {
    this.partials[name] = str;
  }
};

Handlebars.registerHelper('helperMissing', function(arg) {
  if(arguments.length === 2) {
    return undefined;
  } else {
    throw new Error("Missing helper: '" + arg + "'");
  }
});

Handlebars.registerHelper('blockHelperMissing', function(context, options) {
  var inverse = options.inverse || function() {}, fn = options.fn;

  var type = toString.call(context);

  if(type === functionType) { context = context.call(this); }

  if(context === true) {
    return fn(this);
  } else if(context === false || context == null) {
    return inverse(this);
  } else if(type === "[object Array]") {
    if(context.length > 0) {
      return Handlebars.helpers.each(context, options);
    } else {
      return inverse(this);
    }
  } else {
    return fn(context);
  }
});

Handlebars.K = function() {};

Handlebars.createFrame = Object.create || function(object) {
  Handlebars.K.prototype = object;
  var obj = new Handlebars.K();
  Handlebars.K.prototype = null;
  return obj;
};

Handlebars.logger = {
  DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, level: 3,

  methodMap: {0: 'debug', 1: 'info', 2: 'warn', 3: 'error'},

  // can be overridden in the host environment
  log: function(level, obj) {
    if (Handlebars.logger.level <= level) {
      var method = Handlebars.logger.methodMap[level];
      if (typeof console !== 'undefined' && console[method]) {
        console[method].call(console, obj);
      }
    }
  }
};

Handlebars.log = function(level, obj) { Handlebars.logger.log(level, obj); };

Handlebars.registerHelper('each', function(context, options) {
  var fn = options.fn, inverse = options.inverse;
  var i = 0, ret = "", data;

  var type = toString.call(context);
  if(type === functionType) { context = context.call(this); }

  if (options.data) {
    data = Handlebars.createFrame(options.data);
  }

  if(context && typeof context === 'object') {
    if(context instanceof Array){
      for(var j = context.length; i<j; i++) {
        if (data) { data.index = i; }
        ret = ret + fn(context[i], { data: data });
      }
    } else {
      for(var key in context) {
        if(context.hasOwnProperty(key)) {
          if(data) { data.key = key; }
          ret = ret + fn(context[key], {data: data});
          i++;
        }
      }
    }
  }

  if(i === 0){
    ret = inverse(this);
  }

  return ret;
});

Handlebars.registerHelper('if', function(conditional, options) {
  var type = toString.call(conditional);
  if(type === functionType) { conditional = conditional.call(this); }

  if(!conditional || Handlebars.Utils.isEmpty(conditional)) {
    return options.inverse(this);
  } else {
    return options.fn(this);
  }
});

Handlebars.registerHelper('unless', function(conditional, options) {
  return Handlebars.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn});
});

Handlebars.registerHelper('with', function(context, options) {
  var type = toString.call(context);
  if(type === functionType) { context = context.call(this); }

  if (!Handlebars.Utils.isEmpty(context)) return options.fn(context);
});

Handlebars.registerHelper('log', function(context, options) {
  var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
  Handlebars.log(level, context);
});
;
// lib/handlebars/utils.js

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

Handlebars.Exception = function(message) {
  var tmp = Error.prototype.constructor.apply(this, arguments);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }
};
Handlebars.Exception.prototype = new Error();

// Build out our basic SafeString type
Handlebars.SafeString = function(string) {
  this.string = string;
};
Handlebars.SafeString.prototype.toString = function() {
  return this.string.toString();
};

var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

var badChars = /[&<>"'`]/g;
var possible = /[&<>"'`]/;

var escapeChar = function(chr) {
  return escape[chr] || "&amp;";
};

Handlebars.Utils = {
  extend: function(obj, value) {
    for(var key in value) {
      if(value.hasOwnProperty(key)) {
        obj[key] = value[key];
      }
    }
  },

  escapeExpression: function(string) {
    // don't escape SafeStrings, since they're already safe
    if (string instanceof Handlebars.SafeString) {
      return string.toString();
    } else if (string == null || string === false) {
      return "";
    }

    // Force a string conversion as this will be done by the append regardless and
    // the regex test will do this transparently behind the scenes, causing issues if
    // an object's to string has escaped characters in it.
    string = string.toString();

    if(!possible.test(string)) { return string; }
    return string.replace(badChars, escapeChar);
  },

  isEmpty: function(value) {
    if (!value && value !== 0) {
      return true;
    } else if(toString.call(value) === "[object Array]" && value.length === 0) {
      return true;
    } else {
      return false;
    }
  }
};
;
// lib/handlebars/runtime.js

Handlebars.VM = {
  template: function(templateSpec) {
    // Just add water
    var container = {
      escapeExpression: Handlebars.Utils.escapeExpression,
      invokePartial: Handlebars.VM.invokePartial,
      programs: [],
      program: function(i, fn, data) {
        var programWrapper = this.programs[i];
        if(data) {
          programWrapper = Handlebars.VM.program(i, fn, data);
        } else if (!programWrapper) {
          programWrapper = this.programs[i] = Handlebars.VM.program(i, fn);
        }
        return programWrapper;
      },
      merge: function(param, common) {
        var ret = param || common;

        if (param && common) {
          ret = {};
          Handlebars.Utils.extend(ret, common);
          Handlebars.Utils.extend(ret, param);
        }
        return ret;
      },
      programWithDepth: Handlebars.VM.programWithDepth,
      noop: Handlebars.VM.noop,
      compilerInfo: null
    };

    return function(context, options) {
      options = options || {};
      var result = templateSpec.call(container, Handlebars, context, options.helpers, options.partials, options.data);

      var compilerInfo = container.compilerInfo || [],
          compilerRevision = compilerInfo[0] || 1,
          currentRevision = Handlebars.COMPILER_REVISION;

      if (compilerRevision !== currentRevision) {
        if (compilerRevision < currentRevision) {
          var runtimeVersions = Handlebars.REVISION_CHANGES[currentRevision],
              compilerVersions = Handlebars.REVISION_CHANGES[compilerRevision];
          throw "Template was precompiled with an older version of Handlebars than the current runtime. "+
                "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").";
        } else {
          // Use the embedded version info since the runtime doesn't know about this revision yet
          throw "Template was precompiled with a newer version of Handlebars than the current runtime. "+
                "Please update your runtime to a newer version ("+compilerInfo[1]+").";
        }
      }

      return result;
    };
  },

  programWithDepth: function(i, fn, data /*, $depth */) {
    var args = Array.prototype.slice.call(arguments, 3);

    var program = function(context, options) {
      options = options || {};

      return fn.apply(this, [context, options.data || data].concat(args));
    };
    program.program = i;
    program.depth = args.length;
    return program;
  },
  program: function(i, fn, data) {
    var program = function(context, options) {
      options = options || {};

      return fn(context, options.data || data);
    };
    program.program = i;
    program.depth = 0;
    return program;
  },
  noop: function() { return ""; },
  invokePartial: function(partial, name, context, helpers, partials, data) {
    var options = { helpers: helpers, partials: partials, data: data };

    if(partial === undefined) {
      throw new Handlebars.Exception("The partial " + name + " could not be found");
    } else if(partial instanceof Function) {
      return partial(context, options);
    } else if (!Handlebars.compile) {
      throw new Handlebars.Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
    } else {
      partials[name] = Handlebars.compile(partial, {data: data !== undefined});
      return partials[name](context, options);
    }
  }
};

Handlebars.template = Handlebars.VM.template;
;
// lib/handlebars/browser-suffix.js
})(Handlebars);
;

this["JST"] = this["JST"] || {};

this["JST"]["templates/feed.hbs"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var stack1, options, functionType="function", escapeExpression=this.escapeExpression, self=this, blockHelperMissing=helpers.blockHelperMissing;

function program1(depth0,data,depth1) {
  
  var buffer = "", stack1, stack2, options;
  buffer += "\n	<section class=\"entries\">\n	<h2 class=\"ui header\">\n		<i class=\"docs icon\"></i>\n		<div class=\"content\">\n			";
  if (stack1 = helpers.title) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.title; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\n			<div class=\"sub header\">";
  if (stack1 = helpers.description) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.description; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</div>\n		</div>\n	</h2>\n	<a class=\"superfeeds action\" data-action=\"deleteFeed\" data-p1=\""
    + escapeExpression(((stack1 = ((stack1 = depth1.opts),stack1 == null || stack1 === false ? stack1 : stack1.url)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\">Delete Feed</a>\n	<div class=\"ui divider\"></div>\n	";
  options = {hash:{},inverse:self.noop,fn:self.program(2, program2, data),data:data};
  if (stack2 = helpers.entries) { stack2 = stack2.call(depth0, options); }
  else { stack2 = depth0.entries; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  if (!helpers.entries) { stack2 = blockHelperMissing.call(depth0, stack2, options); }
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n	";
  options = {hash:{},inverse:self.program(9, program9, data),fn:self.noop,data:data};
  if (stack2 = helpers.entries) { stack2 = stack2.call(depth0, options); }
  else { stack2 = depth0.entries; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  if (!helpers.entries) { stack2 = blockHelperMissing.call(depth0, stack2, options); }
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "\n	</section>\n";
  return buffer;
  }
function program2(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n		<article class=\"entry\" data-id=\"";
  if (stack1 = helpers.id) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\">\n			<h3><a href=\"";
  if (stack1 = helpers.link) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.link; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\">";
  if (stack1 = helpers.title) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.title; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</a></h3>\n			<div class=\"ui two column grid\">\n				<div class=\"column\">\n					<p class=\"time\">";
  if (stack1 = helpers.publishedDate) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.publishedDate; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</p>\n				</div>\n				<div class=\"column\">\n\n					<div class=\"ui buttons\">\n						<a href=\"#\" class=\"read ui button toggle ";
  stack1 = helpers['if'].call(depth0, depth0.read, {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += " superfeed action\" data-action=\"toggleFlag\" data-p2=\"read\" ><i class=\"mail icon\"></i></a>\n						<a href=\"#\" class=\"favourite ui button toggle ";
  stack1 = helpers['if'].call(depth0, depth0.fav, {hash:{},inverse:self.noop,fn:self.program(3, program3, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += " superfeed action\" data-action=\"toggleFlag\" data-p2=\"fav\"> <i class=\"like icon\"></i></a>\n					</div>\n				</div>\n			</div>\n			\n			<div class=\"body\">\n			";
  stack1 = helpers['if'].call(depth0, depth0.content, {hash:{},inverse:self.program(7, program7, data),fn:self.program(5, program5, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n			</div>\n		</article>\n		<div class=\"ui divider\"></div>\n	";
  return buffer;
  }
function program3(depth0,data) {
  
  
  return "active";
  }

function program5(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n				";
  if (stack1 = helpers.content) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.content; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n			";
  return buffer;
  }

function program7(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n				";
  if (stack1 = helpers.description) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.description; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n			";
  return buffer;
  }

function program9(depth0,data) {
  
  
  return "\n		<i class=\"massive cancel icon\"></i>\n		<p>There are no items for this feed.</p>\n	";
  }

  options = {hash:{},inverse:self.noop,fn:self.programWithDepth(1, program1, data, depth0),data:data};
  if (stack1 = helpers.feed) { stack1 = stack1.call(depth0, options); }
  else { stack1 = depth0.feed; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  if (!helpers.feed) { stack1 = blockHelperMissing.call(depth0, stack1, options); }
  if(stack1 || stack1 === 0) { return stack1; }
  else { return ''; }
  });

this["JST"]["templates/sidebar.hbs"] = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, functionType="function", escapeExpression=this.escapeExpression, self=this, blockHelperMissing=helpers.blockHelperMissing;

function program1(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n<li>\n	<a class=\"superfeeds action\" data-action=\"loadFeed\" data-p1=\"";
  if (stack1 = helpers.feedurl) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.feedurl; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\">\n\n	<span class=\"title\">";
  if (stack1 = helpers.title) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.title; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</span>\n	<span class=\"unread\">";
  if (stack1 = helpers.unread) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.unread; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "</span>\n	</a>\n</li>\n";
  return buffer;
  }

  buffer += "<ul>\n";
  options = {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data};
  if (stack1 = helpers.feeds) { stack1 = stack1.call(depth0, options); }
  else { stack1 = depth0.feeds; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  if (!helpers.feeds) { stack1 = blockHelperMissing.call(depth0, stack1, options); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n</ul>";
  return buffer;
  });
(function(){
	var exports = {};
	exports.allowedElements = ("strong em b i p code pre tt samp kbd var sub q sup dfn cite big small address hr " +
	                           "br div span h1 h2 h3 h4 h5 h6 ul ol li dl dt dd abbr acronym a img blockquote del " +
	                           "ins table caption tbody tfoot thead tr th td article aside canvas details figcaption " +
	                           "figure footer header hgroup menu nav section summary time mark").split(" ");
	exports.allowedProperties = ("azimuth background-color border-bottom-color border-collapse border-color " +
	                             "border-left-color border-right-color border-top-color clear color cursor direction " +
	                             "display elevation float font font-family font-size font-style font-variant font-weight " +
	                             "height letter-spacing line-height overflow pause pause-after pause-before pitch " +
	                             "pitch-range richness speak speak-header speak-numeral speak-punctuation speech-rate " +
	                             "stress text-align text-decoration text-indent unicode-bidi vertical-align voice-family " +
	                             "volume white-space width").split(" ");
	exports.allowedKeywords = ("auto aqua black block blue bold both bottom brown center collapse dashed dotted " +
	                           "fuchsia gray green !important italic left lime maroon medium none navy normal nowrap " +
	                           "olive pointer purple red right solid silver teal top transparent underline white yellow").split(" ");
	exports.shorthandProperties = ("background border margin padding").split(" ");
	exports.allowedAttributes = ("href src width height alt cite datetime title class name xml:lang abbr style").split(" ");
	exports.uriAttributes = ("href src cite action longdesc xlink:href lowsrc").split(" ");
	exports.allowedProtocols = ("ed2k ftp http https irc mailto news gopher nntp telnet webcal xmpp callto feed svn " +
	                            "urn aim rsync tag ssh sftp rtsp afs tel smsto mmsto").split(" ");

	function mapArray (arr) {var res = {};
	    for (var i = 0, n = arr.length; i < n; i++) res[arr[i]] = true;
	    return res;
	}

	// rules based on
	// https://github.com/rails/rails/blob/master/actionpack/lib/action_controller/vendor/html-scanner/html/sanitizer.rb
	exports.sanitiseHTML = function (html, options) {
	    if (html == null || !html.length) return "";
	    var options = options || {}
	    ,   allowedElements = mapArray(options.allowedElements || exports.allowedElements)
	    ,   allowedAttributes = mapArray(options.allowedAttributes || exports.allowedAttributes)
	    ,   uriAttributes = mapArray(options.uriAttributes || exports.uriAttributes)
	    ,   allowedProtocols = mapArray(options.allowedProtocols || exports.allowedProtocols)
	    ;
	    // strip comments
	    html = html.replace(/<!--(?:[\s\S]*?)-->[\n]?/g, "");
	    // parse without processing anything
	    var doc = $.parseHTML(html);
	    if(doc.length){
	    	doc = doc[0];
	    }

	    // process elements
	    var els = doc.getElementsByTagName("*");
	    
	    for (var i = 0, n = els.length; i < n; i++) {
	        var el = els[i];
	        // remove elements that aren't on the whitelist
	        if (!allowedElements[el.tagName.toLowerCase()]) {
	            el.parentNode.removeChild(el);
	            continue;
	        }
	        
	        // remove attributes that aren't on the whitelist
	        for (var j = 0, m = el.attributes.length; j < m; j++) {
	            var att = el.attributes[j];
	            if(typeof att == 'undefined'){
	            	continue;
	            }
	            var an = att.nodeName.toLowerCase();
	            if (!allowedAttributes[an]) el.removeAttribute(att.nodeName);
	            // only allowed protocols
	            if (uriAttributes[an]) {
	                if (/(^[^\/:]*):|(&#0*58)|(&#x70)|(%|&#37;)3A/.test(att.nodeValue) &&
	                    !allowedProtocols[att.nodeValue.split(/:|(&#0*58)|(&#x70)|(%|&#37;)3A/)[0].toLowerCase()]) {
	                        el.removeAttribute(att.nodeName);
	                }
	            }
	        }
	        
	        // handle style
	        if (el.hasAttribute("style")) el.setAttribute("style", exports.sanitiseCSS(el.getAttribute("style"), options));
	    }
	    return doc.innerHTML;
	};

	exports.sanitiseCSS = function (css, options) {
	    var options = options || {}
	    ,   allowedProperties = mapArray(options.allowedProperties || exports.allowedProperties)
	    ,   allowedKeywords = mapArray(options.allowedKeywords || exports.allowedKeywords)
	    ,   shorthandProperties = mapArray(options.shorthandProperties || exports.shorthandProperties)
	    ;
	    
	    // kill URIs
	    css = css.replace(/url\s*\(\s*[^\s)]+?\s*\)\s*/gi, "");
	    
	    // gauntlet
	    if (!/^([:,;#%.\sa-zA-Z0-9!]|\w-\w|\'[\s\w]+\'|\"[\s\w]+\"|\([\d,\s]+\))*$/.test(css) ||
	        !/^(\s*[-\w]+\s*:\s*[^:;]*(;|$)\s*)*$/.test(css)) return "";
	    
	    var clean = "";
	    css.replace(/([-\w]+)\s*:\s*([^:;]*)/g, function (str, prop, val) {
	        if (allowedProperties[prop.toLowerCase()]) clean += prop + ": " + val + "; ";
	        else if (shorthandProperties[prop.split("-")[0].toLowerCase()]) {
	            var keywords = val.trim().split(" ");
	            for (var i = 0, n = keywords.length; i < n; i++) {
	                var kw = keywords[i];
	                if (!allowedKeywords[kw.toLowerCase()] && 
	                    !/^(#[0-9a-f]+|rgb\(\d+%?,\d*%?,?\d*%?\)?|\d{0,2}\.?\d{0,2}(cm|em|ex|in|mm|pc|pt|px|%|,|\))?)$/.test(kw)) {
	                        continue;
	                }
	                clean += prop + ": " + val + "; ";
	            }
	        }
	    });
	    return clean;
	};

	exports.sanitiseHTMLFragmment = function(fragment){
		return exports.sanitiseHTML('<div>'+fragment+'</div>');
	}

	window.sanitiseHTML = exports.sanitiseHTML;
	window.sanitiseHTMLFragmment = exports.sanitiseHTMLFragmment;
	window.sanitiseCSS = exports.sanitiseCSS;
})(jQuery);
/*global define:false */
/**
 * Copyright 2013 Craig Campbell
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Mousetrap is a simple keyboard shortcut library for Javascript with
 * no external dependencies
 *
 * @version 1.4.4
 * @url craig.is/killing/mice
 */
(function() {

    /**
     * mapping of special keycodes to their corresponding keys
     *
     * everything in this dictionary cannot use keypress events
     * so it has to be here to map to the correct keycodes for
     * keyup/keydown events
     *
     * @type {Object}
     */
    var _MAP = {
            8: 'backspace',
            9: 'tab',
            13: 'enter',
            16: 'shift',
            17: 'ctrl',
            18: 'alt',
            20: 'capslock',
            27: 'esc',
            32: 'space',
            33: 'pageup',
            34: 'pagedown',
            35: 'end',
            36: 'home',
            37: 'left',
            38: 'up',
            39: 'right',
            40: 'down',
            45: 'ins',
            46: 'del',
            91: 'meta',
            93: 'meta',
            224: 'meta'
        },

        /**
         * mapping for special characters so they can support
         *
         * this dictionary is only used incase you want to bind a
         * keyup or keydown event to one of these keys
         *
         * @type {Object}
         */
        _KEYCODE_MAP = {
            106: '*',
            107: '+',
            109: '-',
            110: '.',
            111 : '/',
            186: ';',
            187: '=',
            188: ',',
            189: '-',
            190: '.',
            191: '/',
            192: '`',
            219: '[',
            220: '\\',
            221: ']',
            222: '\''
        },

        /**
         * this is a mapping of keys that require shift on a US keypad
         * back to the non shift equivelents
         *
         * this is so you can use keyup events with these keys
         *
         * note that this will only work reliably on US keyboards
         *
         * @type {Object}
         */
        _SHIFT_MAP = {
            '~': '`',
            '!': '1',
            '@': '2',
            '#': '3',
            '$': '4',
            '%': '5',
            '^': '6',
            '&': '7',
            '*': '8',
            '(': '9',
            ')': '0',
            '_': '-',
            '+': '=',
            ':': ';',
            '\"': '\'',
            '<': ',',
            '>': '.',
            '?': '/',
            '|': '\\'
        },

        /**
         * this is a list of special strings you can use to map
         * to modifier keys when you specify your keyboard shortcuts
         *
         * @type {Object}
         */
        _SPECIAL_ALIASES = {
            'option': 'alt',
            'command': 'meta',
            'return': 'enter',
            'escape': 'esc',
            'mod': /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta' : 'ctrl'
        },

        /**
         * variable to store the flipped version of _MAP from above
         * needed to check if we should use keypress or not when no action
         * is specified
         *
         * @type {Object|undefined}
         */
        _REVERSE_MAP,

        /**
         * a list of all the callbacks setup via Mousetrap.bind()
         *
         * @type {Object}
         */
        _callbacks = {},

        /**
         * direct map of string combinations to callbacks used for trigger()
         *
         * @type {Object}
         */
        _directMap = {},

        /**
         * keeps track of what level each sequence is at since multiple
         * sequences can start out with the same sequence
         *
         * @type {Object}
         */
        _sequenceLevels = {},

        /**
         * variable to store the setTimeout call
         *
         * @type {null|number}
         */
        _resetTimer,

        /**
         * temporary state where we will ignore the next keyup
         *
         * @type {boolean|string}
         */
        _ignoreNextKeyup = false,

        /**
         * temporary state where we will ignore the next keypress
         *
         * @type {boolean}
         */
        _ignoreNextKeypress = false,

        /**
         * are we currently inside of a sequence?
         * type of action ("keyup" or "keydown" or "keypress") or false
         *
         * @type {boolean|string}
         */
        _nextExpectedAction = false;

    /**
     * loop through the f keys, f1 to f19 and add them to the map
     * programatically
     */
    for (var i = 1; i < 20; ++i) {
        _MAP[111 + i] = 'f' + i;
    }

    /**
     * loop through to map numbers on the numeric keypad
     */
    for (i = 0; i <= 9; ++i) {
        _MAP[i + 96] = i;
    }

    /**
     * cross browser add event method
     *
     * @param {Element|HTMLDocument} object
     * @param {string} type
     * @param {Function} callback
     * @returns void
     */
    function _addEvent(object, type, callback) {
        if (object.addEventListener) {
            object.addEventListener(type, callback, false);
            return;
        }

        object.attachEvent('on' + type, callback);
    }

    /**
     * takes the event and returns the key character
     *
     * @param {Event} e
     * @return {string}
     */
    function _characterFromEvent(e) {

        // for keypress events we should return the character as is
        if (e.type == 'keypress') {
            var character = String.fromCharCode(e.which);

            // if the shift key is not pressed then it is safe to assume
            // that we want the character to be lowercase.  this means if
            // you accidentally have caps lock on then your key bindings
            // will continue to work
            //
            // the only side effect that might not be desired is if you
            // bind something like 'A' cause you want to trigger an
            // event when capital A is pressed caps lock will no longer
            // trigger the event.  shift+a will though.
            if (!e.shiftKey) {
                character = character.toLowerCase();
            }

            return character;
        }

        // for non keypress events the special maps are needed
        if (_MAP[e.which]) {
            return _MAP[e.which];
        }

        if (_KEYCODE_MAP[e.which]) {
            return _KEYCODE_MAP[e.which];
        }

        // if it is not in the special map

        // with keydown and keyup events the character seems to always
        // come in as an uppercase character whether you are pressing shift
        // or not.  we should make sure it is always lowercase for comparisons
        return String.fromCharCode(e.which).toLowerCase();
    }

    /**
     * checks if two arrays are equal
     *
     * @param {Array} modifiers1
     * @param {Array} modifiers2
     * @returns {boolean}
     */
    function _modifiersMatch(modifiers1, modifiers2) {
        return modifiers1.sort().join(',') === modifiers2.sort().join(',');
    }

    /**
     * resets all sequence counters except for the ones passed in
     *
     * @param {Object} doNotReset
     * @returns void
     */
    function _resetSequences(doNotReset) {
        doNotReset = doNotReset || {};

        var activeSequences = false,
            key;

        for (key in _sequenceLevels) {
            if (doNotReset[key]) {
                activeSequences = true;
                continue;
            }
            _sequenceLevels[key] = 0;
        }

        if (!activeSequences) {
            _nextExpectedAction = false;
        }
    }

    /**
     * finds all callbacks that match based on the keycode, modifiers,
     * and action
     *
     * @param {string} character
     * @param {Array} modifiers
     * @param {Event|Object} e
     * @param {string=} sequenceName - name of the sequence we are looking for
     * @param {string=} combination
     * @param {number=} level
     * @returns {Array}
     */
    function _getMatches(character, modifiers, e, sequenceName, combination, level) {
        var i,
            callback,
            matches = [],
            action = e.type;

        // if there are no events related to this keycode
        if (!_callbacks[character]) {
            return [];
        }

        // if a modifier key is coming up on its own we should allow it
        if (action == 'keyup' && _isModifier(character)) {
            modifiers = [character];
        }

        // loop through all callbacks for the key that was pressed
        // and see if any of them match
        for (i = 0; i < _callbacks[character].length; ++i) {
            callback = _callbacks[character][i];

            // if a sequence name is not specified, but this is a sequence at
            // the wrong level then move onto the next match
            if (!sequenceName && callback.seq && _sequenceLevels[callback.seq] != callback.level) {
                continue;
            }

            // if the action we are looking for doesn't match the action we got
            // then we should keep going
            if (action != callback.action) {
                continue;
            }

            // if this is a keypress event and the meta key and control key
            // are not pressed that means that we need to only look at the
            // character, otherwise check the modifiers as well
            //
            // chrome will not fire a keypress if meta or control is down
            // safari will fire a keypress if meta or meta+shift is down
            // firefox will fire a keypress if meta or control is down
            if ((action == 'keypress' && !e.metaKey && !e.ctrlKey) || _modifiersMatch(modifiers, callback.modifiers)) {

                // when you bind a combination or sequence a second time it
                // should overwrite the first one.  if a sequenceName or
                // combination is specified in this call it does just that
                //
                // @todo make deleting its own method?
                var deleteCombo = !sequenceName && callback.combo == combination;
                var deleteSequence = sequenceName && callback.seq == sequenceName && callback.level == level;
                if (deleteCombo || deleteSequence) {
                    _callbacks[character].splice(i, 1);
                }

                matches.push(callback);
            }
        }

        return matches;
    }

    /**
     * takes a key event and figures out what the modifiers are
     *
     * @param {Event} e
     * @returns {Array}
     */
    function _eventModifiers(e) {
        var modifiers = [];

        if (e.shiftKey) {
            modifiers.push('shift');
        }

        if (e.altKey) {
            modifiers.push('alt');
        }

        if (e.ctrlKey) {
            modifiers.push('ctrl');
        }

        if (e.metaKey) {
            modifiers.push('meta');
        }

        return modifiers;
    }

    /**
     * actually calls the callback function
     *
     * if your callback function returns false this will use the jquery
     * convention - prevent default and stop propogation on the event
     *
     * @param {Function} callback
     * @param {Event} e
     * @returns void
     */
    function _fireCallback(callback, e, combo) {

        // if this event should not happen stop here
        if (Mousetrap.stopCallback(e, e.target || e.srcElement, combo)) {
            return;
        }

        if (callback(e, combo) === false) {
            if (e.preventDefault) {
                e.preventDefault();
            }

            if (e.stopPropagation) {
                e.stopPropagation();
            }

            e.returnValue = false;
            e.cancelBubble = true;
        }
    }

    /**
     * handles a character key event
     *
     * @param {string} character
     * @param {Array} modifiers
     * @param {Event} e
     * @returns void
     */
    function _handleKey(character, modifiers, e) {
        var callbacks = _getMatches(character, modifiers, e),
            i,
            doNotReset = {},
            maxLevel = 0,
            processedSequenceCallback = false;

        // Calculate the maxLevel for sequences so we can only execute the longest callback sequence
        for (i = 0; i < callbacks.length; ++i) {
            if (callbacks[i].seq) {
                maxLevel = Math.max(maxLevel, callbacks[i].level);
            }
        }

        // loop through matching callbacks for this key event
        for (i = 0; i < callbacks.length; ++i) {

            // fire for all sequence callbacks
            // this is because if for example you have multiple sequences
            // bound such as "g i" and "g t" they both need to fire the
            // callback for matching g cause otherwise you can only ever
            // match the first one
            if (callbacks[i].seq) {

                // only fire callbacks for the maxLevel to prevent
                // subsequences from also firing
                //
                // for example 'a option b' should not cause 'option b' to fire
                // even though 'option b' is part of the other sequence
                //
                // any sequences that do not match here will be discarded
                // below by the _resetSequences call
                if (callbacks[i].level != maxLevel) {
                    continue;
                }

                processedSequenceCallback = true;

                // keep a list of which sequences were matches for later
                doNotReset[callbacks[i].seq] = 1;
                _fireCallback(callbacks[i].callback, e, callbacks[i].combo);
                continue;
            }

            // if there were no sequence matches but we are still here
            // that means this is a regular match so we should fire that
            if (!processedSequenceCallback) {
                _fireCallback(callbacks[i].callback, e, callbacks[i].combo);
            }
        }

        // if the key you pressed matches the type of sequence without
        // being a modifier (ie "keyup" or "keypress") then we should
        // reset all sequences that were not matched by this event
        //
        // this is so, for example, if you have the sequence "h a t" and you
        // type "h e a r t" it does not match.  in this case the "e" will
        // cause the sequence to reset
        //
        // modifier keys are ignored because you can have a sequence
        // that contains modifiers such as "enter ctrl+space" and in most
        // cases the modifier key will be pressed before the next key
        //
        // also if you have a sequence such as "ctrl+b a" then pressing the
        // "b" key will trigger a "keypress" and a "keydown"
        //
        // the "keydown" is expected when there is a modifier, but the
        // "keypress" ends up matching the _nextExpectedAction since it occurs
        // after and that causes the sequence to reset
        //
        // we ignore keypresses in a sequence that directly follow a keydown
        // for the same character
        var ignoreThisKeypress = e.type == 'keypress' && _ignoreNextKeypress;
        if (e.type == _nextExpectedAction && !_isModifier(character) && !ignoreThisKeypress) {
            _resetSequences(doNotReset);
        }

        _ignoreNextKeypress = processedSequenceCallback && e.type == 'keydown';
    }

    /**
     * handles a keydown event
     *
     * @param {Event} e
     * @returns void
     */
    function _handleKeyEvent(e) {

        // normalize e.which for key events
        // @see http://stackoverflow.com/questions/4285627/javascript-keycode-vs-charcode-utter-confusion
        if (typeof e.which !== 'number') {
            e.which = e.keyCode;
        }

        var character = _characterFromEvent(e);

        // no character found then stop
        if (!character) {
            return;
        }

        // need to use === for the character check because the character can be 0
        if (e.type == 'keyup' && _ignoreNextKeyup === character) {
            _ignoreNextKeyup = false;
            return;
        }

        Mousetrap.handleKey(character, _eventModifiers(e), e);
    }

    /**
     * determines if the keycode specified is a modifier key or not
     *
     * @param {string} key
     * @returns {boolean}
     */
    function _isModifier(key) {
        return key == 'shift' || key == 'ctrl' || key == 'alt' || key == 'meta';
    }

    /**
     * called to set a 1 second timeout on the specified sequence
     *
     * this is so after each key press in the sequence you have 1 second
     * to press the next key before you have to start over
     *
     * @returns void
     */
    function _resetSequenceTimer() {
        clearTimeout(_resetTimer);
        _resetTimer = setTimeout(_resetSequences, 1000);
    }

    /**
     * reverses the map lookup so that we can look for specific keys
     * to see what can and can't use keypress
     *
     * @return {Object}
     */
    function _getReverseMap() {
        if (!_REVERSE_MAP) {
            _REVERSE_MAP = {};
            for (var key in _MAP) {

                // pull out the numeric keypad from here cause keypress should
                // be able to detect the keys from the character
                if (key > 95 && key < 112) {
                    continue;
                }

                if (_MAP.hasOwnProperty(key)) {
                    _REVERSE_MAP[_MAP[key]] = key;
                }
            }
        }
        return _REVERSE_MAP;
    }

    /**
     * picks the best action based on the key combination
     *
     * @param {string} key - character for key
     * @param {Array} modifiers
     * @param {string=} action passed in
     */
    function _pickBestAction(key, modifiers, action) {

        // if no action was picked in we should try to pick the one
        // that we think would work best for this key
        if (!action) {
            action = _getReverseMap()[key] ? 'keydown' : 'keypress';
        }

        // modifier keys don't work as expected with keypress,
        // switch to keydown
        if (action == 'keypress' && modifiers.length) {
            action = 'keydown';
        }

        return action;
    }

    /**
     * binds a key sequence to an event
     *
     * @param {string} combo - combo specified in bind call
     * @param {Array} keys
     * @param {Function} callback
     * @param {string=} action
     * @returns void
     */
    function _bindSequence(combo, keys, callback, action) {

        // start off by adding a sequence level record for this combination
        // and setting the level to 0
        _sequenceLevels[combo] = 0;

        /**
         * callback to increase the sequence level for this sequence and reset
         * all other sequences that were active
         *
         * @param {string} nextAction
         * @returns {Function}
         */
        function _increaseSequence(nextAction) {
            return function() {
                _nextExpectedAction = nextAction;
                ++_sequenceLevels[combo];
                _resetSequenceTimer();
            };
        }

        /**
         * wraps the specified callback inside of another function in order
         * to reset all sequence counters as soon as this sequence is done
         *
         * @param {Event} e
         * @returns void
         */
        function _callbackAndReset(e) {
            _fireCallback(callback, e, combo);

            // we should ignore the next key up if the action is key down
            // or keypress.  this is so if you finish a sequence and
            // release the key the final key will not trigger a keyup
            if (action !== 'keyup') {
                _ignoreNextKeyup = _characterFromEvent(e);
            }

            // weird race condition if a sequence ends with the key
            // another sequence begins with
            setTimeout(_resetSequences, 10);
        }

        // loop through keys one at a time and bind the appropriate callback
        // function.  for any key leading up to the final one it should
        // increase the sequence. after the final, it should reset all sequences
        //
        // if an action is specified in the original bind call then that will
        // be used throughout.  otherwise we will pass the action that the
        // next key in the sequence should match.  this allows a sequence
        // to mix and match keypress and keydown events depending on which
        // ones are better suited to the key provided
        for (var i = 0; i < keys.length; ++i) {
            var isFinal = i + 1 === keys.length;
            var wrappedCallback = isFinal ? _callbackAndReset : _increaseSequence(action || _getKeyInfo(keys[i + 1]).action);
            _bindSingle(keys[i], wrappedCallback, action, combo, i);
        }
    }

    /**
     * Converts from a string key combination to an array
     *
     * @param  {string} combination like "command+shift+l"
     * @return {Array}
     */
    function _keysFromString(combination) {
        if (combination === '+') {
            return ['+'];
        }

        return combination.split('+');
    }

    /**
     * Gets info for a specific key combination
     *
     * @param  {string} combination key combination ("command+s" or "a" or "*")
     * @param  {string=} action
     * @returns {Object}
     */
    function _getKeyInfo(combination, action) {
        var keys,
            key,
            i,
            modifiers = [];

        // take the keys from this pattern and figure out what the actual
        // pattern is all about
        keys = _keysFromString(combination);

        for (i = 0; i < keys.length; ++i) {
            key = keys[i];

            // normalize key names
            if (_SPECIAL_ALIASES[key]) {
                key = _SPECIAL_ALIASES[key];
            }

            // if this is not a keypress event then we should
            // be smart about using shift keys
            // this will only work for US keyboards however
            if (action && action != 'keypress' && _SHIFT_MAP[key]) {
                key = _SHIFT_MAP[key];
                modifiers.push('shift');
            }

            // if this key is a modifier then add it to the list of modifiers
            if (_isModifier(key)) {
                modifiers.push(key);
            }
        }

        // depending on what the key combination is
        // we will try to pick the best event for it
        action = _pickBestAction(key, modifiers, action);

        return {
            key: key,
            modifiers: modifiers,
            action: action
        };
    }

    /**
     * binds a single keyboard combination
     *
     * @param {string} combination
     * @param {Function} callback
     * @param {string=} action
     * @param {string=} sequenceName - name of sequence if part of sequence
     * @param {number=} level - what part of the sequence the command is
     * @returns void
     */
    function _bindSingle(combination, callback, action, sequenceName, level) {

        // store a direct mapped reference for use with Mousetrap.trigger
        _directMap[combination + ':' + action] = callback;

        // make sure multiple spaces in a row become a single space
        combination = combination.replace(/\s+/g, ' ');

        var sequence = combination.split(' '),
            info;

        // if this pattern is a sequence of keys then run through this method
        // to reprocess each pattern one key at a time
        if (sequence.length > 1) {
            _bindSequence(combination, sequence, callback, action);
            return;
        }

        info = _getKeyInfo(combination, action);

        // make sure to initialize array if this is the first time
        // a callback is added for this key
        _callbacks[info.key] = _callbacks[info.key] || [];

        // remove an existing match if there is one
        _getMatches(info.key, info.modifiers, {type: info.action}, sequenceName, combination, level);

        // add this call back to the array
        // if it is a sequence put it at the beginning
        // if not put it at the end
        //
        // this is important because the way these are processed expects
        // the sequence ones to come first
        _callbacks[info.key][sequenceName ? 'unshift' : 'push']({
            callback: callback,
            modifiers: info.modifiers,
            action: info.action,
            seq: sequenceName,
            level: level,
            combo: combination
        });
    }

    /**
     * binds multiple combinations to the same callback
     *
     * @param {Array} combinations
     * @param {Function} callback
     * @param {string|undefined} action
     * @returns void
     */
    function _bindMultiple(combinations, callback, action) {
        for (var i = 0; i < combinations.length; ++i) {
            _bindSingle(combinations[i], callback, action);
        }
    }

    // start!
    _addEvent(document, 'keypress', _handleKeyEvent);
    _addEvent(document, 'keydown', _handleKeyEvent);
    _addEvent(document, 'keyup', _handleKeyEvent);

    var Mousetrap = {

        /**
         * binds an event to mousetrap
         *
         * can be a single key, a combination of keys separated with +,
         * an array of keys, or a sequence of keys separated by spaces
         *
         * be sure to list the modifier keys first to make sure that the
         * correct key ends up getting bound (the last key in the pattern)
         *
         * @param {string|Array} keys
         * @param {Function} callback
         * @param {string=} action - 'keypress', 'keydown', or 'keyup'
         * @returns void
         */
        bind: function(keys, callback, action) {
            keys = keys instanceof Array ? keys : [keys];
            _bindMultiple(keys, callback, action);
            return this;
        },

        /**
         * unbinds an event to mousetrap
         *
         * the unbinding sets the callback function of the specified key combo
         * to an empty function and deletes the corresponding key in the
         * _directMap dict.
         *
         * TODO: actually remove this from the _callbacks dictionary instead
         * of binding an empty function
         *
         * the keycombo+action has to be exactly the same as
         * it was defined in the bind method
         *
         * @param {string|Array} keys
         * @param {string} action
         * @returns void
         */
        unbind: function(keys, action) {
            return Mousetrap.bind(keys, function() {}, action);
        },

        /**
         * triggers an event that has already been bound
         *
         * @param {string} keys
         * @param {string=} action
         * @returns void
         */
        trigger: function(keys, action) {
            if (_directMap[keys + ':' + action]) {
                _directMap[keys + ':' + action]({}, keys);
            }
            return this;
        },

        /**
         * resets the library back to its initial state.  this is useful
         * if you want to clear out the current keyboard shortcuts and bind
         * new ones - for example if you switch to another page
         *
         * @returns void
         */
        reset: function() {
            _callbacks = {};
            _directMap = {};
            return this;
        },

       /**
        * should we stop this event before firing off callbacks
        *
        * @param {Event} e
        * @param {Element} element
        * @return {boolean}
        */
        stopCallback: function(e, element) {

            // if the element has the class "mousetrap" then no need to stop
            if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
                return false;
            }

            // stop for input, select, and textarea
            return element.tagName == 'INPUT' || element.tagName == 'SELECT' || element.tagName == 'TEXTAREA' || (element.contentEditable && element.contentEditable == 'true');
        },

        /**
         * exposes _handleKey publicly so it can be overwritten by extensions
         */
        handleKey: _handleKey
    };

    // expose mousetrap to the global object
    window.Mousetrap = Mousetrap;

    // expose mousetrap as an AMD module
    if (typeof define === 'function' && define.amd) {
        define(Mousetrap);
    }
    
    if(typeof module == 'object' && module.exports) {
        module.exports = Mousetrap;
    }
}) ();

function JAtom(xml) {
    this._parse(xml);
};

JAtom.prototype = {

    _parse: function(xml) {
        this.type = 'atom';
        if(typeof xml == 'string'){
            xml = jQuery.parseXML(xml);
        }

        var channel = jQuery('feed', xml).eq(0);

        this.version = '1.0';
		this.type += '10';
        this.title = jQuery(channel).find('title:first').text();
        this.link = jQuery(channel).find('link:first').attr('href');
        this.description = jQuery(channel).find('subtitle:first').text();
        this.language = jQuery(channel).attr('xml:lang');
        this.updated = jQuery(channel).find('updated:first').text();

        this.entries = new Array();

        var feed = this;

        jQuery('entry', xml).each( function() {

            var item = new JFeedItem();

            var t = jQuery(this);

            item.title = t.find('title').eq(0).text();

            /*
             * RFC 4287 - 4.2.7.2: take first encountered 'link' node
             *                     to be of the 'alternate' type.
             */
            t.find('link').each(function() {
               var rel = $(this).attr('rel');
               if ((rel == 'alternate') || !rel) {
                  item.link = $(this).attr('href');
                  return false;
               }
               return true;
            });

            item.description = t.find('content').eq(0).text();
            item.publishedDate = t.find('updated').eq(0).text();
            item.id = t.find('id').eq(0).text();
            item.author = t.find('author name').eq(0).text();

            var point = t.find('georss\\:point').eq(0).text();
            if (!point) point = t.find('point').eq(0).text();
            if (point.length > 0) {
              point = point.split(" ");
              item.coordinates = [point[1], point[0]];
            }

            feed.entries.push(item);
        });
    }
};


/* jFeed : jQuery feed parser plugin
 * Copyright (C) 2007 Jean-François Hovinne - http://www.hovinne.com/
 * Dual licensed under the MIT (MIT-license.txt)
 * and GPL (GPL-license.txt) licenses.
 */

jQuery.getFeed = function(options) {

    options = jQuery.extend({

        url: null,
        data: null,
        cache: true,
        success: null,
        failure: null,
        error: null,
        global: true

    }, options);

    if (options.url) {

        if (jQuery.isFunction(options.failure) && jQuery.type(options.error)==='null') {
          // Handle legacy failure option
          options.error = function(xhr, msg, e){
            options.failure(msg, e);
          }
        } else if (jQuery.type(options.failure) === jQuery.type(options.error) === 'null') {
          // Default error behavior if failure & error both unspecified
          options.error = function(xhr, msg, e){
            window.console&&console.log('getFeed failed to load feed', xhr, msg, e);
          }
        }

        return jQuery.ajax({
            type: 'GET',
            url: options.url,
            data: options.data,
            cache: options.cache,
            dataType: (document.all) ? "text" : "xml",
            success: function(xml) {
                var feed = new JFeed(xml);
                feed.feedUrl = options.url;
                if (jQuery.isFunction(options.success)) options.success(feed);
            },
            error: options.error,
            global: options.global
        });
    }
};

function JFeed(xml) {
    if (xml) this.parse(xml);
}
;

JFeed.prototype = {

    feedUrl: '',
    title: '',
    link: '',
    author: '',
    description: '',
    type: '',
    entries: [],
    version: '',
    language: '',
    updated: '',
    parse: function(xml) {

        if (window.ActiveXObject) {
            var xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.loadXML(xml);
            xml = xmlDoc;
        } else {
            xml = $.parseXML(xml);
        }

        if (jQuery('channel', xml).length == 1) {

            var feedClass = new JRss(xml);

        } else if (jQuery('feed', xml).length == 1) {

            var feedClass = new JAtom(xml);
        }

        if (feedClass) jQuery.extend(this, feedClass);
    }
};


function JFeedItem() {};

JFeedItem.prototype = {

    title: '',
    link: '',
    author: '',
    publishedDate: '',
    description: '',
    content: '',
    categories: [],
    id: '',
	coordinates: ''
};


function JRss(xml) {
    this._parse(xml);
};

JRss.prototype  = {

    _parse: function(xml) {
        this.type = 'rss';
        if(typeof xml == 'string'){
            xml = jQuery.parseXML(xml);
        }

        if(jQuery('rss', xml).length == 0) {
            this.version = '1.0';
            this.type += '10';
        } else {
            this.version = jQuery('rss', xml).eq(0).attr('version');
            this.type += this.version.toString().split('.').join('');
        }

        var channel = jQuery('channel', xml).eq(0);

        this.title = jQuery(channel).find('title:first').text();
        this.link = jQuery(channel).find('link:first').text();
        this.description = jQuery(channel).find('description:first').text();
        this.language = jQuery(channel).find('language:first').text();
        this.updated = jQuery(channel).find('lastBuildDate:first').text();

        this.entries = new Array();

        var feed = this;

        jQuery('item', xml).each( function() {

            var item = new JFeedItem();

            var t = jQuery(this);

            item.title = t.find('title').eq(0).text();
            item.link = t.find('link').eq(0).text();
            item.description = t.find('description').eq(0).text();

            item.content = t.find('content\\:encoded').eq(0).text();
            if (!item.content) item.content = t.find('encoded').eq(0).text();
            item.author = t.find('dc\\:creator').eq(0).text();
            if (!item.author) item.author = t.find('creator').eq(0).text();

            item.publishedDate = t.find('pubDate').eq(0).text();
            item.id = t.find('guid').eq(0).text();
            item.enclosure = t.find('enclosure').attr('url');

            var point = t.find('georss\\:point').eq(0).text();
            if (!point) point = t.find('point').eq(0).text();
            if (point.length > 0) {
              point = point.split(" ");
              item.coordinates = [point[1], point[0]];
            }

            feed.entries.push(item);
        });
    }
};


"use strict";
var SprFeed = function(opts){
	var _this = this;
	this.opts = $.extend({},this.defaults,opts);

	this.db = new SprDb({
		name : 'SprFeed'+opts.url,
		schema : {
			feed : opts.defaults
		},
		onLoad : function(){
			_this.loadFromCache();
		}
	});
	this.articleCurrent=0;
}

SprFeed.prototype = {
	defaults : {
		useProxy : true,
		proxyUrl : 'http://assets.kyd.com.au/jsonproxy/?uri={url}'
	},
	getRemoteUrl : function(url,callback){
		var ajaxOpts = {};
		if(this.opts.useProxy){
			ajaxOpts.url = this.opts.proxyUrl.replace('{url}',url);
			ajaxOpts.dataType = 'jsonp';
		} else {
			ajaxOpts.url = url;
		}

		ajaxOpts.success = function(data){
			callback(data);
		}

		ajaxOpts.error = function(){
			callback(false);
		}

		$.ajax(ajaxOpts);
	},
	loadFromCache : function(){
		var _this = this;

		if(_this.opts.cache !== false && _this.db.data.feed && _this.opts.onLoad){
			_this.feed = _this.db.data.feed;
			_this.opts.onLoad(_this);
		}
	},
	/**
	 * Merge two feeds. f1 is the newer feed, t2 is the older
	 * feed we want to merge in.
	 */
	_mergeEntries : function(f1,f2){
		var f1StartLength = f1.length;
		for(var j=0; j<f2.length; j++){
			var append = true;
			for(var i=0; i<f1StartLength; i++){
				if(f1[i].id == f2[j].id){
					// Extend the new version over the old version so we
					// get any changes, but keep our toggled flags.
					['read','fav'].forEach(function(prop){
						f1[i][prop] = f2[i][prop];
					});
					append = false;
					break;
				}
			}
			if(append){
				f1.push(f2[j]);
			}
		}
		return f1;
	},
	load : function(cache){
		var _this = this;

		var startTime = Date.now();
		this.getRemoteUrl(this.opts.url,function(data){
			var newFeed = new JFeed(data);

			for(var i=0;i<newFeed.entries.length;i++){
				newFeed.entries[i].description = sanitiseHTMLFragmment(newFeed.entries[i].description);
			}

			if(_this.feed && _this.feed.entries){
				newFeed.entries = _this._mergeEntries(newFeed.entries,_this.feed.entries);
			}

			newFeed.updatetime = Date.now();
			newFeed.updatelength = Date.now() - startTime;

			// Apply the feed and save it.
			_this.feed = newFeed;
			_this.save();

			_this.opts.onLoad && _this.opts.onLoad(_this);
		})
	},
	save : function(){
		this.db.data.feed = this.feed;
		this.db.save();
	},
	getOverview : function(){
		return {
			title : this.feed.title,
			link : this.feed.link,
			feedurl : this.opts.url,
			unread : this.getUnreadCount(),
			updateTime : this.feed.updatetime,
			updatelength : this.feed.updatelength
		}
	},
	getUnreadCount : function(){
		var count = 0;
		if(!this.feed.entries){
			return count;
		}

		for(var i=0;i<this.feed.entries.length;i++){
			if(!this.feed.entries[i].read){
				count++;
			}
		}
		return count;
	},
	_getEntryByID : function(id){
		for(var i=0; i<this.feed.entries.length; i++){
			if(this.feed.entries[i].id == id){
				return this.feed.entries[i];
			}
		}
		return false;
	},
	toggleFlag : function(id,flag){
		var entry = this._getEntryByID(id);
		entry[flag] = !entry[flag];
		this.save();
	},
	/**
	 * Mark a feed as read
	 * @param  {string} id The entry ID (usually a permalink)
	 */
	markRead : function(id){
		var entry = this._getEntryByID(id);
		if(!entry.read){
			entry.read = true;
			this.save();
		}
	}
};

var SprDb = function(opts){
	this.opts = opts;
	this.open(this.opts.onLoad);
}
SprDb.prototype = {
	open : function(callback){
		var _this = this;
		Lawnchair(function(){
			this.get(_this.opts.name,function(data){
				if(!!data && data.value){
					data = data.value;
				} else {
					data = $.extend({},_this.opts.schema);
				}

				_this.data = data;

				if(callback) {
					callback(data);
				} else {
					this.opts.onLoad && this.opts.onLoad(data);
				}
			})
		})
	},
	save : function(){
		var _this = this;
		Lawnchair(function(){
			this.save({key:_this.opts.name,value:_this.data},function(){
				_this.opts.onPostSave && _this.opts.onPostSave(_this);
			});
		})
	}

}

var SprFeeds = function(){
	var _this = this;
	this.db = new SprDb({
		name : 'SprFeeds',
		schema : this.devaultSchema,
		onPostSave : function(db){
			if(db.data === null){
				return;
			}
			console.log(db.data);
			$('.sidebar').empty().append(JST["templates/sidebar.hbs"](db.data));
		},
		onLoad : function(){
			if(!_this.db.data || !_this.db.data.feeds || !_this.db.data.feeds.push){
				_this.db.data = _this.defaultSchema;
			}
			_this.db.opts.onPostSave(_this.db);
		}
	});
}

SprFeeds.prototype = {
	defaultSchema : {
			feeds : []
		},
	_getFeedByUrl : function(url){
		for(var i=0; i < this.db.data.feeds.length; i++){
			if(this.db.data.feeds[i].feedurl == url){
				return i;
			}
		}
		return false;
	},
	createFeed : function(opts,callback){
		var _this = this;

		// If a configuration option hasn't been passed, assume
		// the string is the url and create one.
		if(typeof opts == 'string'){
			opts = {
				url : opts,
				save : true,
				defaults : false,
				loadNow : true
			}
		}

		var newFeed = new SprFeed({
			url : opts.url,
			defaults : opts.defaults,
			onLoad : function(newFeed){
				var overview = newFeed.getOverview();
				_this.db.data.feeds.push(overview);
				if(opts.save){
					_this.db.save();
				}
				if(callback){
					callback(newFeed);
				}
			}
		});

		if(opts.loadNow){
			newFeed.load();
		}
	},
	updateFeeds : function(callback){
		var _this = this;
		var i = 0;
		var update = function(){
			_this.loadFeed(_this.db.data.feeds[i].feedurl,function(){
				i++;
				if(i<_this.db.data.feeds.length){
					update();
				} else if(callback) {
					_this.save();
					callback && callback();
				}
			});
		}
		update();
	},
	loadFeed : function(url,callback){
		var _this = this;
		var feed = _this._getFeedByUrl(url);
		if(feed === false) return;

		var $feed = $('.feed.content')
			.scrollTop(0);

		var thisRef = _this.db.data.feeds[feed];
		var thisFeed = new SprFeed({
			url : thisRef.feedurl,
			onLoad : function(){
				$feed
					.empty()
					.append(JST["templates/feed.hbs"](thisFeed));
				_this.db.data.feeds[feed] = thisFeed.getOverview();
				_this.db.save();
				callback && callback();
			}
		});
		thisFeed.load();
		this.feed = thisFeed;
	},
	deleteFeed : function(url){
		var feed = this._getFeedByUrl(url);
		if(!feed === false) return;
		this.db.data.feeds.splice(feed,1);
		this.db.save();
	},
	loadOpml : function(opml){
		var _this = this;
		if(typeof opml == 'string'){
			opml = $.parseXML(opml);
		}

		$('outline',opml).each(function(){
			if($(this).attr('xmlUrl')){
				_this.createFeed({
					url : $(this).attr('xmlUrl'),
					defaults : {
						title : $(this).attr('title')
					}
				});
			}

		});
		_this.db.save();
		//_this.updateFeeds();
	}
}

window.onload = function(){

	/**
	 * How fast do animations comlpete. (Milliseconds.)
	 * @type {Number}
	 */
	var animateSpeed = 100;

	/**
	 * The amount of scroll buffer to apply when jumping
	 * to feeds etc. This could probably be acheived with
	 * CSS padding.
	 * @type {Number}
	 */
	var scrollBuffer = 15;

	/**
	 * The main feed data source and magic happener.
	 * @type {SprFeeds}
	 */
	var feeds = new SprFeeds();
	window.feeds = feeds; //FIXME

	window.onresize();

	$('.showmodal').click(function(){
		var target = $(this).data('modal');
		$(target).modal('show');
		return true;
	});

	$('#addFeed .primary').click(function(){
		var url = $(this).closest('.ui.modal').find('input[type="text"]').val();
		var feed = feeds.createFeed(url,function(){
			feeds.loadFeed(url);
		});
		
	});

	$(document).on('click','.superfeeds.action',function(){
		var action = $(this).data('action');
		var p1 = $(this).data('p1');
		feeds[action](p1);
		return false;
	});

	$(document).on('click','.superfeed.action',function(){
		var action = $(this).data('action');
		var id = $(this).closest('.entry').data('id');
		var p2 = $(this).data('p2');
		feeds.feed[action](id,p2);
		if($(this).hasClass('toggle')){
			$(this).toggleClass('active');
		}
		return false;
	});

	// Read OPML
	$('#opml').change(function(e){
		var file = e.originalEvent.target.files[0];
		var reader = new FileReader();
		reader.onload = function(e){
			var opml = e.target.result;
			$('#importFeeds').modal('hide');

			// Leave a little delay to let the animation be buttery.
			window.setTimeout(function(){
				feeds.loadOpml(opml);
			},500);
		}
		reader.readAsText(file);

		return false;
	});


	/* Mark as read functionality */
	var getTopWithOffsets = function($newTarget){
		return $newTarget.offset().top +
			$('.feed').scrollTop() -
			$('.feed').offset().top;
	}

	Mousetrap.bind(['j','k'],function(e,key){

		var articleCurrent = feeds.feed.articleCurrent;

		feeds.feed.markRead($('.entries .entry').eq(articleCurrent).data('id'));

		if(key == 'j'){
			articleCurrent++;
		} else {
			articleCurrent--;
		}

		if(articleCurrent < 0) {
			articleCurrent = 0;
		}

		if(articleCurrent >= $('.entries .entry').length) {
			articleCurrent--;
		}


		var scrollTo = articleCurrent == 0 ? 0 : getTopWithOffsets($('.entries .entry').eq(articleCurrent)) - scrollBuffer;
		$('.feed').animate({
			scrollTop : scrollTo
		},animateSpeed);

		feeds.feed.articleCurrent = articleCurrent;

	});

	$('.feed').scroll(function(){
		var scrollTop = $(this).scrollTop();

		// This could get slow for large feeds. I'm not sure
		// if I want to equate list index with feed index yet.
		$('.entry',this).each(function(i){
			if(scrollTop >= getTopWithOffsets($(this)) - scrollBuffer*2){
				feeds.feed.markRead($(this).data('id'));
				feeds.feed.articleCurrent = i;
				$('.entries .entry .read').eq(i).addClass('active');
			}
		})
	})
}

window.onresize = function(){
	$('body').height(window.innerHeight+'px');
}