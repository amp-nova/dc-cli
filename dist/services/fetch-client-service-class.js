"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_utilities_class_1 = require("../common/fetch-utilities/fetch-utilities-class");
class FetchClientService {
    constructor() {
        this.client = new fetch_utilities_class_1.FetchUtilities();
    }
    async init(argv) {
        this.hubId = argv.hubId;
        await this.client.init(argv);
    }
    async getContentItemByKey(deliveryKey) {
        const contentItem = await this.client.fetchResource(`/hubs/${this.hubId}/delivery-keys/content-item?key=${deliveryKey}`);
        return contentItem;
    }
    async getExtension(extensionId) {
        const extension = await this.client.fetchResource(`/extensions/${extensionId}`);
        return extension;
    }
    async getExtensionsList() {
        const extensionsList = await this.client.fetchPaginatedResourcesList(`/hubs/${this.hubId}/extensions`, 'extensions');
        return extensionsList;
    }
    async deleteExtension(extensionId) {
        const deletedExtensionId = await this.client.deleteResource(`/extensions/${extensionId}`, extensionId);
        return deletedExtensionId;
    }
    async createExtension(data) {
        const extensionId = await this.client.createResource(`/hubs/${this.hubId}/extensions`, data);
        return extensionId;
    }
    async updateExtension(extensionId, data) {
        const updatedExtensionId = await this.client.updateResource(`/extensions/${extensionId}`, extensionId, data);
        return updatedExtensionId;
    }
    async updateWebhook(webhookId, data) {
        const updatedWebhookId = await this.client.updateResource(`/hubs/${this.hubId}/webhooks/${webhookId}`, webhookId, data);
        return updatedWebhookId;
    }
    async getIndexesList() {
        const indexesList = await this.client.fetchPaginatedResourcesList(`/algolia-search/${this.hubId}/indexes`, 'indexes');
        return indexesList;
    }
    async getIdexesDetailsList() {
        const indexesListDetails = await this.client.fetchPaginatedResourcesListWithDetails(`/algolia-search/${this.hubId}/indexes`, 'indexes');
        return indexesListDetails;
    }
    async getIndex(indexId) {
        const index = await this.client.fetchResource(`/algolia-search/${this.hubId}/indexes/${indexId}`);
        if (index.id) {
            const settings = await this.getIndexSettings(indexId);
            const assignedContentTypes = await this.client.fetchPaginatedResourcesList(`/algolia-search/${this.hubId}/indexes/${indexId}/assigned-content-types`, 'assigned-content-types');
            index.settings = settings;
            if (assignedContentTypes.length > 0) {
                index.assignedContentTypes = assignedContentTypes;
            }
        }
        return index;
    }
    async getSearchApiKey(indexId, keyId) {
        const key = await this.client.fetchResource(`/algolia-search/${this.hubId}/indexes/${indexId}/keys/${keyId}`);
        return key;
    }
    async getIndexAssignedContentTypes(indexId) {
        const assignedContentTypes = this.client.fetchPaginatedResourcesList(`/algolia-search/${this.hubId}/indexes/${indexId}/assigned-content-types`, 'assigned-content-types');
        return assignedContentTypes;
    }
    async createIndex(data) {
        const indexId = await this.client.createResource(`/algolia-search/${this.hubId}/indexes`, data);
        return indexId;
    }
    async deleteIndex(indexId) {
        const deletedIndexId = await this.client.deleteResource(`/algolia-search/${this.hubId}/indexes/${indexId}`, indexId);
        return deletedIndexId;
    }
    async getIndexSettings(indexId) {
        const settings = await this.client.fetchResource(`/algolia-search/${this.hubId}/indexes/${indexId}/settings`);
        return settings;
    }
    async deleteIndexAndReplicas(indexId) {
        const indexSettings = await this.client.fetchResource(`/algolia-search/${this.hubId}/indexes/${indexId}/settings`);
        let deletedReplicasIndexIds = [];
        if (indexSettings.replicas) {
            const replicasNames = indexSettings.replicas;
            const replicasList = await Promise.all(replicasNames.map((item) => this.getIndexByName(item)));
            deletedReplicasIndexIds = await Promise.all(replicasList.map((item) => this.deleteIndex(item.id)));
        }
        const deletedIndexId = await this.deleteIndex(indexId);
        return [deletedIndexId, ...deletedReplicasIndexIds];
    }
    async updateIndexSettings(indexId, data) {
        const updatedIndexId = await this.client.updateResource(`/algolia-search/${this.hubId}/indexes/${indexId}/settings`, indexId, data);
        return updatedIndexId;
    }
    async getIndexByName(indexName) {
        const indexesList = await this.getIndexesList();
        const index = indexesList.filter((item) => item.name === indexName);
        if (index.length > 0) {
            console.log(`...Found index: ${index[0].id}`);
            return index[0];
        }
        else {
            console.log(`...No index found for name ${indexName}`);
            return null;
        }
    }
    async getExtensionByName(extensionName) {
        const extensionsList = await this.getExtensionsList();
        const extension = extensionsList.filter((item) => item.name === extensionName);
        if (extension.length > 0) {
            console.log(`...Found extension: ${extension[0].id}`);
            return extension[0];
        }
        else {
            console.log(`...No extension found for name ${extensionName}`);
            return null;
        }
    }
}
exports.FetchClientService = FetchClientService;
