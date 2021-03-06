"use strict";

import {ServiceWrapper, HOOKS} from "./service-wrapper";

export default class ClientHandler {

    constructor(...conf) {
        this._client = ServiceWrapper.client;

        if (!this._client || typeof this._client !== "function")
            throw new Error("HTTP client must be a function")

        this._reqConfig = conf;

        this._customHooks = {};

        this._resolveValidation = null;
    }

    get id() {
        return this._id;
    }

    addToQueue(customID) {
        // add service to queue and get the unique id
        this._id = ServiceWrapper.addToQueue(customID);
    }

    cancel() {
        if (!this._fireOptions || this._fireOptions.parallel)
            return false;

        // remove service from queue
        return ServiceWrapper.removeServiceFromQueue(this._id);
    }

    setClient(client) {
        if (!client || typeof client !== "function")
            throw new Error("Invalid client passed. Client must be a function")

        this._client = client;
        return this
    }

    setHook(hookName, fn) {
        if (hookName && typeof fn === "function")
            this._customHooks[hookName] = fn;

        return this;
    }

    execHook(hookName, ...args) {
        if (this._customHooks[hookName]
            && typeof this._customHooks[hookName] === "function") {
            return this._customHooks[hookName].apply(this, args)
        }

        return ServiceWrapper.execHook(hookName, ...args)
    }

    resolveValidation(result) {
        if (this._resolveValidation
            && typeof this._resolveValidation === "function") {
            return this._resolveValidation(result)
        }

        return ServiceWrapper.resolveValidation(result);
    }

    setResolveValidation(fn) {
        this._resolveValidation = fn;

        return this
    }

    /**
     * Fire the client service and fetch response
     *
     * @param options - fire options
     * @returns {Promise<>}
     */
    fire(options = {}) {
        this._fireOptions = options;

        // check the existence of the fire options
        if (!this._fireOptions || typeof this._fireOptions !== 'object')
            this._fireOptions = {parallel: ServiceWrapper.defaultParallelStatus};

        // add service to queue
        // this is important because this assigns id too
        this.addToQueue(this._fireOptions.id);

        // we get the config by rest from arguments and it has array type
        // so, we need to convert it to array after updating
        this._reqConfig = [this.execHook(HOOKS.UPDATE_SERVICE_CONFIG, ...this._reqConfig)];

        return new Promise(async (resolve, reject) => {
            try {

                // check idle status of service handler
                // if isParallel is true, the service will not wait for the queue
                await ServiceWrapper.checkQueueStatus(this._id, this._fireOptions.parallel);

                this.execHook(HOOKS.BEFORE_FIRE, this._fireOptions);

                // call Http client function and fire the service
                const callRes = await this._client(...this._reqConfig);

                // check the status of service and ErrorCode existence
                if (this.resolveValidation(callRes)) {

                    this.execHook(HOOKS.AFTER_SUCCESS, callRes, this._fireOptions)

                    // resolve the main result
                    resolve(this.execHook(HOOKS.BEFORE_RESOLVE, callRes, this._fireOptions));

                } else {

                    this.execHook(HOOKS.AFTER_FAIL, callRes, this._fireOptions)

                    reject(this.execHook(HOOKS.BEFORE_REJECT, callRes, this._fireOptions));
                }

            } catch (e) { // this scope will call when status is not 200

                this.execHook(HOOKS.AFTER_FAIL, e, this._fireOptions)

                reject(this.execHook(HOOKS.BEFORE_REJECT, e, this._fireOptions));

            } finally {

                // update service status in services queue
                ServiceWrapper.removeServiceFromQueue(this._id);
            }
        })
    }
}
