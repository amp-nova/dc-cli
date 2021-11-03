"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function dependancy(id) {
    return {
        _meta: {
            schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link'
        },
        contentType: 'https://dev-solutions.s3.amazonaws.com/DynamicContentTypes/Accelerators/blog.json',
        id: id
    };
}
function dependProps(itemProps) {
    const result = {};
    itemProps.forEach(element => {
        result[element[0]] = dependancy(element[1]);
    });
    return result;
}
function dependsOn(itemIds, itemProps) {
    itemProps = itemProps || [];
    return {
        links: itemIds.map(id => dependancy(id)),
        ...dependProps(itemProps)
    };
}
exports.dependsOn = dependsOn;
function dependantType(items) {
    return {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'http://superbasic.com',
        title: 'Title',
        description: 'Description',
        allOf: [
            {
                $ref: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content'
            }
        ],
        required: ['valid'],
        type: 'object',
        properties: {
            links: {
                title: 'title',
                type: 'array',
                minItems: items,
                maxItems: items,
                items: {
                    allOf: [
                        { $ref: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link' },
                        {
                            properties: {
                                contentType: {
                                    enum: ['*']
                                }
                            }
                        }
                    ]
                }
            }
        },
        propertyOrder: []
    };
}
exports.dependantType = dependantType;
