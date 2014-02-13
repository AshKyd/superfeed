/*!
  localForage -- Offline Storage, Improved
  http://mozilla.github.io/localForage
  (c) 2013-2014 Mozilla, Apache License 2.0
*/

// ES6 Promises Polyfill
// https://github.com/jakearchibald/ES6-Promises
// MIT license
// (https://github.com/jakearchibald/ES6-Promises/blob/master/LICENSE)
(function() {
var define, requireModule, require, requirejs;

(function() {
  var registry = {}, seen = {};

  define = function(name, deps, callback) {
    registry[name] = { deps: deps, callback: callback };
  };

  requirejs = require = requireModule = function(name) {
  requirejs._eak_seen = registry;

    if (seen[name]) { return seen[name]; }
    seen[name] = {};

    if (!registry[name]) {
      throw new Error("Could not find module " + name);
    }

    var mod = registry[name],
        deps = mod.deps,
        callback = mod.callback,
        reified = [],
        exports;

    for (var i=0, l=deps.length; i<l; i++) {
      if (deps[i] === 'exports') {
        reified.push(exports = {});
      } else {
        reified.push(requireModule(resolve(deps[i])));
      }
    }

    var value = callback.apply(this, reified);
    return seen[name] = exports || value;

    function resolve(child) {
      if (child.charAt(0) !== '.') { return child; }
      var parts = child.split("/");
      var parentBase = name.split("/").slice(0, -1);

      for (var i=0, l=parts.length; i<l; i++) {
        var part = parts[i];

        if (part === '..') { parentBase.pop(); }
        else if (part === '.') { continue; }
        else { parentBase.push(part); }
      }

      return parentBase.join("/");
    }
  };
})();

define("promise/all", 
  ["./utils","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    /* global toString */

    var isArray = __dependency1__.isArray;
    var isFunction = __dependency1__.isFunction;

    /**
      Returns a promise that is fulfilled when all the given promises have been
      fulfilled, or rejected if any of them become rejected. The return promise
      is fulfilled with an array that gives all the values in the order they were
      passed in the `promises` array argument.

      Example:

      ```javascript
      var promise1 = RSVP.resolve(1);
      var promise2 = RSVP.resolve(2);
      var promise3 = RSVP.resolve(3);
      var promises = [ promise1, promise2, promise3 ];

      RSVP.all(promises).then(function(array){
        // The array here would be [ 1, 2, 3 ];
      });
      ```

      If any of the `promises` given to `RSVP.all` are rejected, the first promise
      that is rejected will be given as an argument to the returned promises's
      rejection handler. For example:

      Example:

      ```javascript
      var promise1 = RSVP.resolve(1);
      var promise2 = RSVP.reject(new Error("2"));
      var promise3 = RSVP.reject(new Error("3"));
      var promises = [ promise1, promise2, promise3 ];

      RSVP.all(promises).then(function(array){
        // Code here never runs because there are rejected promises!
      }, function(error) {
        // error.message === "2"
      });
      ```

      @method all
      @for RSVP
      @param {Array} promises
      @param {String} label
      @return {Promise} promise that is fulfilled when all `promises` have been
      fulfilled, or rejected if any of them become rejected.
    */
    function all(promises) {
      /*jshint validthis:true */
      var Promise = this;

      if (!isArray(promises)) {
        throw new TypeError('You must pass an array to all.');
      }

      return new Promise(function(resolve, reject) {
        var results = [], remaining = promises.length,
        promise;

        if (remaining === 0) {
          resolve([]);
        }

        function resolver(index) {
          return function(value) {
            resolveAll(index, value);
          };
        }

        function resolveAll(index, value) {
          results[index] = value;
          if (--remaining === 0) {
            resolve(results);
          }
        }

        for (var i = 0; i < promises.length; i++) {
          promise = promises[i];

          if (promise && isFunction(promise.then)) {
            promise.then(resolver(i), reject);
          } else {
            resolveAll(i, promise);
          }
        }
      });
    }

    __exports__.all = all;
  });
define("promise/asap", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var browserGlobal = (typeof window !== 'undefined') ? window : {};
    var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
    var local = (typeof global !== 'undefined') ? global : this;

    // node
    function useNextTick() {
      return function() {
        process.nextTick(flush);
      };
    }

    function useMutationObserver() {
      var iterations = 0;
      var observer = new BrowserMutationObserver(flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    function useSetTimeout() {
      return function() {
        local.setTimeout(flush, 1);
      };
    }

    var queue = [];
    function flush() {
      for (var i = 0; i < queue.length; i++) {
        var tuple = queue[i];
        var callback = tuple[0], arg = tuple[1];
        callback(arg);
      }
      queue = [];
    }

    var scheduleFlush;

    // Decide what async method to use to triggering processing of queued callbacks:
    if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
      scheduleFlush = useNextTick();
    } else if (BrowserMutationObserver) {
      scheduleFlush = useMutationObserver();
    } else {
      scheduleFlush = useSetTimeout();
    }

    function asap(callback, arg) {
      var length = queue.push([callback, arg]);
      if (length === 1) {
        // If length is 1, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        scheduleFlush();
      }
    }

    __exports__.asap = asap;
  });
define("promise/cast", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      `RSVP.Promise.cast` returns the same promise if that promise shares a constructor
      with the promise being casted.

      Example:

      ```javascript
      var promise = RSVP.resolve(1);
      var casted = RSVP.Promise.cast(promise);

      console.log(promise === casted); // true
      ```

      In the case of a promise whose constructor does not match, it is assimilated.
      The resulting promise will fulfill or reject based on the outcome of the
      promise being casted.

      In the case of a non-promise, a promise which will fulfill with that value is
      returned.

      Example:

      ```javascript
      var value = 1; // could be a number, boolean, string, undefined...
      var casted = RSVP.Promise.cast(value);

      console.log(value === casted); // false
      console.log(casted instanceof RSVP.Promise) // true

      casted.then(function(val) {
        val === value // => true
      });
      ```

      `RSVP.Promise.cast` is similar to `RSVP.resolve`, but `RSVP.Promise.cast` differs in the
      following ways:
      * `RSVP.Promise.cast` serves as a memory-efficient way of getting a promise, when you
      have something that could either be a promise or a value. RSVP.resolve
      will have the same effect but will create a new promise wrapper if the
      argument is a promise.
      * `RSVP.Promise.cast` is a way of casting incoming thenables or promise subclasses to
      promises of the exact class specified, so that the resulting object's `then` is
      ensured to have the behavior of the constructor you are calling cast on (i.e., RSVP.Promise).

      @method cast
      @for RSVP
      @param {Object} object to be casted
      @return {Promise} promise that is fulfilled when all properties of `promises`
      have been fulfilled, or rejected if any of them become rejected.
    */


    function cast(object) {
      /*jshint validthis:true */
      if (object && typeof object === 'object' && object.constructor === this) {
        return object;
      }

      var Promise = this;

      return new Promise(function(resolve) {
        resolve(object);
      });
    }

    __exports__.cast = cast;
  });
define("promise/config", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var config = {
      instrument: false
    };

    function configure(name, value) {
      if (arguments.length === 2) {
        config[name] = value;
      } else {
        return config[name];
      }
    }

    __exports__.config = config;
    __exports__.configure = configure;
  });
