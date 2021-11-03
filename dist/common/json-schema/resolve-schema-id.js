"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resolveSchemaId = (schema) => (schema.$id !== undefined ? schema.$id : schema.id);
exports.default = resolveSchemaId;
