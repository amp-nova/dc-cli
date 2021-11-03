"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
class MockPage extends dc_management_sdk_js_1.Page {
    constructor(resourceType, mockItems, data = {}) {
        super('mock-page', resourceType, data);
        this.mockItems = mockItems;
    }
    getItems() {
        return this.mockItems;
    }
}
exports.default = MockPage;
