"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ajv_1 = __importDefault(require("ajv"));
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const node_fetch_1 = __importDefault(require("node-fetch"));
function defaultSchemaLookup(types, schemas) {
    return async (uri) => {
        const type = types.find(x => x.contentTypeUri === uri);
        let schema;
        if (type !== undefined) {
            try {
                const cached = (await type.related.contentTypeSchema.get()).cachedSchema;
                schema = new dc_management_sdk_js_1.ContentTypeSchema({
                    body: JSON.stringify(cached),
                    schemaId: cached.id
                });
            }
            catch (_a) {
            }
        }
        if (schema === undefined) {
            schema = schemas.find(x => x.schemaId === uri);
        }
        return schema;
    };
}
exports.defaultSchemaLookup = defaultSchemaLookup;
class AmplienceSchemaValidator {
    constructor(schemaLookup) {
        this.schemaLookup = schemaLookup;
        this.schemas = [];
        this.loadSchema = async (uri) => {
            let internal = this.schemas.find(schema => schema.schemaId == uri);
            if (internal !== undefined) {
                return JSON.parse(internal.body);
            }
            internal = await this.schemaLookup(uri);
            let body;
            if (internal === undefined) {
                try {
                    const result = await (await node_fetch_1.default(uri)).text();
                    body = JSON.parse(result.trim());
                }
                catch (e) {
                    return false;
                }
            }
            else {
                body = JSON.parse(internal.body);
                this.schemas.push(internal);
            }
            return body;
        };
        const ajv = new ajv_1.default({
            loadSchema: this.loadSchema.bind(this),
            unknownFormats: ['symbol', 'color', 'markdown', 'text'],
            schemaId: 'auto'
        });
        const draft4 = require('ajv/lib/refs/json-schema-draft-04.json');
        ajv.addMetaSchema(draft4);
        ajv.addMetaSchema(draft4, 'http://bigcontent.io/cms/schema/v1/schema.json');
        this.ajv = ajv;
        this.cache = new Map();
    }
    getValidatorCached(body) {
        const schemaId = body._meta.schema;
        const cacheResult = this.cache.get(schemaId);
        if (cacheResult != null) {
            return cacheResult;
        }
        const validator = (async () => {
            const schema = await this.loadSchema(schemaId);
            if (schema) {
                return await this.ajv.compileAsync(schema);
            }
            else {
                throw new Error('Could not find Content Type Schema!');
            }
        })();
        this.cache.set(schemaId, validator);
        return validator;
    }
    async validate(body) {
        const validator = await this.getValidatorCached(body);
        const result = validator(body);
        return result ? [] : validator.errors || [];
    }
}
exports.AmplienceSchemaValidator = AmplienceSchemaValidator;
