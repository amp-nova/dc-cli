import { Arguments } from 'yargs';
import { ConfigurationParameters } from '../commands/configure';
import { FetchUtilities } from '../common/fetch-utilities/fetch-utilities-class';

/**
 * Index entry for indexes export containing index details, settigns and assigned content types
 */
export interface IndexEntry {
  id: string;
  indexDetails: any;
  settings: any;
  replicasSettings?: any;
  activeContentWebhook: any;
  archivedContentWebhook: any;
}

/**
 * Service to manipulate Amplience resources using general fetch utilities to get,
 * list, import, export extensions and indexes/replicas
 */
export class FetchClientService {
  client: FetchUtilities;
  hubId: string;

  constructor() {
    this.client = new FetchUtilities();
  }

  // Initialise FetchUtilities (retrieve and set access token)
  async init(argv: Arguments<ConfigurationParameters>) {
    this.hubId = argv.hubId;
    await this.client.init(argv);
  }

  /**
   * Get an extension
   * @param extensionId ID of extension to retrieve
   */
  async getContentItemByKey(deliveryKey: any): Promise<any> {
    const contentItem = await this.client.fetchResource(
      `/hubs/${this.hubId}/delivery-keys/content-item?key=${deliveryKey}`
    );
    return contentItem;
  }

  /**
   * Get an extension
   * @param extensionId ID of extension to retrieve
   */
  async getExtension(extensionId: any): Promise<any> {
    const extension = await this.client.fetchResource(`/extensions/${extensionId}`);
    return extension;
  }

  /**
   * Fetch list of all extensions
   */
  async getExtensionsList(): Promise<any> {
    const extensionsList = await this.client.fetchPaginatedResourcesList(
      `/hubs/${this.hubId}/extensions`,
      'extensions'
    );
    return extensionsList;
  }

  /**
   * Delete an extension
   * @param extensionId ID of extension to delete
   */
  async deleteExtension(extensionId: any): Promise<any> {
    const deletedExtensionId = await this.client.deleteResource(`/extensions/${extensionId}`, extensionId);
    return deletedExtensionId;
  }

  /**
   * Create an extension
   * @param data Extension data
   */
  async createExtension(data: any): Promise<any> {
    const extensionId = await this.client.createResource(`/hubs/${this.hubId}/extensions`, data);
    return extensionId;
  }

  /**
   * Update an existing extension
   * @param extensionId ID of the extension to update
   * @param data Extension data
   */
  async updateExtension(extensionId: string, data: any): Promise<string> {
    const updatedExtensionId = await this.client.updateResource(`/extensions/${extensionId}`, extensionId, data);
    return updatedExtensionId;
  }

  /**
   * Update an existing webhook
   * @param webhookId ID of the webhook to update
   * @param data webhook data
   */
  async updateWebhook(webhookId: string, data: any): Promise<string> {
    const updatedWebhookId = await this.client.updateResource(
      `/hubs/${this.hubId}/webhooks/${webhookId}`,
      webhookId,
      data
    );
    return updatedWebhookId;
  }

  /**
   * Fetch list of all indexes
   */
  async getIndexesList(): Promise<any> {
    const indexesList = await this.client.fetchPaginatedResourcesList(
      `/algolia-search/${this.hubId}/indexes`,
      'indexes'
    );
    return indexesList;
  }

  /**
   * Fetch list of all indexes with details
   */
  async getIdexesDetailsList(): Promise<any> {
    const indexesListDetails = await this.client.fetchPaginatedResourcesListWithDetails(
      `/algolia-search/${this.hubId}/indexes`,
      'indexes'
    );
    return indexesListDetails;
  }

  /**
   * Fetch an index with its settings and assigned content types
   * @param indexId ID of the index to retrieve
   */
  async getIndex(indexId: any): Promise<any> {
    // Retrieve index details
    const index = await this.client.fetchResource(`/algolia-search/${this.hubId}/indexes/${indexId}`);

    // If index entry found, get settings and assigned content types
    if (index.id) {
      // Retrieve index settings
      const settings = await this.getIndexSettings(indexId);

      // Retrieve index assigned content types
      const assignedContentTypes = await this.client.fetchPaginatedResourcesList(
        `/algolia-search/${this.hubId}/indexes/${indexId}/assigned-content-types`,
        'assigned-content-types'
      );

      // Add settings and assigned content types to the response
      index.settings = settings;
      if (assignedContentTypes.length > 0) {
        index.assignedContentTypes = assignedContentTypes;
      }
    }
    return index;
  }