define("promise/polyfill", 
  ["./promise","./utils","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var RSVPPromise = __dependency1__.Promise;
    var isFunction = __dependency2__.isFunction;

    function polyfill() {
      var es6PromiseSupport = 
        "Promise" in window &&
        // Some of these methods are missing from
        // Firefox/Chrome experimental implementations
        "cast" in window.Promise &&
        "resolve" in window.Promise &&
        "reject" in window.Promise &&
        "all" in window.Promise &&
        "race" in window.Promise &&
        // Older version of the spec had a resolver object
        // as the arg rather than a function
        (function() {
          var resolve;
          new window.Promise(function(r) { resolve = r; });
          return isFunction(resolve);
        }());

      if (!es6PromiseSupport) {
        window.Promise = RSVPPromise;
      }
    }

    __exports__.polyfill = polyfill;
  });
define("promise/promise", 
  ["./config","./utils","./cast","./all","./race","./resolve","./reject","./asap","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __dependency8__, __exports__) {
    "use strict";
    var config = __dependency1__.config;
    var configure = __dependency1__.configure;
    var objectOrFunction = __dependency2__.objectOrFunction;
    var isFunction = __dependency2__.isFunction;
    var now = __dependency2__.now;
    var cast = __dependency3__.cast;
    var all = __dependency4__.all;
    var race = __dependency5__.race;
    var staticResolve = __dependency6__.resolve;
    var staticReject = __dependency7__.reject;
    var asap = __dependency8__.asap;

    var counter = 0;

    config.async = asap; // default async is asap;

    function Promise(resolver) {
      if (!isFunction(resolver)) {
        throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
      }

      if (!(this instanceof Promise)) {
        throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
      }

      this._subscribers = [];

      invokeResolver(resolver, this);
    }

    function invokeResolver(resolver, promise) {
      function resolvePromise(value) {
        resolve(promise, value);
      }

      function rejectPromise(reason) {
        reject(promise, reason);
      }

      try {
        resolver(resolvePromise, rejectPromise);
      } catch(e) {
        rejectPromise(e);
      }
    }

    function invokeCallback(settled, promise, callback, detail) {
      var hasCallback = isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        try {
          value = callback(detail);
          succeeded = true;
        } catch(e) {
          failed = true;
          error = e;
        }
      } else {
        value = detail;
        succeeded = true;
      }

      if (handleThenable(promise, value)) {
        return;
      } else if (hasCallback && succeeded) {
        resolve(promise, value);
      } else if (failed) {
        reject(promise, error);
      } else if (settled === FULFILLED) {
        resolve(promise, value);
      } else if (settled === REJECTED) {
        reject(promise, value);
      }
    }

    var PENDING   = void 0;
    var SEALED    = 0;
    var FULFILLED = 1;
    var REJECTED  = 2;

    function subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      subscribers[length] = child;
      subscribers[length + FULFILLED] = onFulfillment;
      subscribers[length + REJECTED]  = onRejection;
    }

    function publish(promise, settled) {
      var child, callback, subscribers = promise._subscribers, detail = promise._detail;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        invokeCallback(settled, child, callback, detail);
      }

      promise._subscribers = null;
    }

    Promise.prototype = {
      constructor: Promise,

      _state: undefined,
      _detail: undefined,
      _subscribers: undefined,

      then: function(onFulfillment, onRejection) {
        var promise = this;

        var thenPromise = new this.constructor(function() {});

        if (this._state) {
          var callbacks = arguments;
          config.async(function invokePromiseCallback() {
            invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
          });
        } else {
          subscribe(this, thenPromise, onFulfillment, onRejection);
        }

        return thenPromise;
      },

      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };

    Promise.all = all;
    Promise.cast = cast;
    Promise.race = race;
    Promise.resolve = staticResolve;
    Promise.reject = staticReject;

    function handleThenable(promise, value) {
      var then = null,
      resolved;

      try {
        if (promise === value) {
          throw new TypeError("A promises callback cannot return that same promise.");
        }

        if (objectOrFunction(value)) {
          then = value.then;

          if (isFunction(then)) {
            then.call(value, function(val) {
              if (resolved) { return true; }
              resolved = true;

              if (value !== val) {
                resolve(promise, val);
              } else {
                fulfill(promise, val);
              }
            }, function(val) {
              if (resolved) { return true; }
              resolved = true;

              reject(promise, val);
            });

            return true;
          }
        }
      } catch (error) {
        if (resolved) { return true; }
        reject(promise, error);
        return true;
      }

      return false;
    }

    function resolve(promise, value) {
      if (promise === value) {
        fulfill(promise, value);
      } else if (!handleThenable(promise, value)) {
        fulfill(promise, value);
      }
    }

    function fulfill(promise, value) {
      if (promise._state !== PENDING) { return; }
      promise._state = SEALED;
      promise._detail = value;

      config.async(publishFulfillment, promise);
    }

    function reject(promise, reason) {
      if (promise._state !== PENDING) { return; }
      promise._state = SEALED;
      promise._detail = reason;

      config.async(publishRejection, promise);
    }

    function publishFulfillment(promise) {
      publish(promise, promise._state = FULFILLED);
    }

    function publishRejection(promise) {
      publish(promise, promise._state = REJECTED);
    }

    __exports__.Promise = Promise;
  });
