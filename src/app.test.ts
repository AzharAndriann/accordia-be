import { describe, expect, test } from 'bun:test';
import { createApp } from './app';
import { openApiDocument } from './docs/openapi';

const database = {
  async $queryRaw(_query: TemplateStringsArray) {
    return [{ '?column?': 1 }];
  },
};

const app = createApp(database);

describe('system endpoints', () => {
  test('Express tidak mengekspos identitas framework', () => {
    expect(app.disabled('x-powered-by')).toBe(true);
  });

  test('OpenAPI hanya mendokumentasikan endpoint yang sudah tersedia', () => {
    expect(Object.keys(openApiDocument.paths)).toEqual([
      '/health',
      '/ready',
      '/auth/register',
      '/auth/login',
      '/projects',
      '/projects/{projectId}/invitations',
      '/invitations/accept',
      '/projects/{projectId}/agreement-versions',
      '/agreement-versions/{versionId}',
      '/agreement-versions/{versionId}/submit',
      '/agreement-versions/{versionId}/approve',
      '/agreement-versions/{versionId}/reject',
      '/projects/{projectId}/change-requests',
    ]);
  });

  test('operationId OpenAPI unik', () => {
    const operationIds = Object.values(openApiDocument.paths).flatMap((path) =>
      Object.values(path).map((operation) => operation.operationId),
    );

    expect(new Set(operationIds).size).toBe(operationIds.length);
  });
});
