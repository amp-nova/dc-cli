"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const util_1 = require("util");
class WorkflowStatesMapping {
    constructor() {
        this.workflowStates = new Map();
    }
    getWorkflowState(id) {
        if (id === undefined) {
            return undefined;
        }
        return this.workflowStates.get(id);
    }
    registerWorkflowState(fromId, toId) {
        this.workflowStates.set(fromId, toId);
    }
    async save(filename) {
        const obj = {
            workflowStates: Array.from(this.workflowStates)
        };
        const text = JSON.stringify(obj);
        const dir = path_1.dirname(filename);
        if (!(await util_1.promisify(fs_1.exists)(dir))) {
            await util_1.promisify(fs_1.mkdir)(dir);
        }
        await util_1.promisify(fs_1.writeFile)(filename, text, { encoding: 'utf8' });
    }
    async load(filename) {
        try {
            const text = await util_1.promisify(fs_1.readFile)(filename, { encoding: 'utf8' });
            const obj = JSON.parse(text);
            this.workflowStates = new Map(obj.workflowStates);
            return true;
        }
        catch (e) {
            return false;
        }
    }
}
exports.WorkflowStatesMapping = WorkflowStatesMapping;
