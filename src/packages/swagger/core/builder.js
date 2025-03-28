import { BEARER_AUTH_CONFIG } from '@packages/swagger/constants';

export class SwaggerBuilder {
    instance = {};

    static builder() {
        return new SwaggerBuilder();
    }

    #deepIterate(obj) {
        Object.keys(obj).forEach((key) => {
            const value = obj[key];

            if (key === '$ref') {
                obj[key] = `#/components/schemas/${value}`;
            }

            if (typeof value === 'object' && value !== null) {
                this.#deepIterate(value);
            }
        });
    }

    #configResponseSchema(model) {
        this.#deepIterate(model);
        return model;
    }

    #toResponseSuccess = (model) => ({
        200: {
            description: 'Successful operation',
            content: model
                ? {
                      'application/json': {
                          schema: this.#configResponseSchema(model),
                      },
                  }
                : '',
        },
    });

    #toError = (errors) => {
        const responses = {};

        errors.forEach((error) => {
            if (!error.statusCode || error.description) {
                throw new Error('Error in swagger must contain status and description');
            }

            responses[error.statusCode] = {
                description: error.description,
            };
        });

        return responses;
    };

    addConfig(options) {
        const { openapi, info, servers, auth, basePath } = options;

        this.instance.openapi = openapi;
        this.instance.info = info;
        this.instance.auth = auth;
        this.instance.servers = servers;
        this.instance.basePath = basePath;

        this.instance.components = {
            schemas: {},
        };

        this.instance.tags = [];
        this.instance.paths = {};

        if (auth) {
            this.instance.components['securitySchemes'] = {
                bearerAuth: BEARER_AUTH_CONFIG,
            };
        }

        return this;
    }

    addTag(name) {
        if (!this.instance.tags.some((tag) => tag === name)) {
            this.instance.tags.push(name);
        }
    }

    /**
     * @param {
     {
     route?: any,
     method?: any,
     tags?: any,
     description?: any,
     security?: any,
     model?: string,
     body?:any,
     params?:any,
     consumes?:any
     }} options
     */

    api(options) {
        const {
            route,
            method,
            tags,
            description,
            security,
            model,
            body,
            params = [],
            consumes = [],
            errors = [],
        } = options;

        const responses = {};

        if (!this.instance.paths[route]) {
            this.instance.paths[route] = {};
        }

        this.instance.paths[route][method] = {
            tags: tags.length ? tags : [tags],
            description,
            security: security ? [{ bearerAuth: [] }] : [],
            produces: ['application/json'],
            consumes,
            parameters: params,
            requestBody: body
                ? {
                      content: {
                          'application/json': {
                              schema: {
                                  $ref: `#/components/schemas/${body}`,
                              },
                          },
                      },
                      required: true,
                  }
                : {},

            responses: {
                ...responses,
                ...this.#toResponseSuccess(model),
                ...this.#toError(errors),
            },
        };
    }

    addModel(name, properties, isArray) {
        if (isArray) {
            this.instance.components.schemas[name] = {
                type: 'array',
                items: {
                    type: 'object',
                    properties,
                },
            };
        } else {
            this.instance.components.schemas[name] = {
                type: 'object',
                properties,
            };
        }
    }
}
