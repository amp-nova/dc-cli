"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const table_1 = require("table");
exports.baseTableConfig = {
    border: table_1.getBorderCharacters('ramac')
};
exports.singleItemTableOptions = {
    ...exports.baseTableConfig,
    columns: {
        1: {
            width: 100
        }
    }
};
exports.streamTableOptions = {
    ...exports.baseTableConfig,
    columnDefault: {
        width: 50
    },
    columnCount: 3,
    columns: {
        0: {
            width: 24
        },
        1: {
            width: 100
        },
        2: {
            width: 10
        }
    }
};
