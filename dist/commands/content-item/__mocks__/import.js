"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let expectedReturn = true;
exports.calls = [];
exports.setExpectedReturn = (value) => {
    expectedReturn = value;
};
exports.handler = async (argv) => {
    exports.calls.push(argv);
    if (expectedReturn == 'throw') {
        throw new Error('Forced throw in test.');
    }
    return expectedReturn;
};
