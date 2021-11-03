"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calls = [];
exports.revert = async (argv) => {
    exports.calls.push(argv);
    return true;
};
