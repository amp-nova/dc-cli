"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SortingOptions = {
    sort: {
        type: 'string',
        description: 'how to order the list e.g "<property>,<asc|desc>..."'
    }
};
exports.extractSortable = (pagingParameters) => {
    const { sort } = pagingParameters;
    return {
        ...(sort ? { sort } : {})
    };
};
