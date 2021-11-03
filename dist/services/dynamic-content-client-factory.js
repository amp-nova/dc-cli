"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const dynamicContentClientFactory = (config) => new dc_management_sdk_js_1.DynamicContent({
    client_id: config.clientId,
    client_secret: config.clientSecret
}, {
    apiUrl: process.env.API_URL,
    authUrl: process.env.AUTH_URL
});
exports.default = dynamicContentClientFactory;
