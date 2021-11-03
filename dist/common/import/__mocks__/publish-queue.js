"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishCalls = [];
class PublishQueue {
    constructor() {
        this.maxWaiting = 3;
        this.attemptDelay = 1000;
        this.failedJobs = [];
        this.waitInProgress = false;
    }
    async publish(item) {
        exports.publishCalls.push(item);
        return;
    }
    async waitForAll() {
        return;
    }
}
exports.PublishQueue = PublishQueue;
