"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validateArrayIndex = (yargObject) => {
    const index = Object.keys(yargObject);
    if (index.length === 0) {
        return;
    }
    const isIndexSequential = index
        .sort((a, b) => (parseInt(a) > parseInt(b) ? 1 : -1))
        .every((suppliedIndex, actualIndex) => parseInt(suppliedIndex) == actualIndex);
    if (!isIndexSequential) {
        throw new Error('Targeted array indexes are unsupported, please provide a full array index starting at 0');
    }
};
exports.transformYargObjectToArray = (yargObject) => {
    validateArrayIndex(yargObject);
    return Object.entries(yargObject).map(entry => entry[1]);
};