  /**
   * Fetch a search index api key
   * @param indexId ID of the index
   * @param keyId ID of the key to retrieve
   */
  async getSearchApiKey(indexId: any, keyId: any): Promise<any> {
  
    // Retrieve index details
    const key = await this.client.fetchResource(`/algolia-search/${this.hubId}/indexes/${indexId}/keys/${keyId}`);

    return key;
  }

  /**
   * Retrieve assigned content typs for a specific index
   * @param indexId ID of the index
   */
  async getIndexAssignedContentTypes(indexId: any): Promise<any> {
    const assignedContentTypes = this.client.fetchPaginatedResourcesList(
      `/algolia-search/${this.hubId}/indexes/${indexId}/assigned-content-types`,
      'assigned-content-types'
    );
    return assignedContentTypes;
  }

  /**
   * Create an index
   * @param data Settings data
   */
  async createIndex(data: any): Promise<any> {
    const indexId = await this.client.createResource(`/algolia-search/${this.hubId}/indexes`, data);
    return indexId;
  }

  /**
   * Delete an index
   * @param indexId ID of the index to delete
   */
  async deleteIndex(indexId: any): Promise<any> {
    const deletedIndexId = await this.client.deleteResource(
      `/algolia-search/${this.hubId}/indexes/${indexId}`,
      indexId
    );
    return deletedIndexId;
  }

  /**
   * Get index settings
   * @param indexId ID of the index
   */
  async getIndexSettings(indexId: any): Promise<any> {
    const settings = await this.client.fetchResource(`/algolia-search/${this.hubId}/indexes/${indexId}/settings`);
    return settings;
  }

  /**
   * Delete an index and its replicas
   * @param indexId ID of the index to delete
   */
  async deleteIndexAndReplicas(indexId: any): Promise<any[]> {
    // Get and delete replicas first
    const indexSettings = await this.client.fetchResource(`/algolia-search/${this.hubId}/indexes/${indexId}/settings`);
    let deletedReplicasIndexIds: any[] = [];

    if (indexSettings.replicas) {
      const replicasNames = indexSettings.replicas;

      // Retrieve all replicas in parallel
      const replicasList = await Promise.all(replicasNames.map((item: any) => this.getIndexByName(item)));

      // Delete replicas
      deletedReplicasIndexIds = await Promise.all(replicasList.map((item: any) => this.deleteIndex(item.id)));
    }

    // Delete Index
    const deletedIndexId = await this.deleteIndex(indexId);
    return [deletedIndexId, ...deletedReplicasIndexIds];
  }

  /**
   * Update an index settings
   * @param argv Command arguments
   * @param indexId Index ID
   * @param data Settings data
   */
  async updateIndexSettings(indexId: any, data: any): Promise<any> {
    const updatedIndexId = await this.client.updateResource(
      `/algolia-search/${this.hubId}/indexes/${indexId}/settings`,
      indexId,
      data
    );
    return updatedIndexId;
  }

  /**
   * Get an index by name (for replica management)
   * @param indexName Index name
   */
  async getIndexByName(indexName: any): Promise<any> {
    const indexesList = await this.getIndexesList();
    const index = indexesList.filter((item: any) => item.name === indexName);
    if (index.length > 0) {
      console.log(`...Found index: ${index[0].id}`);
      return index[0];
    } else {
      console.log(`...No index found for name ${indexName}`);
      return null;
    }
  }

  /**
   * Get an extension by name
   * @param extensionName Extension name
   */
  async getExtensionByName(extensionName: any): Promise<any> {
    const extensionsList = await this.getExtensionsList();
    const extension = extensionsList.filter((item: any) => item.name === extensionName);
    if (extension.length > 0) {
      console.log(`...Found extension: ${extension[0].id}`);
      return extension[0];
    } else {
      console.log(`...No exetnsion found for name ${extensionName}`);
      return null;
    }
  }
}
