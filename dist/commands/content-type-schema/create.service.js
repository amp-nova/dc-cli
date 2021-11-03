"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const resolve_schema_id_1 = __importDefault(require("../../common/json-schema/resolve-schema-id"));
exports.createContentTypeSchema = async (schemaBody, validationLevel, hub) => {
    let schemaJson;
    try {
        schemaJson = JSON.parse(schemaBody);
    }
    catch (err) {
        throw new Error('Unable to parse schema body');
    }
    const schemaId = resolve_schema_id_1.default(schemaJson);
    if (schemaId === undefined) {
        throw new Error('Missing id from schema');
    }
    else if (!schemaId) {
        throw new Error('The supplied schema id is invalid');
    }
    const contentTypeSchema = new dc_management_sdk_js_1.ContentTypeSchema();
    contentTypeSchema.body = schemaBody;
    contentTypeSchema.schemaId = schemaId;
    contentTypeSchema.validationLevel = validationLevel;
    return hub.related.contentTypeSchema.create(contentTypeSchema);
};
