"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const mock_page_1 = __importDefault(require("./mock-page"));
class MockContentMetrics {
    constructor() {
        this.itemsCreated = 0;
        this.itemsUpdated = 0;
        this.itemsArchived = 0;
        this.itemsUnarchived = 0;
        this.itemsLocaleSet = 0;
        this.itemsVersionGet = 0;
        this.foldersCreated = 0;
        this.typesCreated = 0;
        this.typeSchemasCreated = 0;
    }
    reset() {
        this.itemsCreated = 0;
        this.itemsUpdated = 0;
        this.itemsArchived = 0;
        this.itemsUnarchived = 0;
        this.itemsLocaleSet = 0;
        this.itemsVersionGet = 0;
        this.foldersCreated = 0;
        this.typesCreated = 0;
        this.typeSchemasCreated = 0;
    }
}
exports.MockContentMetrics = MockContentMetrics;
class MockContent {
    constructor(contentService) {
        this.contentService = contentService;
        this.items = [];
        this.repos = [];
        this.folders = [];
        this.typeById = new Map();
        this.typeSchemaById = new Map();
        this.repoById = new Map();
        this.folderById = new Map();
        this.subfoldersById = new Map();
        this.typeAssignmentsByRepoId = new Map();
        this.metrics = new MockContentMetrics();
        this.failItemActions = null;
        this.failFolderActions = null;
        this.failRepoActions = null;
        this.uniqueId = 0;
        const mockHub = this.createMockHub();
        const mockFolderGet = jest.fn(id => Promise.resolve(this.folderById.get(id)));
        const mockRepoGet = jest.fn(id => {
            return Promise.resolve(this.repoById.get(id).repo);
        });
        const mockHubGet = jest.fn(() => {
            if (this.failHubGet) {
                throw new Error('Simulated Netowrk Failure.');
            }
            return Promise.resolve(mockHub);
        });
        const mockHubList = jest.fn().mockResolvedValue([mockHub]);
        const mockTypeGet = jest.fn(id => Promise.resolve(this.typeById.get(id)));
        const mockTypeSchemaGet = jest.fn(id => Promise.resolve(this.typeSchemaById.get(id)));
        const mockItemGet = jest.fn(id => {
            const result = this.items.find(item => item.id === id);
            if (result == null) {
                throw new Error(`Content item with id ${id} was requested, but is missing.`);
            }
            return Promise.resolve(result);
        });
        contentService.mockReturnValue({
            hubs: {
                get: mockHubGet,
                list: mockHubList
            },
            folders: {
                get: mockFolderGet
            },
            contentRepositories: {
                get: mockRepoGet
            },
            contentTypes: {
                get: mockTypeGet
            },
            contentTypeSchemas: {
                get: mockTypeSchemaGet
            },
            contentItems: {
                get: mockItemGet
            }
        });
    }
    getFolderName(path) {
        let folderName = '';
        if (path != null) {
            const pathSplit = path.split('/');
            folderName = pathSplit[pathSplit.length - 1];
        }
        return folderName;
    }
    createMockHub() {
        const mockHub = new dc_management_sdk_js_1.Hub();
        const mockRepoList = jest.fn().mockImplementation(() => {
            if (this.failRepoList) {
                throw new Error('Simulated Netowrk Failure.');
            }
            return Promise.resolve(new mock_page_1.default(dc_management_sdk_js_1.ContentRepository, this.repos.map(repo => repo.repo)));
        });
        const mockTypesList = jest
            .fn()
            .mockImplementation(() => Promise.resolve(new mock_page_1.default(dc_management_sdk_js_1.ContentType, Array.from(this.typeById.values()))));
        const mockSchemaList = jest
            .fn()
            .mockImplementation(() => Promise.resolve(new mock_page_1.default(dc_management_sdk_js_1.ContentTypeSchema, Array.from(this.typeSchemaById.values()))));
        const mockTypeRegister = jest.fn().mockImplementation((type) => {
            this.metrics.typesCreated++;
            type = new dc_management_sdk_js_1.ContentType(type);
            type.id = 'UNIQUE-' + this.uniqueId++;
            this.typeById.set(type.id, type);
            return Promise.resolve(type);
        });
        mockHub.related.contentRepositories.list = mockRepoList;
        mockHub.related.contentTypeSchema.list = mockSchemaList;
        mockHub.related.contentTypes.list = mockTypesList;
        mockHub.related.contentTypes.register = mockTypeRegister;
        return mockHub;
    }
    assignmentMeta(typeAssignments) {
        return typeAssignments.map(assign => ({
            hubContentTypeId: assign.id,
            contentTypeUri: assign.contentTypeUri
        }));
    }
    createMockRepository(repoId) {
        if (this.repoById.has(repoId))
            return;
        const repo = new dc_management_sdk_js_1.ContentRepository({
            id: repoId,
            label: repoId
        });
        const mockRepo = {
            repo,
            folders: [],
            items: this.items.filter(item => item.repoId == repoId)
        };
        const mockItemList = jest.fn().mockImplementation((options) => {
            if (this.failRepoActions == 'list') {
                throw new Error('Simulated network failure.');
            }
            let filter = mockRepo.items;
            if (options.status) {
                filter = filter.filter(item => item.status === options.status);
            }
            return Promise.resolve(new mock_page_1.default(dc_management_sdk_js_1.ContentItem, filter));
        });
        repo.related.contentItems.list = mockItemList;
        const mockFolderList = jest
            .fn()
            .mockImplementation(() => Promise.resolve(new mock_page_1.default(dc_management_sdk_js_1.Folder, this.folders.filter(folder => folder.repoId === repoId && folder.id == folder.name))));
        repo.related.folders.list = mockFolderList;
        const mockItemCreate = jest.fn().mockImplementation((item) => {
            if (this.failRepoActions == 'create') {
                throw new Error('Simulated network failure.');
            }
            item = new dc_management_sdk_js_1.ContentItem(item);
            item.id = 'UNIQUE-' + this.uniqueId++;
            this.createItem(item, mockRepo);
            return Promise.resolve(item);
        });
        repo.related.contentItems.create = mockItemCreate;
        const mockTypeAssign = jest.fn().mockImplementation((contentTypeId) => {
            const typeAssignments = this.typeAssignmentsByRepoId.get(repo.id) || [];
            typeAssignments.push(this.typeById.get(contentTypeId));
            this.typeAssignmentsByRepoId.set(repo.id, typeAssignments);
            repo.contentTypes = this.assignmentMeta(typeAssignments);
            return Promise.resolve(repo);
        });
        repo.related.contentTypes.assign = mockTypeAssign;
        const mockFolderCreate = jest.fn().mockImplementation((folder) => {
            folder = new dc_management_sdk_js_1.Folder(folder);
            folder.repoId = repo.id;
            this.createFolder(folder);
            return Promise.resolve(folder);
        });
        repo.related.folders.create = mockFolderCreate;
        this.repoById.set(repoId, mockRepo);
        this.repos.push(mockRepo);
    }
    createItem(item, mockRepo) {
        this.metrics.itemsCreated++;
        item.version = item.version || 1;
        item.locale = '';
        const mockItemRepo = jest.fn();
        item.related.contentRepository = mockItemRepo;
        const mockItemUpdate = jest.fn();
        item.related.update = mockItemUpdate;
        const mockItemArchive = jest.fn();
        item.related.archive = mockItemArchive;
        const mockItemUnarchive = jest.fn();
        item.related.unarchive = mockItemUnarchive;
        const mockItemVersion = jest.fn();
        item.related.contentItemVersion = mockItemVersion;
        const mockItemLocale = jest.fn(async (locale) => {
            this.metrics.itemsLocaleSet++;
            item.locale = locale;
            return Promise.resolve(item);
        });
        item.related.setLocale = mockItemLocale;
        if (mockRepo != null) {
            item.repoId = mockRepo.repo.id;
        }
        mockItemRepo.mockImplementation(() => {
            if (this.failItemActions)
                throw new Error('Simulated network failure.');
            return Promise.resolve(this.repoById.get(item.repoId).repo);
        });
        mockItemUpdate.mockImplementation(newItem => {
            if (this.failItemActions)
                throw new Error('Simulated network failure.');
            this.metrics.itemsUpdated++;
            item.label = newItem.label;
            item.body = newItem.body;
            item.status = newItem.status;
            item.version = item.version + 1;
            return Promise.resolve(item);
        });
        mockItemArchive.mockImplementation(() => {
            if (this.failItemActions)
                throw new Error('Simulated network failure.');
            if (item.status != dc_management_sdk_js_1.Status.ACTIVE) {
                throw new Error('Cannot archive content that is already archived.');
            }
            this.metrics.itemsArchived++;
            item.status = dc_management_sdk_js_1.Status.DELETED;
            return Promise.resolve(item);
        });
        mockItemUnarchive.mockImplementation(() => {
            if (this.failItemActions)
                throw new Error('Simulated network failure.');
            if (item.status == dc_management_sdk_js_1.Status.ACTIVE) {
                throw new Error('Cannot unarchive content that is not archived.');
            }
            this.metrics.itemsUnarchived++;
            item.status = dc_management_sdk_js_1.Status.ACTIVE;
            return Promise.resolve(item);
        });
        mockItemVersion.mockImplementation(version => {
            if (this.failItemActions && this.failItemActions != 'not-version')
                throw new Error('Simulated network failure.');
            const newItem = { ...item };
            newItem.version = version;
            this.metrics.itemsVersionGet++;
            return Promise.resolve(newItem);
        });
        this.items.push(item);
        if (mockRepo) {
            mockRepo.items.push(item);
        }
    }
    registerContentType(schemaName, id, repos, body, schemaOnly) {
        if (!this.typeSchemaById.has(id)) {
            const schema = new dc_management_sdk_js_1.ContentTypeSchema({ id: id, schemaId: schemaName, body: JSON.stringify(body) });
            this.typeSchemaById.set(id, schema);
        }
        if (!schemaOnly) {
            const type = new dc_management_sdk_js_1.ContentType({ id: id, contentTypeUri: schemaName, settings: { label: path_1.basename(schemaName) } });
            this.typeById.set(id, type);
            const mockCached = jest.fn();
            type.related.contentTypeSchema.get = mockCached;
            mockCached.mockImplementation(() => {
                const cached = new dc_management_sdk_js_1.ContentTypeCachedSchema({
                    contentTypeUri: schemaName,
                    cachedSchema: { ...body, $id: schemaName }
                });
                return Promise.resolve(cached);
            });
            const repoArray = typeof repos === 'string' ? [repos] : repos;
            repoArray.forEach(repoName => {
                const typeAssignments = this.typeAssignmentsByRepoId.get(repoName) || [];
                typeAssignments.push(type);
                const repo = this.repoById.get(repoName);
                if (repo != null) {
                    repo.repo.contentTypes = this.assignmentMeta(typeAssignments);
                }
                this.typeAssignmentsByRepoId.set(repoName, typeAssignments);
            });
        }
    }
    importItemTemplates(templates) {
        const repoIds = this.repos.map(repo => repo.repo.id);
        const newRepoIds = this.repos.map(repo => repo.repo.id);
        const folderTemplates = [];
        templates.forEach(template => {
            const folderId = template.folderPath;
            const folderName = this.getFolderName(folderId);
            const folderNullOrEmpty = folderId == null || folderId.length == 0;
            const item = new dc_management_sdk_js_1.ContentItem({
                label: template.label,
                status: template.status || dc_management_sdk_js_1.Status.ACTIVE,
                id: template.id || '0',
                folderId: folderNullOrEmpty ? null : folderId,
                version: template.version,
                lastPublishedVersion: template.lastPublishedVersion,
                locale: template.locale,
                body: {
                    ...template.body,
                    _meta: {
                        schema: template.typeSchemaUri
                    }
                },
                repoId: template.repoId
            });
            if (repoIds.indexOf(template.repoId) === -1) {
                repoIds.push(template.repoId);
                newRepoIds.push(template.repoId);
            }
            if (!folderNullOrEmpty && folderTemplates.findIndex(folder => folder.id == folderId) === -1) {
                folderTemplates.push({ id: folderId || '', name: folderName, repoId: template.repoId });
            }
            this.createItem(item, this.repoById.get(template.repoId));
        });
        const generateFolder = (folderTemplate) => {
            if (this.folderById.has(folderTemplate.id)) {
                return;
            }
            const id = folderTemplate.id;
            const folder = new dc_management_sdk_js_1.Folder({
                id: id,
                name: folderTemplate.name,
                repoId: folderTemplate.repoId
            });
            const slashInd = id.lastIndexOf('/');
            if (slashInd !== -1) {
                const parentPath = id.substring(0, slashInd);
                let parent = this.folders.find(folder => folder.id == parentPath);
                if (parentPath != '') {
                    generateFolder({ id: parentPath, name: this.getFolderName(parentPath), repoId: folderTemplate.repoId });
                    parent = this.folders.find(folder => folder.id == parentPath);
                }
                if (parent != null) {
                    const subfolders = this.subfoldersById.get(parent.id) || [];
                    subfolders.push(folder);
                    this.subfoldersById.set(parent.id, subfolders);
                }
            }
            this.createFolder(folder);
        };
        folderTemplates.forEach(folderTemplate => {
            generateFolder(folderTemplate);
        });
        newRepoIds.forEach(repoId => {
            this.createMockRepository(repoId);
        });
    }
    async getFolderPath(folder) {
        if (folder == null) {
            return '';
        }
        let parent = undefined;
        try {
            parent = await folder.related.folders.parent();
        }
        catch (_a) { }
        if (parent == null) {
            return folder.name + '/';
        }
        else {
            return (await this.getFolderPath(parent)) + folder.name + '/';
        }
    }
    async getPath(item) {
        return (await this.getFolderPath(this.folderById.get(item.folderId))) + item.label + '.json';
    }
    async filterMatch(templates, baseDir, multiRepo) {
        const results = [];
        for (let i = 0; i < templates.length; i++) {
            const template = templates[i];
            for (let j = 0; j < this.items.length; j++) {
                const item = this.items[j];
                if (item.label === template.label) {
                    if (multiRepo) {
                        const repo = await item.related.contentRepository();
                        if (repo.id != template.repoId) {
                            continue;
                        }
                    }
                    const path = await this.getPath(item);
                    if (path_1.join(baseDir, template.folderPath || '') == path_1.dirname(path)) {
                        results.push(template);
                    }
                    break;
                }
            }
        }
        return results;
    }
    createFolder(folder) {
        this.metrics.foldersCreated++;
        const id = folder.id;
        const mockFolderList = jest.fn();
        folder.related.contentItems.list = mockFolderList;
        const mockFolderSubfolder = jest.fn();
        folder.related.folders.list = mockFolderSubfolder;
        const mockFolderParent = jest.fn();
        folder.related.folders.parent = mockFolderParent;
        const mockFolderCreate = jest.fn();
        folder.related.folders.create = mockFolderCreate;
        const mockFolderRepo = jest.fn();
        folder.related.contentRepository = mockFolderRepo;
        mockFolderList.mockImplementation(() => {
            if (this.failFolderActions === 'items') {
                throw new Error('Simulated network failure.');
            }
            return Promise.resolve(new mock_page_1.default(dc_management_sdk_js_1.ContentItem, this.items.filter(item => item.folderId === id)));
        });
        mockFolderSubfolder.mockImplementation(() => {
            if (this.failFolderActions === 'list') {
                throw new Error('Simulated network failure.');
            }
            const subfolders = this.subfoldersById.get(id) || [];
            return Promise.resolve(new mock_page_1.default(dc_management_sdk_js_1.Folder, subfolders));
        });
        mockFolderParent.mockImplementation(() => {
            if (this.failFolderActions === 'parent') {
                throw new Error('Simulated network failure.');
            }
            let result;
            this.subfoldersById.forEach((value, key) => {
                if (value.indexOf(folder) !== -1) {
                    result = this.folderById.get(key);
                }
            });
            if (result == null) {
                throw new Error('No parent - calling this throws an exception.');
            }
            return Promise.resolve(result);
        });
        mockFolderCreate.mockImplementation((newFolder) => {
            const subfolders = this.subfoldersById.get(id) || [];
            newFolder.id = 'UNIQUE-' + this.uniqueId++;
            subfolders.push(newFolder);
            newFolder.repoId = folder.repoId;
            this.createFolder(newFolder);
            this.subfoldersById.set(id, subfolders);
            return Promise.resolve(newFolder);
        });
        mockFolderRepo.mockImplementation(() => Promise.resolve(this.repoById.get(folder.repoId).repo));
        this.folderById.set(id, folder);
        this.folders.push(folder);
        return folder;
    }
}
exports.MockContent = MockContent;
function getItemInfo(items) {
    const repos = [];
    const baseFolders = [];
    items.forEach(item => {
        if (repos.indexOf(item.repoId) === -1) {
            repos.push(item.repoId);
        }
        if (item.folderPath != null) {
            const folderFirstSlash = item.folderPath.indexOf('/');
            const baseFolder = folderFirstSlash === -1 ? item.folderPath : item.folderPath.substring(0, folderFirstSlash);
            if (baseFolder.length > 0 && baseFolders.indexOf(baseFolder) === -1) {
                baseFolders.push(baseFolder);
            }
        }
    });
    return { repos, baseFolders };
}
exports.getItemInfo = getItemInfo;
function getItemName(baseDir, item, info, validRepos) {
    if (item.dependancy) {
        return path_1.join(baseDir, item.dependancy, '_dependancies', item.label + '.json');
    }
    if (validRepos) {
        let basePath = item.folderPath || '';
        if (info.repos.length > 1 && validRepos.indexOf(item.repoId) !== -1) {
            basePath = `${item.repoId}/${basePath}`;
        }
        return path_1.join(baseDir + basePath, item.label + '.json');
    }
    else {
        return path_1.join(baseDir + (item.folderPath || ''), item.label + '.json');
    }
}
exports.getItemName = getItemName;
