"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline_1 = __importDefault(require("readline"));
function asyncQuestionInternal(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}
async function confirmArchive(action, type, allContent, missingContent) {
    const rl = readline_1.default.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
    const question = allContent
        ? `Providing no ID or filter will ${action} ALL ${type}! Are you sure you want to do this? (y/n)\n`
        : missingContent
            ? 'Warning: Some content specified on the log is missing. Are you sure you want to continue? (y/n)\n'
            : `Are you sure you want to ${action} these ${type}? (y/n)\n`;
    const answer = await asyncQuestionInternal(rl, question);
    rl.close();
    return answer.length > 0 && answer[0].toLowerCase() == 'y';
}
exports.confirmArchive = confirmArchive;
async function asyncQuestion(question) {
    const rl = readline_1.default.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
    const answer = await asyncQuestionInternal(rl, question);
    rl.close();
    return answer.length > 0 && answer[0].toLowerCase() === 'y';
}
exports.asyncQuestion = asyncQuestion;
