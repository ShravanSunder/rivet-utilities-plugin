var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var __privateWrapper = (obj, member, setter, getter) => ({
  set _(value) {
    __privateSet(obj, member, value, setter);
  },
  get _() {
    return __privateGet(obj, member, getter);
  }
});
var __privateMethod = (obj, member, method) => {
  __accessCheck(obj, member, "access private method");
  return method;
};

// node_modules/.pnpm/eventemitter3@5.0.1/node_modules/eventemitter3/index.js
var require_eventemitter3 = __commonJS({
  "node_modules/.pnpm/eventemitter3@5.0.1/node_modules/eventemitter3/index.js"(exports, module) {
    "use strict";
    var has = Object.prototype.hasOwnProperty;
    var prefix = "~";
    function Events() {
    }
    if (Object.create) {
      Events.prototype = /* @__PURE__ */ Object.create(null);
      if (!new Events().__proto__)
        prefix = false;
    }
    function EE(fn, context, once) {
      this.fn = fn;
      this.context = context;
      this.once = once || false;
    }
    function addListener(emitter, event, fn, context, once) {
      if (typeof fn !== "function") {
        throw new TypeError("The listener must be a function");
      }
      var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
      if (!emitter._events[evt])
        emitter._events[evt] = listener, emitter._eventsCount++;
      else if (!emitter._events[evt].fn)
        emitter._events[evt].push(listener);
      else
        emitter._events[evt] = [emitter._events[evt], listener];
      return emitter;
    }
    function clearEvent(emitter, evt) {
      if (--emitter._eventsCount === 0)
        emitter._events = new Events();
      else
        delete emitter._events[evt];
    }
    function EventEmitter2() {
      this._events = new Events();
      this._eventsCount = 0;
    }
    EventEmitter2.prototype.eventNames = function eventNames() {
      var names = [], events, name;
      if (this._eventsCount === 0)
        return names;
      for (name in events = this._events) {
        if (has.call(events, name))
          names.push(prefix ? name.slice(1) : name);
      }
      if (Object.getOwnPropertySymbols) {
        return names.concat(Object.getOwnPropertySymbols(events));
      }
      return names;
    };
    EventEmitter2.prototype.listeners = function listeners(event) {
      var evt = prefix ? prefix + event : event, handlers = this._events[evt];
      if (!handlers)
        return [];
      if (handlers.fn)
        return [handlers.fn];
      for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
        ee[i] = handlers[i].fn;
      }
      return ee;
    };
    EventEmitter2.prototype.listenerCount = function listenerCount(event) {
      var evt = prefix ? prefix + event : event, listeners = this._events[evt];
      if (!listeners)
        return 0;
      if (listeners.fn)
        return 1;
      return listeners.length;
    };
    EventEmitter2.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt])
        return false;
      var listeners = this._events[evt], len = arguments.length, args, i;
      if (listeners.fn) {
        if (listeners.once)
          this.removeListener(event, listeners.fn, void 0, true);
        switch (len) {
          case 1:
            return listeners.fn.call(listeners.context), true;
          case 2:
            return listeners.fn.call(listeners.context, a1), true;
          case 3:
            return listeners.fn.call(listeners.context, a1, a2), true;
          case 4:
            return listeners.fn.call(listeners.context, a1, a2, a3), true;
          case 5:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
          case 6:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
        }
        for (i = 1, args = new Array(len - 1); i < len; i++) {
          args[i - 1] = arguments[i];
        }
        listeners.fn.apply(listeners.context, args);
      } else {
        var length = listeners.length, j;
        for (i = 0; i < length; i++) {
          if (listeners[i].once)
            this.removeListener(event, listeners[i].fn, void 0, true);
          switch (len) {
            case 1:
              listeners[i].fn.call(listeners[i].context);
              break;
            case 2:
              listeners[i].fn.call(listeners[i].context, a1);
              break;
            case 3:
              listeners[i].fn.call(listeners[i].context, a1, a2);
              break;
            case 4:
              listeners[i].fn.call(listeners[i].context, a1, a2, a3);
              break;
            default:
              if (!args)
                for (j = 1, args = new Array(len - 1); j < len; j++) {
                  args[j - 1] = arguments[j];
                }
              listeners[i].fn.apply(listeners[i].context, args);
          }
        }
      }
      return true;
    };
    EventEmitter2.prototype.on = function on(event, fn, context) {
      return addListener(this, event, fn, context, false);
    };
    EventEmitter2.prototype.once = function once(event, fn, context) {
      return addListener(this, event, fn, context, true);
    };
    EventEmitter2.prototype.removeListener = function removeListener(event, fn, context, once) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt])
        return this;
      if (!fn) {
        clearEvent(this, evt);
        return this;
      }
      var listeners = this._events[evt];
      if (listeners.fn) {
        if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
          clearEvent(this, evt);
        }
      } else {
        for (var i = 0, events = [], length = listeners.length; i < length; i++) {
          if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
            events.push(listeners[i]);
          }
        }
        if (events.length)
          this._events[evt] = events.length === 1 ? events[0] : events;
        else
          clearEvent(this, evt);
      }
      return this;
    };
    EventEmitter2.prototype.removeAllListeners = function removeAllListeners(event) {
      var evt;
      if (event) {
        evt = prefix ? prefix + event : event;
        if (this._events[evt])
          clearEvent(this, evt);
      } else {
        this._events = new Events();
        this._eventsCount = 0;
      }
      return this;
    };
    EventEmitter2.prototype.off = EventEmitter2.prototype.removeListener;
    EventEmitter2.prototype.addListener = EventEmitter2.prototype.on;
    EventEmitter2.prefixed = prefix;
    EventEmitter2.EventEmitter = EventEmitter2;
    if ("undefined" !== typeof module) {
      module.exports = EventEmitter2;
    }
  }
});

