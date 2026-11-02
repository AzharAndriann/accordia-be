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
      '/auth/refresh',
      '/projects',
      '/projects/{projectId}/invitations',
      '/projects/{projectId}/invitations/{invitationId}',
      '/projects/{projectId}/invitations/{invitationId}/removal-request',
      '/membership-removal-requests',
      '/membership-removal-requests/{invitationId}/approve',
      '/membership-removal-requests/{invitationId}/reject',
      '/invitations',
      '/invitations/{invitationId}/accept',
      '/invitations/accept',
      '/projects/{projectId}/agreement-versions',
      '/agreement-versions/{versionId}',
      '/agreement-versions/{versionId}/submit',
      '/agreement-versions/{versionId}/approve',
      '/agreement-versions/{versionId}/reject',
      '/projects/{projectId}/change-requests',
      '/projects/{projectId}/files',
      '/files/{fileId}/download',
      '/projects/{projectId}/deliveries',
      '/deliveries/{deliveryId}/accept',
      '/deliveries/{deliveryId}/request-revision',
      '/projects/{projectId}/payments',
      '/payments/{paymentId}/confirm',
      '/payments/{paymentId}/reject',
      '/projects/{projectId}/events',
      '/auth/policies',
      '/auth/consent',
      '/auth/logout',
      '/notifications/device',
      '/invitations/{invitationId}',
      '/projects/{projectId}/requests',
      '/project-requests/{requestId}/respond',
    ]);
  });

  test('operationId OpenAPI unik', () => {
    const operationIds = Object.values(openApiDocument.paths).flatMap((path) =>
      Object.values(path).map((operation) => operation.operationId),
    );

    expect(new Set(operationIds).size).toBe(operationIds.length);
  });
});
