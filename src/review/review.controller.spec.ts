import { UnauthorizedException } from '@nestjs/common';
import { ReviewController } from './review.controller';

describe('ReviewController', () => {
  let controller: ReviewController;

  const mockService = {
    createReview: jest.fn(),
    getMyReviews: jest.fn(),
    getReviewsByUser: jest.fn(),
  };

  const mockReview = {
    id: 'rev1',
    transactionId: 'tx1',
    reviewerId: 'user1',
    revieweeId: 'user2',
    role: 'SENDER',
    rating: 5,
    comment: null,
    createdAt: new Date('2026-05-23T10:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ReviewController(mockService as any);
  });

  it('createReview delegates to service', async () => {
    mockService.createReview.mockResolvedValue(mockReview);
    const req = { user: { userId: 'user1' } };

    const result = await controller.createReview(
      { transactionId: 'tx1', rating: 5 },
      req,
    );

    expect(mockService.createReview).toHaveBeenCalledWith('user1', {
      transactionId: 'tx1',
      rating: 5,
    });
    expect(result.id).toBe('rev1');
  });

  it('createReview throws UnauthorizedException when no user', async () => {
    const req = { user: {} };

    await expect(
      controller.createReview({ transactionId: 'tx1', rating: 5 }, req),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('getMyReviews delegates to service', async () => {
    mockService.getMyReviews.mockResolvedValue([mockReview]);
    const req = { user: { userId: 'user1' } };

    const result = await controller.getMyReviews(req);

    expect(mockService.getMyReviews).toHaveBeenCalledWith('user1');
    expect(result).toHaveLength(1);
  });

  it('getReviewsByUser delegates to service', async () => {
    mockService.getReviewsByUser.mockResolvedValue([mockReview]);

    const result = await controller.getReviewsByUser('user2');

    expect(mockService.getReviewsByUser).toHaveBeenCalledWith('user2');
    expect(result).toHaveLength(1);
  });
});
