"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const table_1 = require("table");
const chalk_1 = __importDefault(require("chalk"));
const table_consts_1 = require("../common/table/table.consts");
exports.RenderingOptions = {
    json: {
        type: 'boolean',
        default: false,
        description: 'Render output as JSON'
    }
};
class DataPresenter {
    constructor(data) {
        this.data = data;
    }
    generateHorizontalTable(json, tableUserConfig) {
        if (json.length === 0) {
            return '0 items returned.';
        }
        const rows = json.map(row => Object.values(row));
        const headerRow = Object.keys(json[0]).map(key => chalk_1.default.bold(key));
        return table_1.table([headerRow, ...rows], { ...table_consts_1.baseTableConfig, ...(tableUserConfig || {}) });
    }
    generateVerticalTable(json, tableUserConfig) {
        const rows = Object.entries(json).map(value => [value[0], JSON.stringify(value[1])]);
        return table_1.table([[chalk_1.default.bold('Property'), chalk_1.default.bold('Value')], ...rows], {
            ...table_consts_1.baseTableConfig,
            ...(tableUserConfig || {})
        });
    }
    render(renderOptions = {}) {
        const itemMapFn = renderOptions.itemMapFn ? renderOptions.itemMapFn : (v) => v;
        let output;
        if (renderOptions.json) {
            output = JSON.stringify(this.data, null, 2);
        }
        else {
            output = Array.isArray(this.data)
                ? this.generateHorizontalTable(this.data.map(itemMapFn), renderOptions.tableUserConfig)
                : this.generateVerticalTable(itemMapFn(this.data), renderOptions.tableUserConfig);
            output += '\n';
        }
        process.stdout.write(output);
    }
}
exports.default = DataPresenter;