define("promise/race", 
  ["./utils","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    /* global toString */
    var isArray = __dependency1__.isArray;

    /**
      `RSVP.race` allows you to watch a series of promises and act as soon as the
      first promise given to the `promises` argument fulfills or rejects.

      Example:

      ```javascript
      var promise1 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          resolve("promise 1");
        }, 200);
      });

      var promise2 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          resolve("promise 2");
        }, 100);
      });

      RSVP.race([promise1, promise2]).then(function(result){
        // result === "promise 2" because it was resolved before promise1
        // was resolved.
      });
      ```

      `RSVP.race` is deterministic in that only the state of the first completed
      promise matters. For example, even if other promises given to the `promises`
      array argument are resolved, but the first completed promise has become
      rejected before the other promises became fulfilled, the returned promise
      will become rejected:

      ```javascript
      var promise1 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          resolve("promise 1");
        }, 200);
      });

      var promise2 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          reject(new Error("promise 2"));
        }, 100);
      });

      RSVP.race([promise1, promise2]).then(function(result){
        // Code here never runs because there are rejected promises!
      }, function(reason){
        // reason.message === "promise2" because promise 2 became rejected before
        // promise 1 became fulfilled
      });
      ```

      @method race
      @for RSVP
      @param {Array} promises array of promises to observe
      @param {String} label optional string for describing the promise returned.
      Useful for tooling.
      @return {Promise} a promise that becomes fulfilled with the value the first
      completed promises is resolved with if the first completed promise was
      fulfilled, or rejected with the reason that the first completed promise
      was rejected with.
    */
    function race(promises) {
      /*jshint validthis:true */
      var Promise = this;

      if (!isArray(promises)) {
        throw new TypeError('You must pass an array to race.');
      }
      return new Promise(function(resolve, reject) {
        var results = [], promise;

        for (var i = 0; i < promises.length; i++) {
          promise = promises[i];

          if (promise && typeof promise.then === 'function') {
            promise.then(resolve, reject);
          } else {
            resolve(promise);
          }
        }
      });
    }

    __exports__.race = race;
  });
