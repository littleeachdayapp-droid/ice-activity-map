import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ICE Activity Map API',
      version: '1.0.0',
      description: 'API for tracking and reporting ICE enforcement activity across the United States',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        Report: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            sourceType: {
              type: 'string',
              enum: ['bluesky', 'mastodon', 'reddit', 'user_submitted']
            },
            sourceId: { type: 'string', nullable: true },
            activityType: {
              type: 'string',
              enum: ['raid', 'checkpoint', 'arrest', 'surveillance', 'other']
            },
            description: { type: 'string' },
            city: { type: 'string', nullable: true },
            state: { type: 'string', nullable: true },
            latitude: { type: 'number', nullable: true },
            longitude: { type: 'number', nullable: true },
            authorHandle: { type: 'string' },
            authorDisplayName: { type: 'string', nullable: true },
            status: {
              type: 'string',
              enum: ['unverified', 'verified', 'disputed']
            },
            reportedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        CreateReportInput: {
          type: 'object',
          required: ['activityType', 'description', 'authorHandle'],
          properties: {
            activityType: {
              type: 'string',
              enum: ['raid', 'checkpoint', 'arrest', 'surveillance', 'other']
            },
            description: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            authorHandle: { type: 'string' },
            authorDisplayName: { type: 'string' }
          }
        },
        Verification: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            reportId: { type: 'string', format: 'uuid' },
            userIdentifier: { type: 'string' },
            vote: { type: 'string', enum: ['confirm', 'dispute'] },
            comment: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Stats: {
          type: 'object',
          properties: {
            totalReports: { type: 'integer' },
            last7Days: { type: 'integer' },
            last30Days: { type: 'integer' },
            byActivityType: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  count: { type: 'integer' }
                }
              }
            },
            topStates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  state: { type: 'string' },
                  count: { type: 'integer' }
                }
              }
            },
            timeline: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  count: { type: 'integer' }
                }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            hasMore: { type: 'boolean' }
          }
        }
      },
      securitySchemes: {
        AdminKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Admin-Key',
          description: 'Admin API key for moderation endpoints'
        }
      }
    }
  },
  apis: ['./src/routes/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
