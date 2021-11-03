"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SIZE = 100;
const paginator = async (pagableFn, options = {}) => {
    const currentPage = await pagableFn({ ...options, size: exports.DEFAULT_SIZE });
    if (currentPage.page &&
        currentPage.page.number !== undefined &&
        currentPage.page.totalPages !== undefined &&
        currentPage.page.number + 1 < currentPage.page.totalPages) {
        return [
            ...currentPage.getItems(),
            ...(await paginator(pagableFn, { ...options, page: currentPage.page.number + 1 }))
        ];
    }
    return currentPage.getItems();
};
exports.default = paginator;
