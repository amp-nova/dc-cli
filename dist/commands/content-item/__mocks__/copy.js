"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let outputIds;
let forceFail = false;
exports.calls = [];
exports.setOutputIds = (ids) => {
    outputIds = ids;
};
exports.setForceFail = (fail) => {
    forceFail = fail;
};
exports.handler = async (argv) => {
    exports.calls.push(argv);
    const idOut = argv.exportedIds;
    idOut.push(...outputIds);
    return !forceFail;
};
