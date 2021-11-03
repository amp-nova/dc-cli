"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calls = [];
exports.handler = async (argv) => {
    exports.calls.push(argv);
    return true;
};