define("promise/reject", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      `RSVP.reject` returns a promise that will become rejected with the passed
      `reason`. `RSVP.reject` is essentially shorthand for the following:

      ```javascript
      var promise = new RSVP.Promise(function(resolve, reject){
        reject(new Error('WHOOPS'));
      });

      promise.then(function(value){
        // Code here doesn't run because the promise is rejected!
      }, function(reason){
        // reason.message === 'WHOOPS'
      });
      ```

      Instead of writing the above, your code now simply becomes the following:

      ```javascript
      var promise = RSVP.reject(new Error('WHOOPS'));

      promise.then(function(value){
        // Code here doesn't run because the promise is rejected!
      }, function(reason){
        // reason.message === 'WHOOPS'
      });
      ```

      @method reject
      @for RSVP
      @param {Any} reason value that the returned promise will be rejected with.
      @param {String} label optional string for identifying the returned promise.
      Useful for tooling.
      @return {Promise} a promise that will become rejected with the given
      `reason`.
    */
    function reject(reason) {
      /*jshint validthis:true */
      var Promise = this;

      return new Promise(function (resolve, reject) {
        reject(reason);
      });
    }

    __exports__.reject = reject;
  });
define("promise/resolve", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      `RSVP.resolve` returns a promise that will become fulfilled with the passed
      `value`. `RSVP.resolve` is essentially shorthand for the following:

      ```javascript
      var promise = new RSVP.Promise(function(resolve, reject){
        resolve(1);
      });

      promise.then(function(value){
        // value === 1
      });
      ```

      Instead of writing the above, your code now simply becomes the following:

      ```javascript
      var promise = RSVP.resolve(1);

      promise.then(function(value){
        // value === 1
      });
      ```

      @method resolve
      @for RSVP
      @param {Any} value value that the returned promise will be resolved with
      @param {String} label optional string for identifying the returned promise.
      Useful for tooling.
      @return {Promise} a promise that will become fulfilled with the given
      `value`
    */
    function resolve(value) {
      /*jshint validthis:true */
      var Promise = this;
      return new Promise(function(resolve, reject) {
        resolve(value);
      });
    }

    __exports__.resolve = resolve;
  });
define("promise/utils", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function objectOrFunction(x) {
      return isFunction(x) || (typeof x === "object" && x !== null);
    }

    function isFunction(x) {
      return typeof x === "function";
    }

    function isArray(x) {
      return Object.prototype.toString.call(x) === "[object Array]";
    }

    // Date.now is not available in browsers < IE9
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now#Compatibility
    var now = Date.now || function() { return new Date().getTime(); };


    __exports__.objectOrFunction = objectOrFunction;
    __exports__.isFunction = isFunction;
    __exports__.isArray = isArray;
    __exports__.now = now;
  });
