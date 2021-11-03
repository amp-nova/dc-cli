"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
exports.updateContentTypeSchema = async (schemaToUpdate, schemaBody, validationLevel) => {
    const updatedSchema = new dc_management_sdk_js_1.ContentTypeSchema();
    updatedSchema.body = schemaBody;
    updatedSchema.validationLevel = validationLevel;
    return schemaToUpdate.related.update(updatedSchema);
};