// node_modules/.pnpm/eventemitter3@5.0.1/node_modules/eventemitter3/index.mjs
var import_index = __toESM(require_eventemitter3(), 1);

// node_modules/.pnpm/p-timeout@6.1.2/node_modules/p-timeout/index.js
var TimeoutError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "TimeoutError";
  }
};
var AbortError = class extends Error {
  constructor(message) {
    super();
    this.name = "AbortError";
    this.message = message;
  }
};
var getDOMException = (errorMessage) => globalThis.DOMException === void 0 ? new AbortError(errorMessage) : new DOMException(errorMessage);
var getAbortedReason = (signal) => {
  const reason = signal.reason === void 0 ? getDOMException("This operation was aborted.") : signal.reason;
  return reason instanceof Error ? reason : getDOMException(reason);
};
function pTimeout(promise, options) {
  const {
    milliseconds,
    fallback,
    message,
    customTimers = { setTimeout, clearTimeout }
  } = options;
  let timer;
  const wrappedPromise = new Promise((resolve, reject) => {
    if (typeof milliseconds !== "number" || Math.sign(milliseconds) !== 1) {
      throw new TypeError(`Expected \`milliseconds\` to be a positive number, got \`${milliseconds}\``);
    }
    if (options.signal) {
      const { signal } = options;
      if (signal.aborted) {
        reject(getAbortedReason(signal));
      }
      signal.addEventListener("abort", () => {
        reject(getAbortedReason(signal));
      });
    }
    if (milliseconds === Number.POSITIVE_INFINITY) {
      promise.then(resolve, reject);
      return;
    }
    const timeoutError = new TimeoutError();
    timer = customTimers.setTimeout.call(void 0, () => {
      if (fallback) {
        try {
          resolve(fallback());
        } catch (error) {
          reject(error);
        }
        return;
      }
      if (typeof promise.cancel === "function") {
        promise.cancel();
      }
      if (message === false) {
        resolve();
      } else if (message instanceof Error) {
        reject(message);
      } else {
        timeoutError.message = message ?? `Promise timed out after ${milliseconds} milliseconds`;
        reject(timeoutError);
      }
    }, milliseconds);
    (async () => {
      try {
        resolve(await promise);
      } catch (error) {
        reject(error);
      }
    })();
  });
  const cancelablePromise = wrappedPromise.finally(() => {
    cancelablePromise.clear();
  });
  cancelablePromise.clear = () => {
    customTimers.clearTimeout.call(void 0, timer);
    timer = void 0;
  };
  return cancelablePromise;
}

