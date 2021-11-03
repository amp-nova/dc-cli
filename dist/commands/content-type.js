"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_command_builder_options_1 = __importDefault(require("../common/yargs/yargs-command-builder-options"));
exports.command = 'content-type';
exports.desc = 'Content Type';
exports.builder = (yargs) => yargs
    .commandDir('content-type', yargs_command_builder_options_1.default)
    .demandCommand()
    .help();
exports.handler = () => {
};
