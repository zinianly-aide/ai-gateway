import { prisma } from '../lib/prisma.js';

export class UsageRepo {
  async create(params: {
    userId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    requestId: string;
  }) {
    return prisma.usageRecord.create({
      data: params
    });
  }
}
