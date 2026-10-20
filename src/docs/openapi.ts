const statusResponse = {
  type: 'object',
  required: ['data'],
  properties: {
    data: {
      type: 'object',
      required: ['status'],
      properties: { status: { type: 'string' } },
    },
  },
};

const errorResponse = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

const userResponse = {
  type: 'object',
  required: ['id', 'email', 'name', 'emailVerifiedAt', 'createdAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    emailVerifiedAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const authResponse = {
  type: 'object',
  required: ['data'],
  properties: {
    data: {
      type: 'object',
      required: ['user', 'accessToken', 'refreshToken', 'tokenType', 'expiresIn'],
      properties: {
        user: userResponse,
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        tokenType: { type: 'string', enum: ['Bearer'] },
        expiresIn: { type: 'integer', example: 900 },
      },
    },
  },
};

const projectResponse = {
  type: 'object',
  required: [
    'id',
    'title',
    'description',
    'creatorId',
    'status',
    'role',
    'activeAgreementVersionId',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    description: { type: 'string' },
    creatorId: { type: 'string', format: 'uuid' },
    status: {
      type: 'string',
      enum: ['DRAFT', 'ACTIVE', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
    },
    role: { type: 'string', enum: ['FREELANCER', 'CLIENT'] },
    activeAgreementVersionId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const createdInvitationResponse = {
  type: 'object',
  required: ['id', 'projectId', 'targetEmail', 'expiresAt', 'createdAt', 'token'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    projectId: { type: 'string', format: 'uuid' },
    targetEmail: { type: 'string', format: 'email' },
    expiresAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    token: {
      type: 'string',
      description: 'Token rahasia yang hanya dikembalikan saat undangan dibuat.',
    },
  },
};

const acceptedInvitationResponse = {
  type: 'object',
  required: ['invitationId', 'projectId', 'role', 'acceptedAt'],
  properties: {
    invitationId: { type: 'string', format: 'uuid' },
    projectId: { type: 'string', format: 'uuid' },
    role: { type: 'string', enum: ['CLIENT'] },
    acceptedAt: { type: 'string', format: 'date-time' },
  },
};

const agreementSnapshotRequest = {
  type: 'object',
  additionalProperties: false,
  required: [
    'scope',
    'deliverables',
    'amountRupiah',
    'deadline',
    'revisionLimit',
    'cancellationTerms',
    'ipTerms',
  ],
  properties: {
    scope: { type: 'string', minLength: 1, maxLength: 20_000 },
    deliverables: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      uniqueItems: true,
      items: { type: 'string', minLength: 1, maxLength: 500 },
    },
    amountRupiah: { type: 'string', pattern: '^\\d{1,18}$' },
    deadline: { type: 'string', format: 'date' },
    revisionLimit: { type: 'integer', minimum: 0, maximum: 100 },
    cancellationTerms: { type: 'string', minLength: 1, maxLength: 10_000 },
    ipTerms: { type: 'string', minLength: 1, maxLength: 10_000 },
  },
};

const agreementSnapshotExample = {
  scope: 'Website profil perusahaan',
  deliverables: ['Lima halaman responsif', 'Source code'],
  amountRupiah: '3000000',
  deadline: '2026-12-01',
  revisionLimit: 2,
  cancellationTerms: 'Pembatalan ditinjau berdasarkan pekerjaan yang selesai.',
  ipTerms: 'Hak penggunaan dan source code mengikuti kesepakatan.',
};

const agreementVersionResponse = {
  type: 'object',
  required: [
    'id',
    'projectId',
    'versionNumber',
    'status',
    ...agreementSnapshotRequest.required,
    'contentHash',
    'baseAgreementVersionId',
    'createdById',
    'rejectedById',
    'rejectionReason',
    'reviewedAt',
    'approvalCount',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    projectId: { type: 'string', format: 'uuid' },
    versionNumber: { type: 'integer', minimum: 1 },
    status: {
      type: 'string',
      enum: ['DRAFT', 'PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
    },
    ...agreementSnapshotRequest.properties,
    contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    baseAgreementVersionId: { type: 'string', format: 'uuid', nullable: true },
    createdById: { type: 'string', format: 'uuid' },
    rejectedById: { type: 'string', format: 'uuid', nullable: true },
    rejectionReason: { type: 'string', nullable: true },
    reviewedAt: { type: 'string', format: 'date-time', nullable: true },
    approvalCount: { type: 'integer', minimum: 0, maximum: 2 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const agreementVersionParameter = {
  name: 'versionId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const agreementActionResponses = (
  description: string,
  successStatus: '200' | '201' = '200',
) => ({
  [successStatus]: {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['data'],
          properties: { data: agreementVersionResponse },
        },
      },
    },
  },
  '401': {
    description: 'Sesi tidak valid',
    content: { 'application/json': { schema: errorResponse } },
  },
  '403': {
    description: 'Tidak memiliki izin',
    content: { 'application/json': { schema: errorResponse } },
  },
  '404': {
    description: 'Kesepakatan tidak ditemukan',
    content: { 'application/json': { schema: errorResponse } },
  },
  '409': {
    description: 'Konflik versi atau status',
    content: { 'application/json': { schema: errorResponse } },
  },
  '422': {
    description: 'Input tidak valid',
    content: { 'application/json': { schema: errorResponse } },
  },
  '429': {
    description: 'Terlalu banyak percobaan',
    content: { 'application/json': { schema: errorResponse } },
  },
});

const changeRequestResponse = {
  type: 'object',
  required: [
    'id', 'projectId', 'requestedById', 'reason', 'baseAgreementVersionId',
    'proposedVersionId', 'status', 'comparison', 'createdAt', 'updatedAt',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    projectId: { type: 'string', format: 'uuid' },
    requestedById: { type: 'string', format: 'uuid' },
    reason: { type: 'string' },
    baseAgreementVersionId: { type: 'string', format: 'uuid' },
    proposedVersionId: { type: 'string', format: 'uuid', nullable: true },
    status: { type: 'string', enum: ['REQUESTED', 'PROPOSED', 'ACCEPTED', 'REJECTED'] },
    comparison: {
      type: 'object',
      nullable: true,
      properties: {
        amountRupiah: {
          type: 'object',
          properties: {
            before: { type: 'string' }, after: { type: 'string' }, difference: { type: 'string' },
          },
        },
        deadline: {
          type: 'object',
          properties: { before: { type: 'string', format: 'date' }, after: { type: 'string', format: 'date' } },
        },
      },
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const fileResponse = {
  type: 'object',
  required: ['id', 'projectId', 'uploaderId', 'originalName', 'mimeType', 'size', 'checksum', 'status', 'createdAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    projectId: { type: 'string', format: 'uuid' },
    uploaderId: { type: 'string', format: 'uuid' },
    originalName: { type: 'string' },
    mimeType: { type: 'string', enum: ['application/pdf', 'image/jpeg', 'image/png'] },
    size: { type: 'integer', minimum: 1, maximum: 10_485_760 },
    checksum: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    status: { type: 'string', enum: ['READY', 'FAILED'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const deliveryResponse = {
  type: 'object',
  required: ['id', 'projectId', 'agreementVersionId', 'submittedById', 'note', 'links', 'status', 'submittedAt', 'reviewedAt', 'files', 'revisionRequest'],
  properties: {
    id: { type: 'string', format: 'uuid' }, projectId: { type: 'string', format: 'uuid' },
    agreementVersionId: { type: 'string', format: 'uuid' }, submittedById: { type: 'string', format: 'uuid' },
    note: { type: 'string' }, links: { type: 'array', items: { type: 'string', format: 'uri' } },
    status: { type: 'string', enum: ['PENDING', 'REVISION_REQUESTED', 'ACCEPTED'] },
    submittedAt: { type: 'string', format: 'date-time' }, reviewedAt: { type: 'string', format: 'date-time', nullable: true },
    files: { type: 'array', items: { type: 'object', required: ['id', 'originalName', 'mimeType', 'size', 'checksum'], properties: {
      id: { type: 'string', format: 'uuid' }, originalName: { type: 'string' }, mimeType: { type: 'string' },
      size: { type: 'integer' }, checksum: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    } } },
    revisionRequest: { type: 'object', nullable: true, properties: {
      id: { type: 'string', format: 'uuid' }, requestedById: { type: 'string', format: 'uuid' },
      reason: { type: 'string' }, roundNumber: { type: 'integer', minimum: 1 }, createdAt: { type: 'string', format: 'date-time' },
    } },
  },
};

const paymentResponse = {
  type: 'object', required: ['id', 'projectId', 'amountRupiah', 'submittedById', 'status', 'reviewedById', 'note', 'rejectionReason', 'reviewedAt', 'createdAt', 'files'],
  properties: {
    id: { type: 'string', format: 'uuid' }, projectId: { type: 'string', format: 'uuid' }, amountRupiah: { type: 'string' },
    submittedById: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'REJECTED'] },
    reviewedById: { type: 'string', format: 'uuid', nullable: true }, note: { type: 'string' }, rejectionReason: { type: 'string', nullable: true },
    reviewedAt: { type: 'string', format: 'date-time', nullable: true }, createdAt: { type: 'string', format: 'date-time' },
    files: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string', format: 'uuid' }, originalName: { type: 'string' }, mimeType: { type: 'string' }, size: { type: 'integer' }, checksum: { type: 'string' },
    } } },
  },
};
const paymentSummaryResponse = {
  type: 'object', required: ['agreementAmountRupiah', 'confirmedTotalRupiah', 'remainingRupiah', 'overpaymentRupiah', 'isPaid', 'isOverpaid'],
  properties: {
    agreementAmountRupiah: { type: 'string' }, confirmedTotalRupiah: { type: 'string' }, remainingRupiah: { type: 'string' },
    overpaymentRupiah: { type: 'string' }, isPaid: { type: 'boolean' }, isOverpaid: { type: 'boolean' },
  },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: { title: 'Accordia API', version: '0.1.0' },
  servers: [{ url: '/api/v1' }],
  components: {
    schemas: {
      Error: errorResponse,
      User: userResponse,
      AuthResponse: authResponse,
      Project: projectResponse,
      CreatedInvitation: createdInvitationResponse,
      AcceptedInvitation: acceptedInvitationResponse,
      AgreementVersion: agreementVersionResponse,
      ChangeRequest: changeRequestResponse,
      File: fileResponse,
      Delivery: deliveryResponse,
      Payment: paymentResponse,
      PaymentSummary: paymentSummaryResponse,
    },
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    '/health': {
      get: {
        operationId: 'getHealth',
        tags: ['System'],
        security: [],
        summary: 'Memeriksa proses API',
        responses: {
          '200': {
            description: 'API berjalan',
            content: {
              'application/json': {
                schema: statusResponse,
                example: { data: { status: 'ok' } },
              },
            },
          },
        },
      },
    },
    '/ready': {
      get: {
        operationId: 'getReadiness',
        tags: ['System'],
        security: [],
        summary: 'Memeriksa koneksi database',
        responses: {
          '200': {
            description: 'Database siap',
            content: {
              'application/json': {
                schema: statusResponse,
                example: { data: { status: 'ready' } },
              },
            },
          },
          '503': {
            description: 'Database belum siap',
            content: {
              'application/json': {
                schema: errorResponse,
                example: {
                  error: { code: 'NOT_READY', message: 'Database belum siap' },
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        operationId: 'register',
        tags: ['Auth'],
        security: [],
        summary: 'Mendaftarkan akun baru',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 100 },
                  email: { type: 'string', format: 'email', maxLength: 254 },
                  password: { type: 'string', minLength: 12, maxLength: 128 },
                },
              },
              example: {
                name: 'Budi Santoso',
                email: 'budi@example.com',
                password: 'contoh-password-kuat',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Akun dan sesi berhasil dibuat',
            content: { 'application/json': { schema: authResponse } },
          },
          '409': {
            description: 'Email sudah terdaftar',
            content: { 'application/json': { schema: errorResponse } },
          },
          '422': {
            description: 'Input tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
          '429': {
            description: 'Terlalu banyak percobaan',
            content: { 'application/json': { schema: errorResponse } },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        operationId: 'login',
        tags: ['Auth'],
        security: [],
        summary: 'Masuk menggunakan email dan password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', maxLength: 254 },
                  password: { type: 'string', minLength: 1, maxLength: 128 },
                },
              },
              example: {
                email: 'budi@example.com',
                password: 'contoh-password-kuat',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login berhasil',
            content: { 'application/json': { schema: authResponse } },
          },
          '401': {
            description: 'Kredensial salah',
            content: { 'application/json': { schema: errorResponse } },
          },
          '422': {
            description: 'Input tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
          '429': {
            description: 'Terlalu banyak percobaan',
            content: { 'application/json': { schema: errorResponse } },
          },
        },
      },
    },
    '/projects': {
      get: {
        operationId: 'listProjects',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        summary: 'Menampilkan proyek milik pengguna',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: 'cursor',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Daftar proyek pengguna',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data', 'nextCursor'],
                  properties: {
                    data: { type: 'array', items: projectResponse },
                    nextCursor: {
                      type: 'string',
                      format: 'uuid',
                      nullable: true,
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Sesi tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
          '422': {
            description: 'Query pagination tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
        },
      },
      post: {
        operationId: 'createProject',
        tags: ['Projects'],
        security: [{ bearerAuth: [] }],
        summary: 'Membuat proyek baru sebagai freelancer',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'description'],
                properties: {
                  title: { type: 'string', minLength: 3, maxLength: 160 },
                  description: { type: 'string', minLength: 1, maxLength: 5000 },
                },
              },
              example: {
                title: 'Website profil perusahaan',
                description: 'Pembuatan website profil perusahaan yang responsif.',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Proyek dan keanggotaan freelancer berhasil dibuat',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data'],
                  properties: { data: projectResponse },
                },
              },
            },
          },
          '401': {
            description: 'Sesi tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
          '422': {
            description: 'Input tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
        },
      },
    },
    '/projects/{projectId}/invitations': {
      post: {
        operationId: 'createInvitation',
        tags: ['Invitations'],
        security: [{ bearerAuth: [] }],
        summary: 'Mengundang klien ke proyek',
        description:
          'Token dikembalikan satu kali kepada freelancer untuk dikirim melalui kanal aman.',
        parameters: [
          {
            name: 'projectId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email', maxLength: 254 },
                },
              },
              example: { email: 'client@example.com' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Undangan berhasil dibuat dan berlaku selama 48 jam',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data'],
                  properties: { data: createdInvitationResponse },
                },
              },
            },
          },
          '401': {
            description: 'Sesi tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
          '403': {
            description: 'Bukan freelancer proyek',
            content: { 'application/json': { schema: errorResponse } },
          },
          '404': {
            description: 'Proyek tidak ditemukan',
            content: { 'application/json': { schema: errorResponse } },
          },
          '409': {
            description: 'Email sudah menjadi anggota atau proyek sudah penuh',
            content: { 'application/json': { schema: errorResponse } },
          },
          '422': {
            description: 'Input tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
          '429': {
            description: 'Terlalu banyak percobaan',
            content: { 'application/json': { schema: errorResponse } },
          },
        },
      },
    },
    '/invitations/accept': {
      post: {
        operationId: 'acceptInvitation',
        tags: ['Invitations'],
        security: [{ bearerAuth: [] }],
        summary: 'Menerima undangan sebagai klien',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['token'],
                properties: {
                  token: { type: 'string', minLength: 43, maxLength: 43 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Undangan diterima dan pengguna menjadi klien',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data'],
                  properties: { data: acceptedInvitationResponse },
                },
              },
            },
          },
          '401': {
            description: 'Sesi tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
          '403': {
            description: 'Email belum diverifikasi atau tidak sesuai',
            content: { 'application/json': { schema: errorResponse } },
          },
          '404': {
            description: 'Undangan tidak ditemukan',
            content: { 'application/json': { schema: errorResponse } },
          },
          '409': {
            description: 'Undangan expired/terpakai atau proyek sudah penuh',
            content: { 'application/json': { schema: errorResponse } },
          },
          '422': {
            description: 'Token tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
          '429': {
            description: 'Terlalu banyak percobaan',
            content: { 'application/json': { schema: errorResponse } },
          },
        },
      },
    },
    '/projects/{projectId}/agreement-versions': {
      get: {
        operationId: 'listAgreementVersions',
        tags: ['Agreements'],
        security: [{ bearerAuth: [] }],
        summary: 'Menampilkan histori versi kesepakatan',
        parameters: [
          {
            name: 'projectId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: 'cursor',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Histori kesepakatan',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data', 'nextCursor'],
                  properties: {
                    data: { type: 'array', items: agreementVersionResponse },
                    nextCursor: {
                      type: 'string',
                      format: 'uuid',
                      nullable: true,
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Sesi tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
          '404': {
            description: 'Proyek tidak ditemukan atau bukan anggota',
            content: { 'application/json': { schema: errorResponse } },
          },
          '422': {
            description: 'Pagination tidak valid',
            content: { 'application/json': { schema: errorResponse } },
          },
        },
      },
      post: {
        operationId: 'createAgreementVersion',
        tags: ['Agreements'],
        security: [{ bearerAuth: [] }],
        summary: 'Membuat draft kesepakatan baru',
        parameters: [
          {
            name: 'projectId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                ...agreementSnapshotRequest,
                properties: {
                  ...agreementSnapshotRequest.properties,
                  changeRequestId: { type: 'string', format: 'uuid' },
                },
              },
              example: agreementSnapshotExample,
            },
          },
        },
        responses: agreementActionResponses(
          'Draft kesepakatan berhasil dibuat',
          '201',
        ),
      },
    },
    '/agreement-versions/{versionId}': {
      patch: {
        operationId: 'updateAgreementVersion',
        tags: ['Agreements'],
        security: [{ bearerAuth: [] }],
        summary: 'Mengubah draft kesepakatan',
        parameters: [agreementVersionParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                ...agreementSnapshotRequest,
                required: [],
                minProperties: 1,
              },
              example: { amountRupiah: '3500000', revisionLimit: 3 },
            },
          },
        },
        responses: agreementActionResponses('Draft berhasil diperbarui'),
      },
    },
    '/agreement-versions/{versionId}/submit': {
      post: {
        operationId: 'submitAgreementVersion',
        tags: ['Agreements'],
        security: [{ bearerAuth: [] }],
        summary: 'Mengajukan draft untuk persetujuan',
        parameters: [agreementVersionParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['expectedActiveVersionId'],
                properties: {
                  expectedActiveVersionId: {
                    type: 'string',
                    format: 'uuid',
                    nullable: true,
                  },
                },
              },
              example: { expectedActiveVersionId: null },
            },
          },
        },
        responses: agreementActionResponses('Kesepakatan menunggu persetujuan'),
      },
    },
    '/agreement-versions/{versionId}/approve': {
      post: {
        operationId: 'approveAgreementVersion',
        tags: ['Agreements'],
        security: [{ bearerAuth: [] }],
        summary: 'Menyetujui snapshot kesepakatan',
        parameters: [agreementVersionParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['contentHash'],
                properties: {
                  contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
                },
              },
              example: { contentHash: 'a'.repeat(64) },
            },
          },
        },
        responses: agreementActionResponses('Persetujuan berhasil dicatat'),
      },
    },
    '/agreement-versions/{versionId}/reject': {
      post: {
        operationId: 'rejectAgreementVersion',
        tags: ['Agreements'],
        security: [{ bearerAuth: [] }],
        summary: 'Menolak kesepakatan pending',
        parameters: [agreementVersionParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['reason'],
                properties: {
                  reason: { type: 'string', minLength: 3, maxLength: 2_000 },
                },
              },
              example: { reason: 'Deadline perlu disesuaikan.' },
            },
          },
        },
        responses: agreementActionResponses('Kesepakatan ditolak'),
      },
    },
    '/projects/{projectId}/change-requests': {
      get: {
        operationId: 'listChangeRequests',
        tags: ['Changes'],
        security: [{ bearerAuth: [] }],
        summary: 'Menampilkan permintaan perubahan proyek',
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'cursor', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Daftar permintaan perubahan',
            content: { 'application/json': { schema: {
              type: 'object', required: ['data', 'nextCursor'],
              properties: {
                data: { type: 'array', items: changeRequestResponse },
                nextCursor: { type: 'string', format: 'uuid', nullable: true },
              },
            } } },
          },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Proyek tidak ditemukan', content: { 'application/json': { schema: errorResponse } } },
          '422': { description: 'Pagination tidak valid', content: { 'application/json': { schema: errorResponse } } },
        },
      },
      post: {
        operationId: 'createChangeRequest',
        tags: ['Changes'],
        security: [{ bearerAuth: [] }],
        summary: 'Meminta perubahan kesepakatan aktif',
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': {
            schema: {
              type: 'object', additionalProperties: false,
              required: ['reason', 'expectedActiveVersionId'],
              properties: {
                reason: { type: 'string', minLength: 3, maxLength: 5_000 },
                expectedActiveVersionId: { type: 'string', format: 'uuid' },
              },
            },
          } },
        },
        responses: {
          '201': { description: 'Permintaan perubahan dibuat', content: { 'application/json': { schema: { type: 'object', properties: { data: changeRequestResponse } } } } },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '403': { description: 'Hanya klien yang diizinkan', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Proyek tidak ditemukan', content: { 'application/json': { schema: errorResponse } } },
          '409': { description: 'Versi aktif telah berubah', content: { 'application/json': { schema: errorResponse } } },
          '422': { description: 'Input tidak valid', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/projects/{projectId}/files': {
      post: {
        operationId: 'uploadProjectFiles',
        tags: ['Files'],
        security: [{ bearerAuth: [] }],
        summary: 'Mengunggah file privat proyek',
        description: 'Maksimal 5 file per request dan 10 MiB per file. Format yang diterima: PDF, JPEG, PNG.',
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: {
            type: 'object', required: ['files'],
            properties: { files: { type: 'array', maxItems: 5, items: { type: 'string', format: 'binary' } } },
          } } },
        },
        responses: {
          '201': { description: 'File tervalidasi dan disimpan', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: fileResponse } } } } } },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Proyek tidak ditemukan', content: { 'application/json': { schema: errorResponse } } },
          '413': { description: 'File melebihi 10 MiB', content: { 'application/json': { schema: errorResponse } } },
          '415': { description: 'Content-Type bukan multipart', content: { 'application/json': { schema: errorResponse } } },
          '422': { description: 'Jumlah atau tipe file tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '429': { description: 'Terlalu banyak upload', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/files/{fileId}/download': {
      get: {
        operationId: 'downloadPrivateFile',
        tags: ['Files'],
        security: [{ bearerAuth: [] }],
        summary: 'Mengunduh file privat sebagai attachment',
        parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Stream file privat', headers: { 'Content-Disposition': { schema: { type: 'string' } } }, content: {
            'application/pdf': { schema: { type: 'string', format: 'binary' } },
            'image/jpeg': { schema: { type: 'string', format: 'binary' } },
            'image/png': { schema: { type: 'string', format: 'binary' } },
          } },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'File tidak ditemukan atau bukan anggota proyek', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/projects/{projectId}/deliveries': {
      get: {
        operationId: 'listDeliveries', tags: ['Deliveries'], security: [{ bearerAuth: [] }],
        summary: 'Menampilkan histori penyerahan',
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'cursor', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Histori penyerahan', content: { 'application/json': { schema: { type: 'object', properties: {
            data: { type: 'array', items: deliveryResponse }, nextCursor: { type: 'string', format: 'uuid', nullable: true },
          } } } } },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Proyek tidak ditemukan', content: { 'application/json': { schema: errorResponse } } },
        },
      },
      post: {
        operationId: 'createDelivery', tags: ['Deliveries'], security: [{ bearerAuth: [] }],
        summary: 'Menyerahkan hasil untuk kesepakatan aktif',
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', additionalProperties: false, required: ['agreementVersionId'],
          properties: {
            agreementVersionId: { type: 'string', format: 'uuid' }, note: { type: 'string', maxLength: 5_000 },
            fileIds: { type: 'array', maxItems: 5, uniqueItems: true, items: { type: 'string', format: 'uuid' } },
            links: { type: 'array', maxItems: 10, uniqueItems: true, items: { type: 'string', format: 'uri' } },
          },
        } } } },
        responses: {
          '201': { description: 'Penyerahan dibuat', content: { 'application/json': { schema: { type: 'object', properties: { data: deliveryResponse } } } } },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '403': { description: 'Hanya freelancer yang diizinkan', content: { 'application/json': { schema: errorResponse } } },
          '409': { description: 'Versi/status/pending delivery konflik', content: { 'application/json': { schema: errorResponse } } },
          '422': { description: 'Input atau file tidak valid', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/deliveries/{deliveryId}/accept': {
      post: {
        operationId: 'acceptDelivery', tags: ['Deliveries'], security: [{ bearerAuth: [] }], summary: 'Menerima hasil penyerahan',
        parameters: [{ name: 'deliveryId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Hasil diterima', content: { 'application/json': { schema: { type: 'object', properties: { data: deliveryResponse } } } } },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '403': { description: 'Hanya klien yang diizinkan', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Penyerahan tidak ditemukan', content: { 'application/json': { schema: errorResponse } } },
          '409': { description: 'Status telah berubah', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/deliveries/{deliveryId}/request-revision': {
      post: {
        operationId: 'requestDeliveryRevision', tags: ['Deliveries'], security: [{ bearerAuth: [] }], summary: 'Meminta satu putaran revisi',
        parameters: [{ name: 'deliveryId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', additionalProperties: false, required: ['reason'], properties: { reason: { type: 'string', minLength: 3, maxLength: 5_000 } },
        } } } },
        responses: {
          '200': { description: 'Putaran revisi dicatat', content: { 'application/json': { schema: { type: 'object', properties: { data: deliveryResponse } } } } },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '403': { description: 'Hanya klien yang diizinkan', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Penyerahan tidak ditemukan', content: { 'application/json': { schema: errorResponse } } },
          '409': { description: 'Status konflik atau batas revisi habis', content: { 'application/json': { schema: errorResponse } } },
          '422': { description: 'Input tidak valid', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/projects/{projectId}/payments': {
      get: {
        operationId: 'listPayments', tags: ['Payments'], security: [{ bearerAuth: [] }], summary: 'Menampilkan pembayaran dan total terkonfirmasi',
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'cursor', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Daftar pembayaran', content: { 'application/json': { schema: { type: 'object', properties: {
            data: { type: 'array', items: paymentResponse }, nextCursor: { type: 'string', format: 'uuid', nullable: true }, paymentSummary: paymentSummaryResponse,
          } } } } },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Proyek tidak ditemukan', content: { 'application/json': { schema: errorResponse } } },
        },
      },
      post: {
        operationId: 'createPayment', tags: ['Payments'], security: [{ bearerAuth: [] }], summary: 'Mengirim bukti pembayaran berstatus pending',
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', additionalProperties: false, required: ['amountRupiah', 'fileIds'], properties: {
            amountRupiah: { type: 'string', pattern: '^\\d{1,18}$' },
            fileIds: { type: 'array', minItems: 1, maxItems: 5, uniqueItems: true, items: { type: 'string', format: 'uuid' } },
            note: { type: 'string', maxLength: 5_000 },
          },
        } } } },
        responses: {
          '201': { description: 'Pembayaran pending dibuat', content: { 'application/json': { schema: { type: 'object', properties: { data: paymentResponse, paymentSummary: paymentSummaryResponse } } } } },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '403': { description: 'Hanya klien yang diizinkan', content: { 'application/json': { schema: errorResponse } } },
          '409': { description: 'Status proyek atau file konflik', content: { 'application/json': { schema: errorResponse } } },
          '422': { description: 'Nominal atau bukti tidak valid', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/payments/{paymentId}/confirm': {
      post: {
        operationId: 'confirmPayment', tags: ['Payments'], security: [{ bearerAuth: [] }], summary: 'Mengonfirmasi pembayaran',
        parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Pembayaran dikonfirmasi', content: { 'application/json': { schema: { type: 'object', properties: { data: paymentResponse, paymentSummary: paymentSummaryResponse } } } } },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '403': { description: 'Hanya freelancer yang diizinkan', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Pembayaran tidak ditemukan', content: { 'application/json': { schema: errorResponse } } },
          '409': { description: 'Status pembayaran konflik', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/payments/{paymentId}/reject': {
      post: {
        operationId: 'rejectPayment', tags: ['Payments'], security: [{ bearerAuth: [] }], summary: 'Menolak pembayaran',
        parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', additionalProperties: false, required: ['reason'], properties: { reason: { type: 'string', minLength: 3, maxLength: 2_000 } },
        } } } },
        responses: {
          '200': { description: 'Pembayaran ditolak', content: { 'application/json': { schema: { type: 'object', properties: { data: paymentResponse, paymentSummary: paymentSummaryResponse } } } } },
          '401': { description: 'Sesi tidak valid', content: { 'application/json': { schema: errorResponse } } },
          '403': { description: 'Hanya freelancer yang diizinkan', content: { 'application/json': { schema: errorResponse } } },
          '404': { description: 'Pembayaran tidak ditemukan', content: { 'application/json': { schema: errorResponse } } },
          '409': { description: 'Status pembayaran konflik', content: { 'application/json': { schema: errorResponse } } },
          '422': { description: 'Alasan tidak valid', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
  },
};
