import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
  let service: ReviewService;

  const prismaMock = {
    transaction: { findUnique: jest.fn(), count: jest.fn() },
    review: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const baseTransaction = {
    id: 'tx1',
    senderId: 'sender1',
    travelerId: 'traveler1',
    status: TransactionStatus.DELIVERED,
    deliveryConfirmedAt: new Date('2026-05-23T09:00:00Z'),
  };

  const baseReview = {
    id: 'rev1',
    transactionId: 'tx1',
    reviewerId: 'sender1',
    revieweeId: 'traveler1',
    role: 'SENDER',
    rating: 5,
    comment: null,
    createdAt: new Date('2026-05-23T10:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReviewService(prismaMock as any);

    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });
  });

  describe('createReview', () => {
    it('creates a review from the sender perspective', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(baseTransaction);
      prismaMock.review.findUnique.mockResolvedValue(null);
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        prismaMock.review.create.mockResolvedValue(baseReview);
        prismaMock.review.aggregate.mockResolvedValue({
          _avg: { rating: 5 },
          _count: { id: 1 },
        });
        prismaMock.user.update.mockResolvedValue({});
        return fn({
          review: prismaMock.review,
          user: prismaMock.user,
        });
      });

      const result = await service.createReview('sender1', {
        transactionId: 'tx1',
        rating: 5,
      });

      expect(result.role).toBe('SENDER');
      expect(result.revieweeId).toBe('traveler1');
      expect(result.rating).toBe(5);
    });

    it('creates a review from the traveler perspective', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(baseTransaction);
      prismaMock.review.findUnique.mockResolvedValue(null);

      const travelerReview = { ...baseReview, reviewerId: 'traveler1', revieweeId: 'sender1', role: 'TRAVELER' };
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        prismaMock.review.create.mockResolvedValue(travelerReview);
        prismaMock.review.aggregate.mockResolvedValue({
          _avg: { rating: 4 },
          _count: { id: 2 },
        });
        prismaMock.user.update.mockResolvedValue({});
        return fn({
          review: prismaMock.review,
          user: prismaMock.user,
        });
      });

      const result = await service.createReview('traveler1', {
        transactionId: 'tx1',
        rating: 4,
      });

      expect(result.role).toBe('TRAVELER');
      expect(result.revieweeId).toBe('sender1');
    });

    it('throws NotFoundException when transaction not found', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.createReview('sender1', { transactionId: 'unknown', rating: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when transaction is not DELIVERED', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        ...baseTransaction,
        status: TransactionStatus.IN_TRANSIT,
      });

      await expect(
        service.createReview('sender1', { transactionId: 'tx1', rating: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when reviewer is not a party', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(baseTransaction);

      await expect(
        service.createReview('outsider', { transactionId: 'tx1', rating: 5 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when review already exists', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(baseTransaction);
      prismaMock.review.findUnique.mockResolvedValue(baseReview);

      await expect(
        service.createReview('sender1', { transactionId: 'tx1', rating: 4 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getReviewsByUser', () => {
    it('returns reviews for existing user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'traveler1' });
      prismaMock.review.findMany.mockResolvedValue([baseReview]);

      const result = await service.getReviewsByUser('traveler1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('rev1');
    });

    it('throws NotFoundException for unknown user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getReviewsByUser('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyReviews', () => {
    it('returns received reviews for authenticated user', async () => {
      prismaMock.review.findMany.mockResolvedValue([baseReview]);

      const result = await service.getMyReviews('traveler1');

      expect(result).toHaveLength(1);
    });
  });

  describe('createReview — delivery gate', () => {
    it('throws BadRequestException when deliveryConfirmedAt is null', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        id: 'tx1',
        deliveryConfirmedAt: null,
        senderId: 'u1',
        travelerId: 'u2',
        status: TransactionStatus.IN_TRANSIT,
      });

      await expect(
        service.createReview('u1', {
          transactionId: 'tx1',
          rating: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when reviewer is not a participant', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        id: 'tx1',
        deliveryConfirmedAt: new Date(),
        senderId: 'u1',
        travelerId: 'u2',
        status: TransactionStatus.DELIVERED,
      });

      await expect(
        service.createReview('u-stranger', {
          transactionId: 'tx1',
          rating: 4,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown transaction', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.createReview('u1', {
          transactionId: 'bad-tx',
          rating: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getReviewSummary', () => {
    it('returns null averageRating when no reviews', async () => {
      prismaMock.review.findMany.mockResolvedValue([]);
      prismaMock.transaction.count.mockResolvedValue(0);

      const result = await service.getReviewSummary('u1');
      expect(result.averageRating).toBeNull();
      expect(result.reviewCount).toBe(0);
    });

    it('computes correct averageRating', async () => {
      prismaMock.review.findMany.mockResolvedValue([
        { rating: 4 }, { rating: 5 }, { rating: 3 },
      ]);
      prismaMock.transaction.count.mockResolvedValue(8);

      const result = await service.getReviewSummary('u1');
      expect(result.averageRating).toBe(4);
      expect(result.reviewCount).toBe(3);
      expect(result.deliveriesCount).toBe(8);
    });
  });
});
