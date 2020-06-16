"use strict";

// list of request URLs that can fetch in parallel by other requests
import RequestQueue from "./request-queue";

export const HOOKS = {
    BEFORE_RESOLVE: "before.resolve",
    BEFORE_REJECT: "before.reject",
    BEFORE_FIRE: "before.fire",
    AFTER_SUCCESS: "after.success",
    AFTER_FAIL: "after.fail",
    UPDATE_REQUEST_CONFIG: "update.request-config",
}

const ServiceWrapperObject = {
    HOOKS,
    _hooks: {},
    client: null,
    queue: null,
    _resolveValidation: null,
    defaultParallelStatus: true,
    setClient(client) {
        this.client = client;
    },
    addToQueue(customID) {
        if (!this.queue)
            return;

        return this.queue.add(customID);
    },
    checkQueueStatus(...args) {
        if (!this.queue)
            return;

        return this.queue.checkIdleStatus(...args);
    },
    removeQueueRequest(reqID) {
        if (!this.queue)
            return;

        return this.queue.removeRequest(reqID);
    },
    setHook(hookName, fn) {
        this._hooks[hookName] = fn;

        return this;
    },
    execHook(hookName, ...args) {
        if (!this._hooks[hookName])
            return;

        return this._hooks[hookName].apply(null, args)
    },
    resolveValidation(result) {
        if (this._resolveValidation && typeof this._resolveValidation === "function") {
            return this._resolveValidation(result)
        }

        return false;
    },
    setResolveValidation(fn) {
        this._resolveValidation = fn;

        return this;
    },
    init(options = {}) {
        if (!options || options.toString() !== "[object Object]") {
            throw new Error("Invalid options passed.")
        }

        if (options.client)
            this.setClient(options.client)

        if (options.queue) {
            this.queue = RequestQueue.getInstance()
            this.queue.debugMode = !!options.queueLogs
        } else {
            this.queue = null;
        }

        if (options.defaultParallelStatus !== void 0)
            this.defaultParallelStatus = Boolean(options.defaultParallelStatus);

        return this
    }
}

export const ServiceWrapper = {__proto__: ServiceWrapperObject};

(function initRequestHandler() {
    ServiceWrapper.setResolveValidation(res => true);
    ServiceWrapper.setHook(HOOKS.BEFORE_RESOLVE, data => data);
    ServiceWrapper.setHook(HOOKS.BEFORE_REJECT, data => data);
    ServiceWrapper.setHook(HOOKS.UPDATE_REQUEST_CONFIG, data => data);
})();