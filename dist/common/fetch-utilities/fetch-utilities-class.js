"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
class FetchUtilities {
    constructor() {
        this.authUrl = process.env.AUTH_URL || 'https://auth.adis.ws';
        this.apiUrl = process.env.API_URL || 'https://api.amplience.net/v2/content';
        this.PAGE_SIZE = 20;
    }
    async init(argv) {
        this.accessToken = await this.getAccessToken(argv.clientId, argv.clientSecret);
    }
    async getAccessToken(clientId, clientSecret) {
        const authUrlFinal = `${this.authUrl}/oauth/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
        const response = await node_fetch_1.default(authUrlFinal, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const authorization = await response.json();
        return authorization.access_token;
    }
    async fetchResource(endpointUri) {
        let resource = {};
        if (this.accessToken) {
            const response = await node_fetch_1.default(`${this.apiUrl}${endpointUri}`, {
                method: 'GET',
                headers: { Authorization: 'Bearer ' + this.accessToken }
            });
            if (response.ok) {
                resource = await response.json();
            }
        }
        return resource;
    }
    async fetchPaginatedResourcesList(endpointUri, resourceName) {
        let resourcesList = [];
        if (this.accessToken) {
            const response = await node_fetch_1.default(`${this.apiUrl}${endpointUri}?size=${this.PAGE_SIZE}`, {
                method: 'GET',
                headers: { Authorization: 'Bearer ' + this.accessToken }
            });
            const resources = await response.json();
            if (resources._embedded && resources._embedded[resourceName]) {
                const resourceFinal = resources._embedded[resourceName];
                resourcesList = resourceFinal;
            }
            if (resources.page) {
                const totalPages = resources.page.totalPages;
                let pageNumber = 0;
                while (pageNumber < totalPages - 1) {
                    pageNumber++;
                    const resourcesUrl = `${this.apiUrl}${endpointUri}?size=${this.PAGE_SIZE}&page=${pageNumber}`;
                    const response = await node_fetch_1.default(resourcesUrl, {
                        method: 'GET',
                        headers: { Authorization: 'Bearer ' + this.accessToken }
                    });
                    const resources = await response.json();
                    if (resources._embedded && resources._embedded[resourceName]) {
                        const resourceFinal = resources._embedded[resourceName];
                        resourcesList = [...resourcesList, ...resourceFinal];
                    }
                }
            }
        }
        return resourcesList;
    }
    async fetchPaginatedResourcesListWithDetails(endpointUri, resourceName) {
        const resourcesList = await this.fetchPaginatedResourcesList(endpointUri, resourceName);
        const resourcesListDetails = await Promise.all(resourcesList.map((item) => node_fetch_1.default(`${this.apiUrl}${endpointUri}/${item.id}`, {
            method: 'GET',
            headers: { Authorization: 'Bearer ' + this.accessToken }
        })
            .then(r => r.json())
            .catch(error => ({ error }))));
        return resourcesListDetails;
    }
    async deleteResource(endpointUri, resourceId) {
        let finalResourceId = '';
        if (this.accessToken) {
            const response = await node_fetch_1.default(`${this.apiUrl}${endpointUri}`, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + this.accessToken }
            });
            if (response.ok) {
                finalResourceId = resourceId;
            }
        }
        return resourceId;
    }
    async createResource(endpointUri, data) {
        let resource = {};
        let resourceId = '';
        if (this.accessToken) {
            const response = await node_fetch_1.default(`${this.apiUrl}${endpointUri}`, {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + this.accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                resource = await response.json();
                resourceId = resource.id;
            }
        }
        return resourceId;
    }
    async updateResource(endpointUri, resourceId, data) {
        let updatedResourceId = '';
        if (this.accessToken) {
            const response = await node_fetch_1.default(`${this.apiUrl}${endpointUri}`, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer ' + this.accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                updatedResourceId = resourceId;
            }
        }
        return resourceId;
    }
}
exports.FetchUtilities = FetchUtilities;
