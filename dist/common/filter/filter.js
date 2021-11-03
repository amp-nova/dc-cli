"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function equalsOrRegex(value, compare) {
    if (compare.length > 1 && compare[0] === '/' && compare[compare.length - 1] === '/') {
        try {
            const regExp = new RegExp(compare.substr(1, compare.length - 2));
            return regExp.test(value);
        }
        catch (e) {
            console.error('Could not parse regex!');
            throw e;
        }
    }
    return value === compare;
}
exports.equalsOrRegex = equalsOrRegex;
