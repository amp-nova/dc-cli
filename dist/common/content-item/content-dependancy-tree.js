"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referenceTypes = [
    'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link',
    'http://bigcontent.io/cms/schema/v1/core#/definitions/content-reference'
];
class ContentDependancyTree {
    constructor(items, mapping) {
        let info = this.identifyContentDependancies(items);
        const allInfo = info;
        this.resolveContentDependancies(info);
        const requiredSchema = new Set();
        info.forEach(item => {
            requiredSchema.add(item.owner.content.body._meta.schema);
        });
        const resolved = new Set();
        mapping.contentItems.forEach((to, from) => {
            resolved.add(from);
        });
        let unresolvedCount = info.length;
        const stages = [];
        while (unresolvedCount > 0) {
            const stage = [];
            const lastUnresolvedCount = unresolvedCount;
            info = info.filter(item => {
                const unresolvedDependancies = item.dependancies.filter(dep => !resolved.has(dep.dependancy.id));
                if (unresolvedDependancies.length === 0) {
                    stage.push(item);
                    return false;
                }
                return true;
            });
            stage.forEach(item => {
                resolved.add(item.owner.content.id);
            });
            unresolvedCount = info.length;
            if (unresolvedCount === lastUnresolvedCount) {
                break;
            }
            stages.push({ items: stage });
        }
        this.levels = stages;
        this.circularLinks = info;
        this.all = allInfo;
        this.byId = new Map(allInfo.map(info => [info.owner.content.id, info]));
        this.requiredSchema = Array.from(requiredSchema);
    }
    searchObjectForContentDependancies(item, body, result) {
        if (Array.isArray(body)) {
            body.forEach(contained => {
                this.searchObjectForContentDependancies(item, contained, result);
            });
        }
        else {
            const allPropertyNames = Object.getOwnPropertyNames(body);
            if (body._meta &&
                exports.referenceTypes.indexOf(body._meta.schema) !== -1 &&
                typeof body.contentType === 'string' &&
                typeof body.id === 'string') {
                result.push({ dependancy: body, owner: item });
                return;
            }
            allPropertyNames.forEach(propName => {
                const prop = body[propName];
                if (typeof prop === 'object') {
                    this.searchObjectForContentDependancies(item, prop, result);
                }
            });
        }
    }
    removeContentDependanciesFromBody(body, remove) {
        if (Array.isArray(body)) {
            for (let i = 0; i < body.length; i++) {
                if (remove.indexOf(body[i]) !== -1) {
                    body.splice(i--, 1);
                }
                else {
                    this.removeContentDependanciesFromBody(body[i], remove);
                }
            }
        }
        else {
            const allPropertyNames = Object.getOwnPropertyNames(body);
            allPropertyNames.forEach(propName => {
                const prop = body[propName];
                if (remove.indexOf(prop) !== -1) {
                    delete body[propName];
                }
                else if (typeof prop === 'object') {
                    this.removeContentDependanciesFromBody(prop, remove);
                }
            });
        }
    }
    identifyContentDependancies(items) {
        return items.map(item => {
            const result = [];
            this.searchObjectForContentDependancies(item, item.content.body, result);
            if (item.content.body._meta.hierarchy && item.content.body._meta.hierarchy.parentId) {
                result.push({
                    dependancy: {
                        _meta: {
                            schema: '_hierarchy'
                        },
                        id: item.content.body._meta.hierarchy.parentId,
                        contentType: ''
                    },
                    owner: item
                });
            }
            return { owner: item, dependancies: result, dependants: [] };
        });
    }
    resolveContentDependancies(items) {
        const idMap = new Map(items.map(item => [item.owner.content.id, item]));
        const visited = new Set();
        const resolve = (item) => {
            if (visited.has(item))
                return;
            visited.add(item);
            item.dependancies.forEach(dep => {
                const target = idMap.get(dep.dependancy.id);
                dep.resolved = target;
                if (target) {
                    target.dependants.push({ owner: target.owner, resolved: item, dependancy: dep.dependancy });
                    resolve(target);
                }
            });
        };
        items.forEach(item => resolve(item));
    }
    traverseDependants(item, action, ignoreHier = false, traversed) {
        const traversedSet = traversed || new Set();
        traversedSet.add(item);
        action(item);
        item.dependants.forEach(dependant => {
            if (ignoreHier && dependant.dependancy._meta.schema == '_hierarchy') {
                return;
            }
            const resolved = dependant.resolved;
            if (!traversedSet.has(resolved)) {
                this.traverseDependants(resolved, action, ignoreHier, traversedSet);
            }
        });
    }
    filterAny(action) {
        return this.all.filter(item => {
            let match = false;
            this.traverseDependants(item, item => {
                if (action(item)) {
                    match = true;
                }
            });
            return match;
        });
    }
    removeContent(items) {
        this.levels.forEach(level => {
            level.items = level.items.filter(item => items.indexOf(item) === -1);
        });
        this.all = this.all.filter(item => items.indexOf(item) === -1);
        this.circularLinks = this.circularLinks.filter(item => items.indexOf(item) === -1);
        items.forEach(item => {
            this.byId.delete(item.owner.content.id);
        });
    }
}
exports.ContentDependancyTree = ContentDependancyTree;