// node_modules/.pnpm/p-queue@8.0.1/node_modules/p-queue/dist/lower-bound.js
function lowerBound(array, value, comparator) {
  let first = 0;
  let count = array.length;
  while (count > 0) {
    const step = Math.trunc(count / 2);
    let it = first + step;
    if (comparator(array[it], value) <= 0) {
      first = ++it;
      count -= step + 1;
    } else {
      count = step;
    }
  }
  return first;
}

// node_modules/.pnpm/p-queue@8.0.1/node_modules/p-queue/dist/priority-queue.js
var _queue;
var PriorityQueue = class {
  constructor() {
    __privateAdd(this, _queue, []);
  }
  enqueue(run, options) {
    options = {
      priority: 0,
      ...options
    };
    const element = {
      priority: options.priority,
      run
    };
    if (this.size && __privateGet(this, _queue)[this.size - 1].priority >= options.priority) {
      __privateGet(this, _queue).push(element);
      return;
    }
    const index = lowerBound(__privateGet(this, _queue), element, (a, b) => b.priority - a.priority);
    __privateGet(this, _queue).splice(index, 0, element);
  }
  dequeue() {
    const item = __privateGet(this, _queue).shift();
    return item?.run;
  }
  filter(options) {
    return __privateGet(this, _queue).filter((element) => element.priority === options.priority).map((element) => element.run);
  }
  get size() {
    return __privateGet(this, _queue).length;
  }
};
_queue = new WeakMap();

