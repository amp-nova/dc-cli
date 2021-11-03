"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const node_fetch_1 = __importDefault(require("node-fetch"));
async function delay(duration) {
    return new Promise((resolve) => {
        setTimeout(resolve, duration);
    });
}
class PublishQueue {
    constructor(credentials) {
        this.maxAttempts = 30;
        this.attemptDelay = 1000;
        this.failedJobs = [];
        this.inProgressJobs = [];
        this.waitingList = [];
        this.waitInProgress = false;
        const http = new dc_management_sdk_js_1.AxiosHttpClient({});
        this.auth = new dc_management_sdk_js_1.OAuth2Client({ client_id: credentials.clientId, client_secret: credentials.clientSecret }, { authUrl: process.env.AUTH_URL }, http);
    }
    async getToken() {
        const token = await this.auth.getToken();
        return token.access_token;
    }
    async fetch(href, method) {
        return await node_fetch_1.default(href, { method: method, headers: { Authorization: 'bearer ' + (await this.getToken()) } });
    }
    async publish(item) {
        await this.rateLimit();
        const publishLink = item._links['publish'];
        if (publishLink == null) {
            throw new Error('Cannot publish the item - link not available.');
        }
        const publish = await this.fetch(publishLink.href, 'POST');
        if (publish.status != 204) {
            throw new Error(`Failed to start publish: ${publish.statusText} - ${await publish.text()}`);
        }
        const publishJobInfoHref = publish.headers.get('Location');
        if (publishJobInfoHref == null) {
            throw new Error('Expected publish job location in header. Has the publish workflow changed?');
        }
        this.inProgressJobs.push({ href: publishJobInfoHref, item });
    }
    async waitForOldestPublish() {
        if (this.inProgressJobs.length === 0) {
            return;
        }
        this.waitInProgress = true;
        const oldestJob = this.inProgressJobs[0];
        this.inProgressJobs.splice(0, 1);
        let attempts = 0;
        for (; attempts < this.maxAttempts; attempts++) {
            let job;
            try {
                job = await (await this.fetch(oldestJob.href, 'GET')).json();
            }
            catch (e) {
                continue;
            }
            if (job.state === 'COMPLETED') {
                break;
            }
            else if (job.state === 'FAILED') {
                this.failedJobs.push(oldestJob);
                break;
            }
            else {
                await delay(this.attemptDelay);
            }
        }
        if (attempts == this.maxAttempts) {
            this.failedJobs.push(oldestJob);
        }
        const oldestWaiter = this.waitingList[0];
        if (oldestWaiter != null) {
            this.waitingList.splice(0, 1);
            oldestWaiter.resolver();
        }
        if (this.waitingList.length > 0 || this.awaitingAll) {
            await this.waitForOldestPublish();
        }
        else {
            this.waitInProgress = false;
        }
    }
    async rateLimit() {
        if (this.inProgressJobs.length == 0) {
            return;
        }
        let resolver = () => { };
        const myPromise = new Promise((resolve) => {
            resolver = resolve;
        });
        this.waitingList.push({ promise: myPromise, resolver: resolver });
        if (!this.waitInProgress) {
            this.waitForOldestPublish();
        }
        await myPromise;
    }
    async waitForAll() {
        if (this.waitInProgress) {
            await this.waitingList[this.waitingList.length - 1].promise;
        }
        this.awaitingAll = true;
        await this.waitForOldestPublish();
    }
}
exports.PublishQueue = PublishQueue;
