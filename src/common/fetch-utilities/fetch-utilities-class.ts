import fetch from 'node-fetch';
import { Arguments } from 'yargs';
import { ConfigurationParameters } from '../../commands/configure';

/**
 * General fetch utilities to fetch resource, resource lists, update, delete
 * resources using Amplience Management REST API
 */
export class FetchUtilities {
  // Global variables
  authUrl = process.env.AUTH_URL || 'https://auth.adis.ws';
  apiUrl = process.env.API_URL || 'https://api.amplience.net/v2/content';
  PAGE_SIZE = 20;
  accessToken: string;

  async init(argv: Arguments<ConfigurationParameters>) {
    this.accessToken = await this.getAccessToken(argv.clientId, argv.clientSecret);
  }

  /**
   * Retrieve access token using Client ID and Client Secret
   * @param clientId Client ID
   * @param clientSecret Client secret
   */
  async getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const authUrlFinal = `${this.authUrl}/oauth/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
    const response = await fetch(authUrlFinal, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const authorization = await response.json();
    return authorization.access_token;
  }

  /**
   * Retrieve a single resource
   * @param endpointUri Endpoint URI
   */
  async fetchResource(endpointUri: string): Promise<any> {
    let resource: any = {};

    if (this.accessToken) {
      // Retrieve resources using REST API
      const response = await fetch(`${this.apiUrl}${endpointUri}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + this.accessToken }
      });
      if (response.ok) {
        resource = await response.json();
      }

      // Remove _links key
      delete resource._links;
    }

    return resource;
  }

  /**
   * Retrieve a list of resources
   * @param endpointUri Endpoint URI
   * @param resourceName Name of the embedded field for pagination
   */
  async fetchPaginatedResourcesList(endpointUri: string, resourceName: string): Promise<any[]> {
    let resourcesList: any[] = [];

    if (this.accessToken) {
      // Retrieve resources using REST API
      const response = await fetch(`${this.apiUrl}${endpointUri}?size=${this.PAGE_SIZE}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + this.accessToken }
      });
      const resources = await response.json();
      if (resources._embedded && resources._embedded[resourceName]) {
        const resourceFinal = resources._embedded[resourceName];

        // Delete _links key
        // resourceFinal.forEach((entry: any) => delete entry._links);

        // Set current list
        resourcesList = resourceFinal;
      }

      // Go through all pages if needed
      if (resources.page) {
        const totalPages = resources.page.totalPages;
        let pageNumber = 0;
        while (pageNumber < totalPages - 1) {
          pageNumber++;
          const resourcesUrl = `${this.apiUrl}${endpointUri}?size=${this.PAGE_SIZE}&page=${pageNumber}`;
          const response = await fetch(resourcesUrl, {
            method: 'GET',
            headers: { Authorization: 'Bearer ' + this.accessToken }
          });
          const resources = await response.json();
          if (resources._embedded && resources._embedded[resourceName]) {
            const resourceFinal = resources._embedded[resourceName];

            // Delete _links key
            resourceFinal.forEach((entry: any) => delete entry._links);

            // Merge with current list
            resourcesList = [...resourcesList, ...resourceFinal];
          }
        }
      }
    }

    // Return resourcesList as well as the access token for further calls
    return resourcesList;
  }

  /**
   * Retrieve resources list and goes through the details for each
   * using the endpoint `${endpoint}/<resource Id>`
   * @param endpointUri Endpoint URI
   * @param resourceName Name of the embedded field for pagination
   */
  async fetchPaginatedResourcesListWithDetails(endpointUri: string, resourceName: string): Promise<any[]> {
    const resourcesList = await this.fetchPaginatedResourcesList(endpointUri, resourceName);

    // Retrieve all resources in parallel
    const resourcesListDetails = await Promise.all(
      resourcesList.map((item: any) =>
        fetch(`${this.apiUrl}${endpointUri}/${item.id}`, {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + this.accessToken }
        })
          .then(r => r.json())
          .catch(error => ({ error }))
      )
    );

    // Delete _links key
    resourcesListDetails.forEach(entry => delete entry._links);

    return resourcesListDetails;
  }

  /**
   * Delete a resource
   * @param endpointUri Endpoint URI
   */
  async deleteResource(endpointUri: string, resourceId: string): Promise<string> {
    let finalResourceId: any = '';

    if (this.accessToken) {
      // Delete resource using REST API
      const response = await fetch(`${this.apiUrl}${endpointUri}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + this.accessToken }
      });
      if (response.ok) {
        finalResourceId = resourceId;
      }
    }

    return resourceId;
  }

  /**
   * Create a resource
   * @param endpointUri Endpoint URI
   * @param data resource to create
   */
  async createResource(endpointUri: string, data: any): Promise<string> {
    let resource: any = {};
    let resourceId: any = '';

    if (this.accessToken) {
      // Create resource using REST API
      const response = await fetch(`${this.apiUrl}${endpointUri}`, {
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

  /**
   * Update a resource
   * @param endpointUri Endpoint URI
   * @param resourceId Resource ID
   * @param data resource to create
   */
  async updateResource(endpointUri: string, resourceId: string, data: any): Promise<string> {
    let updatedResourceId: any = '';

    if (this.accessToken) {
      // Update resource using REST API
      const response = await fetch(`${this.apiUrl}${endpointUri}`, {
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