// node_modules/.pnpm/p-queue@8.0.1/node_modules/p-queue/dist/index.js
var _carryoverConcurrencyCount, _isIntervalIgnored, _intervalCount, _intervalCap, _interval, _intervalEnd, _intervalId, _timeoutId, _queue2, _queueClass, _pending, _concurrency, _isPaused, _throwOnTimeout, _doesIntervalAllowAnother, doesIntervalAllowAnother_get, _doesConcurrentAllowAnother, doesConcurrentAllowAnother_get, _next, next_fn, _onResumeInterval, onResumeInterval_fn, _isIntervalPaused, isIntervalPaused_get, _tryToStartAnother, tryToStartAnother_fn, _initializeIntervalIfNeeded, initializeIntervalIfNeeded_fn, _onInterval, onInterval_fn, _processQueue, processQueue_fn, _throwOnAbort, throwOnAbort_fn, _onEvent, onEvent_fn;
var PQueue = class extends import_index.default {
  // TODO: The `throwOnTimeout` option should affect the return types of `add()` and `addAll()`
  constructor(options) {
    super();
    __privateAdd(this, _doesIntervalAllowAnother);
    __privateAdd(this, _doesConcurrentAllowAnother);
    __privateAdd(this, _next);
    __privateAdd(this, _onResumeInterval);
    __privateAdd(this, _isIntervalPaused);
    __privateAdd(this, _tryToStartAnother);
    __privateAdd(this, _initializeIntervalIfNeeded);
    __privateAdd(this, _onInterval);
    /**
    Executes all queued functions until it reaches the limit.
    */
    __privateAdd(this, _processQueue);
    __privateAdd(this, _throwOnAbort);
    __privateAdd(this, _onEvent);
    __privateAdd(this, _carryoverConcurrencyCount, void 0);
    __privateAdd(this, _isIntervalIgnored, void 0);
    __privateAdd(this, _intervalCount, 0);
    __privateAdd(this, _intervalCap, void 0);
    __privateAdd(this, _interval, void 0);
    __privateAdd(this, _intervalEnd, 0);
    __privateAdd(this, _intervalId, void 0);
    __privateAdd(this, _timeoutId, void 0);
    __privateAdd(this, _queue2, void 0);
    __privateAdd(this, _queueClass, void 0);
    __privateAdd(this, _pending, 0);
    // The `!` is needed because of https://github.com/microsoft/TypeScript/issues/32194
    __privateAdd(this, _concurrency, void 0);
    __privateAdd(this, _isPaused, void 0);
    __privateAdd(this, _throwOnTimeout, void 0);
    /**
        Per-operation timeout in milliseconds. Operations fulfill once `timeout` elapses if they haven't already.
    
        Applies to each future operation.
        */
    __publicField(this, "timeout");
    options = {
      carryoverConcurrencyCount: false,
      intervalCap: Number.POSITIVE_INFINITY,
      interval: 0,
      concurrency: Number.POSITIVE_INFINITY,
      autoStart: true,
      queueClass: PriorityQueue,
      ...options
    };
    if (!(typeof options.intervalCap === "number" && options.intervalCap >= 1)) {
      throw new TypeError(`Expected \`intervalCap\` to be a number from 1 and up, got \`${options.intervalCap?.toString() ?? ""}\` (${typeof options.intervalCap})`);
    }
    if (options.interval === void 0 || !(Number.isFinite(options.interval) && options.interval >= 0)) {
      throw new TypeError(`Expected \`interval\` to be a finite number >= 0, got \`${options.interval?.toString() ?? ""}\` (${typeof options.interval})`);
    }
    __privateSet(this, _carryoverConcurrencyCount, options.carryoverConcurrencyCount);
    __privateSet(this, _isIntervalIgnored, options.intervalCap === Number.POSITIVE_INFINITY || options.interval === 0);
    __privateSet(this, _intervalCap, options.intervalCap);
    __privateSet(this, _interval, options.interval);
    __privateSet(this, _queue2, new options.queueClass());
    __privateSet(this, _queueClass, options.queueClass);
    this.concurrency = options.concurrency;
    this.timeout = options.timeout;
    __privateSet(this, _throwOnTimeout, options.throwOnTimeout === true);
    __privateSet(this, _isPaused, options.autoStart === false);
  }
  get concurrency() {
    return __privateGet(this, _concurrency);
  }
  set concurrency(newConcurrency) {
    if (!(typeof newConcurrency === "number" && newConcurrency >= 1)) {
      throw new TypeError(`Expected \`concurrency\` to be a number from 1 and up, got \`${newConcurrency}\` (${typeof newConcurrency})`);
    }
    __privateSet(this, _concurrency, newConcurrency);
    __privateMethod(this, _processQueue, processQueue_fn).call(this);
  }
  async add(function_, options = {}) {
    options = {
      timeout: this.timeout,
      throwOnTimeout: __privateGet(this, _throwOnTimeout),
      ...options
    };
    return new Promise((resolve, reject) => {
      __privateGet(this, _queue2).enqueue(async () => {
        __privateWrapper(this, _pending)._++;
        __privateWrapper(this, _intervalCount)._++;
        try {
          options.signal?.throwIfAborted();
          let operation = function_({ signal: options.signal });
          if (options.timeout) {
            operation = pTimeout(Promise.resolve(operation), { milliseconds: options.timeout });
          }
          if (options.signal) {
            operation = Promise.race([operation, __privateMethod(this, _throwOnAbort, throwOnAbort_fn).call(this, options.signal)]);
          }
          const result = await operation;
          resolve(result);
          this.emit("completed", result);
        } catch (error) {
          if (error instanceof TimeoutError && !options.throwOnTimeout) {
            resolve();
            return;
          }
          reject(error);
          this.emit("error", error);
        } finally {
          __privateMethod(this, _next, next_fn).call(this);
        }
      }, options);
      this.emit("add");
      __privateMethod(this, _tryToStartAnother, tryToStartAnother_fn).call(this);
    });
  }
  async addAll(functions, options) {
    return Promise.all(functions.map(async (function_) => this.add(function_, options)));
  }
  /**
  Start (or resume) executing enqueued tasks within concurrency limit. No need to call this if queue is not paused (via `options.autoStart = false` or by `.pause()` method.)
  */
  start() {
    if (!__privateGet(this, _isPaused)) {
      return this;
    }
    __privateSet(this, _isPaused, false);
    __privateMethod(this, _processQueue, processQueue_fn).call(this);
    return this;
  }
  /**
  Put queue execution on hold.
  */
  pause() {
    __privateSet(this, _isPaused, true);
  }
  /**
  Clear the queue.
  */
  clear() {
    __privateSet(this, _queue2, new (__privateGet(this, _queueClass))());
  }
  /**
      Can be called multiple times. Useful if you for example add additional items at a later time.
  
      @returns A promise that settles when the queue becomes empty.
      */
  async onEmpty() {
    if (__privateGet(this, _queue2).size === 0) {
      return;
    }
    await __privateMethod(this, _onEvent, onEvent_fn).call(this, "empty");
  }
  /**
      @returns A promise that settles when the queue size is less than the given limit: `queue.size < limit`.
  
      If you want to avoid having the queue grow beyond a certain size you can `await queue.onSizeLessThan()` before adding a new item.
  
      Note that this only limits the number of items waiting to start. There could still be up to `concurrency` jobs already running that this call does not include in its calculation.
      */
  async onSizeLessThan(limit) {
    if (__privateGet(this, _queue2).size < limit) {
      return;
    }
    await __privateMethod(this, _onEvent, onEvent_fn).call(this, "next", () => __privateGet(this, _queue2).size < limit);
  }
  /**
      The difference with `.onEmpty` is that `.onIdle` guarantees that all work from the queue has finished. `.onEmpty` merely signals that the queue is empty, but it could mean that some promises haven't completed yet.
  
      @returns A promise that settles when the queue becomes empty, and all promises have completed; `queue.size === 0 && queue.pending === 0`.
      */
  async onIdle() {
    if (__privateGet(this, _pending) === 0 && __privateGet(this, _queue2).size === 0) {
      return;
    }
    await __privateMethod(this, _onEvent, onEvent_fn).call(this, "idle");
  }
  /**
  Size of the queue, the number of queued items waiting to run.
  */
  get size() {
    return __privateGet(this, _queue2).size;
  }
  /**
      Size of the queue, filtered by the given options.
  
      For example, this can be used to find the number of items remaining in the queue with a specific priority level.
      */
  sizeBy(options) {
    return __privateGet(this, _queue2).filter(options).length;
  }
  /**
  Number of running items (no longer in the queue).
  */
  get pending() {
    return __privateGet(this, _pending);
  }
  /**
  Whether the queue is currently paused.
  */
  get isPaused() {
    return __privateGet(this, _isPaused);
  }
};
_carryoverConcurrencyCount = new WeakMap();
_isIntervalIgnored = new WeakMap();
_intervalCount = new WeakMap();
_intervalCap = new WeakMap();
_interval = new WeakMap();
_intervalEnd = new WeakMap();
_intervalId = new WeakMap();
_timeoutId = new WeakMap();
_queue2 = new WeakMap();
_queueClass = new WeakMap();
_pending = new WeakMap();
_concurrency = new WeakMap();
_isPaused = new WeakMap();
_throwOnTimeout = new WeakMap();
_doesIntervalAllowAnother = new WeakSet();
doesIntervalAllowAnother_get = function() {
  return __privateGet(this, _isIntervalIgnored) || __privateGet(this, _intervalCount) < __privateGet(this, _intervalCap);
};
_doesConcurrentAllowAnother = new WeakSet();
doesConcurrentAllowAnother_get = function() {
  return __privateGet(this, _pending) < __privateGet(this, _concurrency);
};
_next = new WeakSet();
next_fn = function() {
  __privateWrapper(this, _pending)._--;
  __privateMethod(this, _tryToStartAnother, tryToStartAnother_fn).call(this);
  this.emit("next");
};
_onResumeInterval = new WeakSet();
onResumeInterval_fn = function() {
  __privateMethod(this, _onInterval, onInterval_fn).call(this);
  __privateMethod(this, _initializeIntervalIfNeeded, initializeIntervalIfNeeded_fn).call(this);
  __privateSet(this, _timeoutId, void 0);
};
_isIntervalPaused = new WeakSet();
isIntervalPaused_get = function() {
  const now = Date.now();
  if (__privateGet(this, _intervalId) === void 0) {
    const delay = __privateGet(this, _intervalEnd) - now;
    if (delay < 0) {
      __privateSet(this, _intervalCount, __privateGet(this, _carryoverConcurrencyCount) ? __privateGet(this, _pending) : 0);
    } else {
      if (__privateGet(this, _timeoutId) === void 0) {
        __privateSet(this, _timeoutId, setTimeout(() => {
          __privateMethod(this, _onResumeInterval, onResumeInterval_fn).call(this);
        }, delay));
      }
      return true;
    }
  }
  return false;
};
_tryToStartAnother = new WeakSet();
tryToStartAnother_fn = function() {
  if (__privateGet(this, _queue2).size === 0) {
    if (__privateGet(this, _intervalId)) {
      clearInterval(__privateGet(this, _intervalId));
    }
    __privateSet(this, _intervalId, void 0);
    this.emit("empty");
    if (__privateGet(this, _pending) === 0) {
      this.emit("idle");
    }
    return false;
  }
  if (!__privateGet(this, _isPaused)) {
    const canInitializeInterval = !__privateGet(this, _isIntervalPaused, isIntervalPaused_get);
    if (__privateGet(this, _doesIntervalAllowAnother, doesIntervalAllowAnother_get) && __privateGet(this, _doesConcurrentAllowAnother, doesConcurrentAllowAnother_get)) {
      const job = __privateGet(this, _queue2).dequeue();
      if (!job) {
        return false;
      }
      this.emit("active");
      job();
      if (canInitializeInterval) {
        __privateMethod(this, _initializeIntervalIfNeeded, initializeIntervalIfNeeded_fn).call(this);
      }
      return true;
    }
  }
  return false;
};
_initializeIntervalIfNeeded = new WeakSet();
initializeIntervalIfNeeded_fn = function() {
  if (__privateGet(this, _isIntervalIgnored) || __privateGet(this, _intervalId) !== void 0) {
    return;
  }
  __privateSet(this, _intervalId, setInterval(() => {
    __privateMethod(this, _onInterval, onInterval_fn).call(this);
  }, __privateGet(this, _interval)));
  __privateSet(this, _intervalEnd, Date.now() + __privateGet(this, _interval));
};
_onInterval = new WeakSet();
onInterval_fn = function() {
  if (__privateGet(this, _intervalCount) === 0 && __privateGet(this, _pending) === 0 && __privateGet(this, _intervalId)) {
    clearInterval(__privateGet(this, _intervalId));
    __privateSet(this, _intervalId, void 0);
  }
  __privateSet(this, _intervalCount, __privateGet(this, _carryoverConcurrencyCount) ? __privateGet(this, _pending) : 0);
  __privateMethod(this, _processQueue, processQueue_fn).call(this);
};
_processQueue = new WeakSet();
processQueue_fn = function() {
  while (__privateMethod(this, _tryToStartAnother, tryToStartAnother_fn).call(this)) {
  }
};
_throwOnAbort = new WeakSet();
throwOnAbort_fn = async function(signal) {
  return new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => {
      reject(signal.reason);
    }, { once: true });
  });
};
_onEvent = new WeakSet();
onEvent_fn = async function(event, filter) {
  return new Promise((resolve) => {
    const listener = () => {
      if (filter && !filter()) {
        return;
      }
      this.off(event, listener);
      resolve();
    };
    this.on(event, listener);
  });
};

