import { describe, expect, test } from 'bun:test';
import { ProjectRole } from '../../generated/prisma/enums';
import type { InvitationRepository } from './invitation.repository';
import {
  assertInvitationCanBeAccepted,
  type InvitationAcceptanceContext,
} from './invitation.rules';
import { createInvitationService } from './invitation.service';
import { hashInvitationToken } from './invitation.tokens';

const projectId = '6b79fc7b-2a72-49eb-99f6-184267581142';
const freelancerId = 'e48908f0-69f3-4da4-b9bd-3df4ac033f50';
const clientId = '81a16ed6-fe01-43da-a801-2f0fca97e0f2';
const now = new Date('2026-10-19T00:00:00.000Z');

function createRepositoryMock() {
  let createdInput: Parameters<InvitationRepository['create']>[0] | undefined;
  let acceptedInput: Parameters<InvitationRepository['accept']>[0] | undefined;
  let cancelledInput: Parameters<InvitationRepository['cancel']>[0] | undefined;

  const repository: InvitationRepository = {
    async getCreationContext() {
      return {
        projectId,
        creatorId: freelancerId,
        inviterRole: ProjectRole.FREELANCER,
        memberEmails: ['freelancer@example.com'],
        memberCount: 1,
      };
    },
    async create(input) {
      createdInput = input;
      return {
        id: '51eea5b8-4e23-4283-a975-54884d8b7321',
        projectId: input.projectId,
        targetEmail: input.targetEmail,
        expiresAt: input.expiresAt,
        createdAt: now,
      };
    },
    async listPending() {
      return { data: [], nextCursor: null };
    },
    async listByProject() {
      return { data: [], nextCursor: null };
    },
    async cancel(input) {
      cancelledInput = input;
      return {
        id: input.invitationId,
        projectId: input.projectId,
        cancelledAt: input.now,
      };
    },
    async requestRemoval(input) {
      return {
        invitationId: input.invitationId,
        projectId: input.projectId,
        projectTitle: 'Website',
        freelancerName: 'Freelancer',
        requestedAt: input.now,
      };
    },
    async listRemovalRequests() {
      return { data: [], nextCursor: null };
    },
    async respondRemoval(input) {
      return {
        invitationId: input.invitationId,
        projectId,
        status: input.decision,
        respondedAt: input.now,
      };
    },
    async accept(input) {
      acceptedInput = input;
      return {
        invitationId: '51eea5b8-4e23-4283-a975-54884d8b7321',
        projectId,
        role: ProjectRole.CLIENT,
        acceptedAt: input.now,
      };
    },
  };

  return {
    repository,
    getCreatedInput: () => createdInput,
    getAcceptedInput: () => acceptedInput,
    getCancelledInput: () => cancelledInput,
  };
}

describe('invitation service', () => {
  test('membuat token sekali pakai dan hanya menyimpan hash-nya', async () => {
    const mock = createRepositoryMock();
    const service = createInvitationService(mock.repository);

    const result = await service.create(
      freelancerId,
      projectId,
      { email: 'client@example.com' },
      now,
    );
    const stored = mock.getCreatedInput();

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stored?.tokenHash).toBe(hashInvitationToken(result.token));
    expect(stored?.tokenHash).not.toBe(result.token);
    expect(stored?.expiresAt.toISOString()).toBe('2026-10-21T00:00:00.000Z');
  });

  test('menolak undangan ketika proyek sudah memiliki dua anggota', async () => {
    const mock = createRepositoryMock();
    mock.repository.getCreationContext = async () => ({
      projectId,
      creatorId: freelancerId,
      inviterRole: ProjectRole.FREELANCER,
      memberEmails: ['freelancer@example.com', 'client@example.com'],
      memberCount: 2,
    });
    const service = createInvitationService(mock.repository);

    await expect(
      service.create(
        freelancerId,
        projectId,
        { email: 'other@example.com' },
        now,
      ),
    ).rejects.toMatchObject({ code: 'PROJECT_MEMBER_LIMIT_REACHED', status: 409 });
  });

  test('accept meneruskan hash token, bukan token mentah', async () => {
    const mock = createRepositoryMock();
    const service = createInvitationService(mock.repository);
    const token = 'a'.repeat(43);

    await service.accept(clientId, { token }, now);

    expect(mock.getAcceptedInput()).toEqual({
      userId: clientId,
      tokenHash: hashInvitationToken(token),
      now,
    });
  });

  test('accept internal meneruskan invitation ID tanpa token', async () => {
    const mock = createRepositoryMock();
    const service = createInvitationService(mock.repository);
    const invitationId = '51eea5b8-4e23-4283-a975-54884d8b7321';

    await service.acceptById(clientId, invitationId, now);

    expect(mock.getAcceptedInput()).toEqual({
      userId: clientId,
      invitationId,
      now,
    });
  });

  test('cancel meneruskan proyek, undangan, dan freelancer aktif', async () => {
    const mock = createRepositoryMock();
    const service = createInvitationService(mock.repository);
    const invitationId = '51eea5b8-4e23-4283-a975-54884d8b7321';

    await service.cancel(freelancerId, projectId, invitationId, now);

    expect(mock.getCancelledInput()).toEqual({
      inviterId: freelancerId,
      projectId,
      invitationId,
      now,
    });
  });
});

describe('invitation acceptance rules', () => {
  function validContext(): InvitationAcceptanceContext {
    return {
      invitation: {
        targetEmail: 'client@example.com',
        acceptedAt: null,
        cancelledAt: null,
        expiresAt: new Date('2026-10-20T00:00:00.000Z'),
        project: {
          creatorId: freelancerId,
          members: [{ userId: freelancerId }],
        },
      },
      user: {
        id: clientId,
        email: 'client@example.com',
        emailVerifiedAt: new Date('2026-10-18T00:00:00.000Z'),
      },
    };
  }

  test('menerima akun dengan email tujuan yang sama', () => {
    expect(() => assertInvitationCanBeAccepted(validContext(), now)).not.toThrow();
  });

  test('menerima akun yang emailnya belum diverifikasi selama alamatnya sama', () => {
    const context = validContext();
    context.user!.emailVerifiedAt = null;

    expect(() => assertInvitationCanBeAccepted(context, now)).not.toThrow();
  });

  test('menolak token kedaluwarsa, token terpakai, dan email berbeda', () => {
    const expired = validContext();
    expired.invitation!.expiresAt = now;
    expect(() => assertInvitationCanBeAccepted(expired, now)).toThrow();

    const used = validContext();
    used.invitation!.acceptedAt = new Date();
    expect(() => assertInvitationCanBeAccepted(used, now)).toThrow();

    const mismatch = validContext();
    mismatch.user!.email = 'other@example.com';
    expect(() => assertInvitationCanBeAccepted(mismatch, now)).toThrow();
  });
});