requireModule('promise/polyfill').polyfill();
}());
(function() {
    'use strict';

    /**
     * This file defines an asynchronous version of the localStorage API, backed by
     * an IndexedDB database. It creates a global asyncStorage object that has
     * methods like the localStorage object.
     *
     * To store a value use setItem:
     *
     *     asyncStorage.setItem('key', 'value');
     *
     * If you want confirmation that the value has been stored, pass a callback
     * function as the third argument:
     *
     *    asyncStorage.setItem('key', 'newvalue', function() {
     *        console.log('new value stored');
     *    });
     *
     * To read a value, call getItem(), but note that you must supply a callback
     * function that the value will be passed to asynchronously:
     *
     *    asyncStorage.getItem('key', function(value) {
     *        console.log('The value of key is:', value);
     *    });
     *
     * Note that unlike localStorage, asyncStorage does not allow you to store and
     * retrieve values by setting and querying properties directly. You cannot just
     * write asyncStorage.key; you have to explicitly call setItem() or getItem().
     *
     * removeItem(), clear(), length(), and key() are like the same-named methods of
     * localStorage, but, like getItem() and setItem() they take a callback
     * argument.
     *
     * The asynchronous nature of getItem() makes it tricky to retrieve multiple
     * values. But unlike localStorage, asyncStorage does not require the values you
     * store to be strings.    So if you need to save multiple values and want to
     * retrieve them together, in a single asynchronous operation, just group the
     * values into a single object. The properties of this object may not include
     * DOM elements, but they may include things like Blobs and typed arrays.
     */

    var DBNAME = 'asyncStorage';
    var DBVERSION = 1;
    var STORENAME = 'keyvaluepairs';
    var Promise = window.Promise;
    var db = null;

    // Initialize IndexedDB; fall back to vendor-prefixed versions if needed.
    var indexedDB = indexedDB || window.indexedDB || window.webkitIndexedDB ||
                    window.mozIndexedDB || window.OIndexedDB ||
                    window.msIndexedDB;

    // If IndexedDB isn't available, we get outta here!
    if (!indexedDB) {
        return;
    }

    function withStore(type, f) {
        if (db) {
            f(db.transaction(STORENAME, type).objectStore(STORENAME));
        } else {
            var openreq = indexedDB.open(DBNAME, DBVERSION);
            openreq.onerror = function withStoreOnError() {
                console.error("asyncStorage: can't open database:", openreq.error.name);
            };
            openreq.onupgradeneeded = function withStoreOnUpgradeNeeded() {
                // First time setup: create an empty object store
                openreq.result.createObjectStore(STORENAME);
            };
            openreq.onsuccess = function withStoreOnSuccess() {
                db = openreq.result;
                f(db.transaction(STORENAME, type).objectStore(STORENAME));
            };
        }
    }

    function getItem(key, callback) {
        return new Promise(function(resolve, reject) {
            withStore('readonly', function getItemBody(store) {
                var req = store.get(key);
                req.onsuccess = function getItemOnSuccess() {
                    var value = req.result;
                    if (value === undefined) {
                        value = null;
                    }

                    if (callback) {
                        callback(value);
                    }

                    resolve(value);
                };
                req.onerror = function getItemOnError() {
                    console.error('Error in asyncStorage.getItem(): ', req.error.name);
                };
            });
        });
    }

    function setItem(key, value, callback) {
        return new Promise(function(resolve, reject) {
            withStore('readwrite', function setItemBody(store) {
                // Cast to undefined so the value passed to callback/promise is
                // the same as what one would get out of `getItem()` later.
                // This leads to some weirdness (setItem('foo', undefined) will
                // return "null"), but it's not my fault localStorage is our
                // baseline and that it's weird.
                if (value === undefined) {
                    value = null;
                }

                var req = store.put(value, key);
                req.onsuccess = function setItemOnSuccess() {
                    if (callback) {
                        callback(value);
                    }

                    resolve(value);
                };
                req.onerror = function setItemOnError() {
                    console.error('Error in asyncStorage.setItem(): ', req.error.name);
                };
            });
        });
    }

    function removeItem(key, callback) {
        return new Promise(function(resolve, reject) {
            withStore('readwrite', function removeItemBody(store) {
                var req = store.delete(key);
                req.onsuccess = function removeItemOnSuccess() {
                    if (callback) {
                        callback();
                    }

                    resolve();
                };
                req.onerror = function removeItemOnError() {
                    console.error('Error in asyncStorage.removeItem(): ', req.error.name);
                };
            });
        });
    }

    function clear(callback) {
        return new Promise(function(resolve, reject) {
            withStore('readwrite', function clearBody(store) {
                var req = store.clear();
                req.onsuccess = function clearOnSuccess() {
                    if (callback) {
                        callback();
                    }

                    resolve();
                };
                req.onerror = function clearOnError() {
                    console.error('Error in asyncStorage.clear(): ', req.error.name);
                };
            });
        });
    }

    function length(callback) {
        return new Promise(function(resolve, reject) {
            withStore('readonly', function lengthBody(store) {
                var req = store.count();
                req.onsuccess = function lengthOnSuccess() {
                    if (callback) {
                        callback(req.result);
                    }

                    resolve(req.result);
                };
                req.onerror = function lengthOnError() {
                    console.error('Error in asyncStorage.length(): ', req.error.name);
                };
            });
        });
    }

    function key(n, callback) {
        return new Promise(function(resolve, reject) {
            if (n < 0) {
                if (callback) {
                    callback(null);
                }

                resolve(null);

                return;
            }

            withStore('readonly', function keyBody(store) {
                var advanced = false;
                var req = store.openCursor();
                req.onsuccess = function keyOnSuccess() {
                    var cursor = req.result;
                    if (!cursor) {
                        // this means there weren't enough keys
                        if (callback) {
                            callback(null);
                        }

                        resolve(null);

                        return;
                    }
                    if (n === 0) {
                        // We have the first key, return it if that's what they wanted
                        if (callback) {
                            callback(cursor.key);
                        }

                        resolve(cursor.key);
                    } else {
                        if (!advanced) {
                            // Otherwise, ask the cursor to skip ahead n records
                            advanced = true;
                            cursor.advance(n);
                        } else {
                            // When we get here, we've got the nth key.
                            if (callback) {
                                callback(cursor.key);
                            }

                            resolve(cursor.key);
                        }
                    }
                };

                req.onerror = function keyOnError() {
                    console.error('Error in asyncStorage.key(): ', req.error.name);
                };
            });
        });
    }

    var asyncStorage = {
        driver: 'asyncStorage',
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key
    };

    if (typeof define === 'function' && define.amd) {
        define('asyncStorage', function() {
            return asyncStorage;
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = asyncStorage;
    } else {
        this.asyncStorage = asyncStorage;
    }
}).call(this);
// If IndexedDB isn't available, we'll fall back to localStorage.
// Note that this will have considerable performance and storage
// side-effects (all data will be serialized on save and only data that
// can be converted to a string via `JSON.stringify()` will be saved).
(function() {
    'use strict';

    var Promise = window.Promise;

    // If the app is running inside a Google Chrome packaged webapp, we don't
    // use localStorage.
    if (window.chrome && window.chrome.runtime) {
        return;
    }

    // Initialize localStorage and create a variable to use throughout the code.
    var localStorage = window.localStorage;

    // Remove all keys from the datastore, effectively destroying all data in
    // the app's key/value store!
    function clear(callback) {
        return new Promise(function(resolve, reject) {
            localStorage.clear();

            if (callback) {
                callback();
            }

            resolve();
        });
    }

    // Retrieve an item from the store. Unlike the original async_storage
    // library in Gaia, we don't modify return values at all. If a key's value
    // is `undefined`, we pass that value to the callback function.
    function getItem(key, callback) {
        return new Promise(function(resolve, reject) {
            try {
                var result = localStorage.getItem(key);

                // If a result was found, parse it from serialized JSON into a
                // JS object. If result isn't truthy, the key is likely
                // undefined and we'll pass it straight to the callback.
                if (result) {
                    result = JSON.parse(result);
                }

                if (callback) {
                    callback(result);
                }

                resolve(result);
            } catch (e) {
                reject(e);
            }
        });
    }

    // Same as localStorage's key() method, except takes a callback.
    function key(n, callback) {
        return new Promise(function(resolve, reject) {
            var result = localStorage.key(n);

            if (callback) {
                callback(result);
            }

            resolve(result);
        });
    }

    // Supply the number of keys in the datastore to the callback function.
    function length(callback) {
        return new Promise(function(resolve, reject) {
            var result = localStorage.length;

            if (callback) {
                callback(result);
            }

            resolve(result);
        });
    }

    // Remove an item from the store, nice and simple.
    function removeItem(key, callback) {
        return new Promise(function(resolve, reject) {
            localStorage.removeItem(key);

            if (callback) {
                callback();
            }

            resolve();
        });
    }

    // Set a key's value and run an optional callback once the value is set.
    // Unlike Gaia's implementation, the callback function is passed the value,
    // in case you want to operate on that value only after you're sure it
    // saved, or something like that.
    function setItem(key, value, callback) {
        return new Promise(function(resolve, reject) {
            // Convert undefined values to null.
            // https://github.com/mozilla/localForage/pull/42
            if (value === undefined) {
                value = null;
            }

            // Save the original value to pass to the callback.
            var originalValue = value;

            try {
                value = JSON.stringify(value);
            } catch (e) {
                console.error("Couldn't convert value into a JSON string: ",
                              value);
                reject(e);
            }

            localStorage.setItem(key, value);

            if (callback) {
                callback(originalValue);
            }

            resolve(originalValue);
        });
    }

    var localStorageWrapper = {
        driver: 'localStorageWrapper',
        // Default API, from Gaia/localStorage.
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key
    };

    if (typeof define === 'function' && define.amd) {
        define('localStorageWrapper', function() {
            return localStorageWrapper;
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = localStorageWrapper;
    } else {
        this.localStorageWrapper = localStorageWrapper;
    }
}).call(this);
(function() {
    'use strict';

    var DB_NAME = 'localforage';
    // Default DB size is 5MB, as it's the highest size we can use without
    // a prompt.
    var DB_SIZE = 5 * 1024 * 1024;
    var DB_VERSION = '1.0';
    var SERIALIZED_MARKER = '__lfsc__:';
    var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;
    var STORE_NAME = 'keyvaluepairs';
    var Promise = window.Promise;

    // If WebSQL methods aren't available, we can stop now.
    if (!window.openDatabase) {
        return;
    }

    // Open the database; the openDatabase API will automatically create it for
    // us if it doesn't exist.
    var db = window.openDatabase(DB_NAME, DB_VERSION, STORE_NAME, DB_SIZE);

    // Create our key/value table if it doesn't exist.
    // TODO: Technically I can imagine this being as race condition, as I'm not
    // positive on the WebSQL API enough to be sure that other transactions
    // won't be run before this? But I assume not.
    db.transaction(function (t) {
        t.executeSql('CREATE TABLE IF NOT EXISTS localforage (id INTEGER PRIMARY KEY, key unique, value)');
    });

    function getItem(key, callback) {
        return new Promise(function(resolve, reject) {
            db.transaction(function (t) {
                t.executeSql('SELECT * FROM localforage WHERE key = ? LIMIT 1', [key], function (t, results) {
                    var result = results.rows.length ? results.rows.item(0).value : null;

                    // Check to see if this is serialized content we need to
                    // unpack.
                    if (result && result.substr(0, SERIALIZED_MARKER_LENGTH) === SERIALIZED_MARKER) {
                        try {
                            result = JSON.parse(result.slice(SERIALIZED_MARKER_LENGTH));
                        } catch (e) {
                            reject(e);
                        }
                    }

                    if (callback) {
                        callback(result);
                    }

                    resolve(result);
                }, null);
            });
        });
    }

    function setItem(key, value, callback) {
        return new Promise(function(resolve, reject) {
            // The localStorage API doesn't return undefined values in an
            // "expected" way, so undefined is always cast to null in all
            // drivers. See: https://github.com/mozilla/localForage/pull/42
            if (value === undefined) {
                value = null;
            }

            // We need to serialize certain types of objects using WebSQL;
            // otherwise they'll get stored as strings as be useless when we
            // use getItem() later.
            var valueToSave;
            if (typeof(value) === 'boolean' || typeof(value) === 'number' || typeof(value) === 'object') {
                // Mark the content as "localForage serialized content" so we
                // know to run JSON.parse() on it when we get it back out from
                // the database.
                valueToSave = SERIALIZED_MARKER + JSON.stringify(value);
            } else {
                valueToSave = value;
            }

            db.transaction(function (t) {
                t.executeSql('INSERT OR REPLACE INTO localforage (key, value) VALUES (?, ?)', [key, valueToSave], function() {
                    if (callback) {
                        callback(value);
                    }

                    resolve(value);
                }, null);
            });
        });
    }

    function removeItem(key, callback) {
        return new Promise(function(resolve, reject) {
            db.transaction(function (t) {
                t.executeSql('DELETE FROM localforage WHERE key = ? LIMIT 1', [key], function() {
                    if (callback) {
                        callback();
                    }

                    resolve();
                }, null);
            });
        });
    }

    // Deletes every item in the table with a TRUNCATE call.
    // TODO: Find out if this resets the AUTO_INCREMENT number.
    function clear(callback) {
        return new Promise(function(resolve, reject) {
            db.transaction(function (t) {
                t.executeSql('DELETE FROM localforage', [], function(t, results) {
                    if (callback) {
                        callback();
                    }

                    resolve();
                }, null);
            });
        });
    }

    // Does a simple `COUNT(key)` to get the number of items stored in
    // localForage.
    function length(callback) {
        return new Promise(function(resolve, reject) {
            db.transaction(function (t) {
                // Ahhh, SQL makes this one soooooo easy.
                t.executeSql('SELECT COUNT(key) as c FROM localforage', [], function (t, results) {
                    var result = results.rows.item(0).c;

                    if (callback) {
                        callback(result);
                    }

                    resolve(result);
                }, null);
            });
        });
    }

    // Return the key located at key index X; essentially gets the key from a
    // `WHERE id = ?`. This is the most efficient way I can think to implement
    // this rarely-used (in my experience) part of the API, but it can seem
    // inconsistent, because we do `INSERT OR REPLACE INTO` on `setItem()`, so
    // the ID of each key will change every time it's updated. Perhaps a stored
    // procedure for the `setItem()` SQL would solve this problem?
    // TODO: Don't change ID on `setItem()`.
    function key(n, callback) {
        return new Promise(function(resolve, reject) {
            db.transaction(function (t) {
                t.executeSql('SELECT key FROM localforage WHERE id = ? LIMIT 1', [n + 1], function (t, results) {
                    var result = results.rows.length ? results.rows.item(0).key : null;

                    if (callback) {
                        callback(result);
                    }

                    resolve(result);
                }, null);
            });
        });
    }

    var webSQLStorage = {
        driver: 'webSQLStorage',
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key
    };

    if (typeof define === 'function' && define.amd) {
        define('webSQLStorage', function() {
            return webSQLStorage;
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = webSQLStorage;
    } else {
        this.webSQLStorage = webSQLStorage;
    }
}).call(this);
(function() {
    'use strict';

    // Promises!
    var Promise = window.Promise;

    // Avoid those magic constants!
    var MODULE_TYPE_DEFINE = 1;
    var MODULE_TYPE_EXPORT = 2;
    var MODULE_TYPE_WINDOW = 3;

    // Attaching to window (i.e. no module loader) is the assumed,
    // simple default.
    var moduleType = MODULE_TYPE_WINDOW;

    // Find out what kind of module setup we have; if none, we'll just attach
    // localForage to the main window.
    if (typeof define === 'function' && define.amd) {
        moduleType = MODULE_TYPE_DEFINE;
    } else if (typeof module !== 'undefined' && module.exports) {
        moduleType = MODULE_TYPE_EXPORT;
    }

    // Initialize IndexedDB; fall back to vendor-prefixed versions if needed.
    var indexedDB = indexedDB || window.indexedDB || window.webkitIndexedDB ||
                    window.mozIndexedDB || window.OIndexedDB ||
                    window.msIndexedDB;

    // The actual localForage object that we expose as a module or via a global.
    // It's extended by pulling in one of our other libraries.
    var _this = this;
    var localForage = {
        INDEXEDDB: 'asyncStorage',
        LOCALSTORAGE: 'localStorageWrapper',
        WEBSQL: 'webSQLStorage',

        setDriver: function(driverName, callback) {
            return new Promise(function(resolve, reject) {
                if ((!indexedDB && driverName === localForage.INDEXEDDB) ||
                    (!window.openDatabase && driverName === localForage.WEBSQL)) {
                    if (callback) {
                        callback(localForage);
                    }

                    reject(localForage);

                    return;
                }

                // We allow localForage to be declared as a module or as a library
                // available without AMD/require.js.
                if (moduleType === MODULE_TYPE_DEFINE) {
                    require([driverName], function(lib) {
                        localForage._extend(lib);

                        if (callback) {
                            callback(localForage);
                        }

                        resolve(localForage);
                    });
                } else if (moduleType === MODULE_TYPE_EXPORT) {
                    localForage._extend(require('./' + driverName));

                    if (callback) {
                        callback(localForage);
                    }

                    resolve(localForage);
                } else {
                    localForage._extend(_this[driverName]);

                    if (callback) {
                        callback(localForage);
                    }

                    resolve(localForage);
                }
            });
        },

        _extend: function(libraryMethodsAndProperties) {
            for (var i in libraryMethodsAndProperties) {
                if (libraryMethodsAndProperties.hasOwnProperty(i)) {
                    this[i] = libraryMethodsAndProperties[i];
                }
            }
        }
    };

    var storageLibrary;
    // Check to see if IndexedDB is available; it's our preferred backend
    // library.
    if (indexedDB) {
        storageLibrary = localForage.INDEXEDDB;
    } else if (window.openDatabase) { // WebSQL is available, so we'll use that.
        storageLibrary = localForage.WEBSQL;
    } else { // If nothing else is available, we use localStorage.
        storageLibrary = localForage.LOCALSTORAGE;
    }

    // Set the (default) driver.
    localForage.setDriver(storageLibrary);

    // We allow localForage to be declared as a module or as a library
    // available without AMD/require.js.
    if (moduleType === MODULE_TYPE_DEFINE) {
        define('localforage', function() {
            return localForage;
        });
    } else if (moduleType === MODULE_TYPE_EXPORT) {
        module.exports = localForage;
    } else {
        this.localforage = localForage;
    }
}).call(this);

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
    + "\" target=\"_blank\">";
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
		useProxy : false,
		proxyUrl : 'http://assets.kyd.com.au/jsonproxy/?uri={url}'
	},
	getRemoteUrl : function(url,callback){
		var ajaxOpts = {};
		if(this.opts.useProxy){
			ajaxOpts.url = this.opts.proxyUrl.replace('{url}',url);
			ajaxOpts.dataType = 'jsonp';
		} else {
			ajaxOpts.url = url;
			ajaxOpts.dataType = 'text';
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
		this.getRemoteUrl(_this.opts.url,function(data){
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
		localforage.getItem(_this.opts.name,function(data){
			if(!!data && data.value){
				data = data.value;
			} else {
				data = $.extend({},_this.opts.schema,data);
			}

			_this.data = data;

			if(callback) {
				callback(data);
			} else {
				this.opts.onLoad && this.opts.onLoad(data);
			}
		})
	},
	save : function(){
		var _this = this;
		localforage.setItem(_this.opts.name,_this.data,function(){
			_this.opts.onPostSave && _this.opts.onPostSave(_this);
		});
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
			$('.sidebar').empty().append(JST["templates/sidebar.hbs"](db.data));
		},
		onLoad : function(){
			if(!_this.db.data || !_this.db.data.feeds || !_this.db.data.feeds.push){
				debugger;
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