// public/iterator plugin info.png
var iterator_plugin_info_default = "./iterator plugin info-LVNK74FJ.png";

// src/nodes/IteratorPluginNode.ts
function iteratorPluginNode(rivet) {
  const IteratorPluginNodeImpl = {
    // This should create a new instance of your node type from scratch.
    create() {
      const id = rivet.newId();
      const node = {
        // Use rivet.newId to generate new IDs for your nodes.
        id,
        // This is the default data that your node will store
        data: {
          results: [],
          chunkSize: 1,
          useChunkSizeToggle: false
        },
        // This is the default title of your node.
        title: "Iterator Plugin Node",
        // This must match the type of your node.
        type: "iteratorPlugin",
        // X and Y should be set to 0. Width should be set to a reasonable number so there is no overflow.
        visualData: {
          x: 0,
          y: 0,
          width: 200
        }
      };
      return node;
    },
    // This function should return all input ports for your node, given its data, connections, all other nodes, and the project. The
    // connection, nodes, and project are for advanced use-cases and can usually be ignored.
    getInputDefinitions(data, _connections, _nodes, _project) {
      const inputs = [];
      inputs.push({
        id: "graph",
        dataType: "graph-reference",
        title: "Graph",
        description: "The reference to the graph to call.",
        required: true
      });
      inputs.push({
        id: "inputArray",
        dataType: "object[]",
        title: "Input Array",
        description: "The array to iterate over.",
        required: true
      });
      if (data.useChunkSizeToggle) {
        inputs.push({
          id: "chunkSize",
          dataType: "number",
          title: "Chunk Size",
          description: "The concurrency limit: The number of items to process at the same time.",
          data: data.chunkSize
        });
      }
      return inputs;
    },
    // This function should return all output ports for your node, given its data, connections, all other nodes, and the project. The
    // connection, nodes, and project are for advanced use-cases and can usually be ignored.
    getOutputDefinitions(data, _connections, _nodes, _project) {
      return [
        {
          id: "results",
          dataType: "object[]",
          title: "Iterator Results"
        }
      ];
    },
    // This returns UI information for your node, such as how it appears in the context menu.
    getUIData() {
      return {
        contextMenuTitle: "Iterator Plugin",
        group: "Logic",
        infoBoxBody: "This is an iterator plugin node.  This node will map over an array and process each item with the graph provided.",
        infoBoxTitle: "Iterator Plugin Node",
        infoBoxImageUri: iterator_plugin_info_default
      };
    },
    // This function defines all editors that appear when you edit your node.
    getEditors(_data) {
      return [
        {
          type: "number",
          dataKey: "chunkSize",
          label: "Chunk size",
          defaultValue: 1,
          helperMessage: "The number of items to process at the same time.  This will help process arrays quickly while not overloading the system.  Recommended to keep this below 10 for subgraphs that make network calls or stream model responses.",
          useInputToggleDataKey: "useChunkSizeToggle"
        }
      ];
    },
    // This function returns the body of the node when it is rendered on the graph. You should show
    // what the current data of the node is in some way that is useful at a glance.
    getBody(data) {
      return rivet.dedent`
        Iterator Plugin Node
        Results: ${data.results}
      `;
    },
    // This is the main processing function for your node. It can do whatever you like, but it must return
    // a valid Outputs object, which is a map of port IDs to DataValue objects. The return value of this function
    // must also correspond to the output definitions you defined in the getOutputDefinitions function.
    async process(data, inputData, context) {
      const outputs = {};
      const graphRef = rivet.coerceType(
        inputData["graph"],
        "graph-reference"
      );
      const inputArray = rivet.coerceType(
        inputData["inputArray"],
        "object[]"
      );
      let chunkSize = rivet.coerceTypeOptional(inputData["chunkSize"], "number") ?? data.chunkSize;
      chunkSize = chunkSize > 0 ? chunkSize : 1;
      console.log("iterator", chunkSize, inputArray, graphRef, inputData);
      const allItemsAreObjects = inputArray.some((s) => typeof s != "object");
      if (allItemsAreObjects) {
        outputs["results"] = {
          type: "control-flow-excluded",
          value: void 0
        };
        outputs["error"] = {
          type: "string",
          value: "Input array must be an array of objects.  A graph needs an object with keys that match the graph's input ports"
        };
        return outputs;
      }
      const graph = context.project.graphs[graphRef.graphId];
      const graphInputNodes = graph.nodes.filter((f) => f.type == "graphInput");
      console.log("iterator", graphInputNodes, graph.connections);
      const missingKeys = /* @__PURE__ */ new Set();
      const invalidInputs = inputArray.some((i) => {
        const providedKeys = Object.keys(i);
        const expectedKeys = graphInputNodes.map((m) => {
          const id = m.data["id"];
          return id ?? null;
        }).filter((f) => f != null);
        if (expectedKeys.some((s) => !providedKeys.includes(s))) {
          expectedKeys.filter((key) => !providedKeys.includes(key)).forEach((key) => missingKeys.add(key));
          return true;
        }
      });
      if (invalidInputs) {
        outputs["results"] = {
          type: "control-flow-excluded",
          value: void 0
        };
        outputs["error"] = {
          type: "string",
          value: "The input array must have objects with keys that match the graph's input ports.  Graph input ports: " + Array.from(missingKeys).map((key) => `'${key}'`).join(", ")
        };
        return outputs;
      }
      let abort = false;
      const queue = new PQueue({ concurrency: chunkSize });
      const addToQueue = inputArray.map((item, index) => {
        return queue.add(async () => {
          let itemOutput = {};
          try {
            if (!abort) {
              const node = rivet.callGraphNode.impl.create();
              const impl = rivet.globalRivetNodeRegistry.createDynamicImpl(node);
              const itemDataValue = {
                type: "object",
                value: item
              };
              const iteratorInputData = {
                ["graph"]: inputData["graph"],
                ["inputs"]: itemDataValue
              };
              console.log("iterator", iteratorInputData, itemDataValue);
              itemOutput = await impl.process(iteratorInputData, context);
            } else {
              itemOutput["outputs"] = {
                type: "control-flow-excluded",
                value: void 0
              };
            }
          } catch (err) {
            itemOutput["outputs"] = {
              type: "control-flow-excluded",
              value: void 0
            };
            itemOutput["error"] = {
              type: "string",
              value: `Error running graph ${graphRef.graphName}.  ItemIndex: ${index}.  Inputs: ${item}  ${rivet.getError(err).message}`
            };
            abort = true;
          }
          return itemOutput;
        });
      });
      const results = await Promise.all(addToQueue);
      await queue.onIdle();
      const errorInResults = results.some((f) => f["outputs"]?.type == "control-flow-excluded");
      if (errorInResults) {
        outputs["results"] = {
          type: "control-flow-excluded",
          value: void 0
        };
        outputs["error"] = {
          type: "string",
          value: "Error processing items."
        };
        outputs["outputs"] = {
          type: "object[]",
          value: results
        };
        return outputs;
      }
      outputs["results"] = {
        type: "object[]",
        value: results
      };
      return outputs;
    }
  };
  const iteratorPluginNode2 = rivet.pluginNodeDefinition(
    IteratorPluginNodeImpl,
    "Iterator Plugin Node"
  );
  return iteratorPluginNode2;
}

// src/index.ts
var plugin = (rivet) => {
  const utilitiesNode = iteratorPluginNode(rivet);
  const utilitiesPlugin = {
    // The ID of your plugin should be unique across all plugins.
    id: "utilities-plugin",
    // The name of the plugin is what is displayed in the Rivet UI.
    name: "Utilities Plugin",
    // Define all configuration settings in the configSpec object.
    configSpec: {
      utilitiesSetting: {
        type: "string",
        label: "Utilities Setting",
        description: "This is an utilities setting for the utilities plugin.",
        helperText: "This is an utilities setting for the utilities plugin."
      }
    },
    // Define any additional context menu groups your plugin adds here.
    contextMenuGroups: [
      {
        id: "utilities",
        label: "Utilities"
      }
    ],
    // Register any additional nodes your plugin adds here. This is passed a `register`
    // function, which you can use to register your nodes.
    register: (register) => {
      register(utilitiesNode);
    }
  };
  return utilitiesPlugin;
};
var src_default = plugin;
export {
  src_default as default
};
//# sourceMappingURL=bundle.js.map
