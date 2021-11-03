"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dc_management_sdk_js_1 = require("dc-management-sdk-js");
const httpErrorFactory = {
    400: (httpError) => `Error: Request failed with status code 400\n${JSON.stringify(httpError.response, null, 2)}`,
    401: () => 'Error: Unauthorized - Please ensure your client ID & secret are correct.',
    403: (httpError) => {
        return httpError.request
            ? `Error: The requested action (${httpError.request.method}: ${httpError.request.url}) is not available (forbidden), ensure you have permission to perform this action.`
            : 'Error: The requested action is not available (forbidden), ensure you have permission to perform this action.';
    },
    429: () => 'Error: Too many requests - Please try again later.',
    500: (httpError) => `Error: Internal Server Error - ${httpError.message}`
};
const buildMessage = (err) => {
    if (typeof err === 'string') {
        return `Error: ${err}`;
    }
    if (err instanceof dc_management_sdk_js_1.HttpError && err.response) {
        const builder = httpErrorFactory[err.response.status];
        if (builder) {
            return builder(err);
        }
    }
    return `Error: ${err.message}`;
};
const errorHandler = (err) => {
    console.error(`\n${buildMessage(err)}`);
};
exports.default = errorHandler;
