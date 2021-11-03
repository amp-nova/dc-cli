"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const json_resolver_1 = require("../common/json-resolver/json-resolver");
const resolve_schema_id_1 = __importDefault(require("../common/json-schema/resolve-schema-id"));
exports.resolveSchemaBody = async (schemas, dir) => {
    const errors = {};
    const resolved = {};
    for (const [filename, contentTypeSchema] of Object.entries(schemas)) {
        if (contentTypeSchema.body) {
            try {
                contentTypeSchema.body = await json_resolver_1.jsonResolver(contentTypeSchema.body, dir);
                if (!contentTypeSchema.schemaId) {
                    const parsedBody = JSON.parse(contentTypeSchema.body);
                    const schemaId = resolve_schema_id_1.default(parsedBody);
                    if (schemaId) {
                        contentTypeSchema.schemaId = schemaId;
                    }
                }
            }
            catch (err) {
                errors[filename] = err;
            }
        }
        resolved[filename] = contentTypeSchema;
    }
    return [resolved, errors];
};
