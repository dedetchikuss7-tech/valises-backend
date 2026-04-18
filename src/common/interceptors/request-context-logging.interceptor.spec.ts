import { of, throwError } from 'rxjs';
import { ExecutionContext } from '@nestjs/common';
import { RequestContextLoggingInterceptor } from './request-context-logging.interceptor';

describe('RequestContextLoggingInterceptor', () => {
  let interceptor: RequestContextLoggingInterceptor;

  beforeEach(() => {
    interceptor = new RequestContextLoggingInterceptor();
  });

  it('sets x-request-id header and forwards successful requests', (done) => {
    const setHeader = jest.fn();

    const context = {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => ({
          method: 'GET',
          url: '/ops/healthz',
          headers: {},
        }),
        getResponse: () => ({
          statusCode: 200,
          setHeader,
        }),
      }),
    } as unknown as ExecutionContext;

    const next = {
      handle: jest.fn().mockReturnValue(of({ ok: true })),
    };

    interceptor.intercept(context, next as any).subscribe({
      next: (value) => {
        expect(value).toEqual({ ok: true });
        expect(setHeader).toHaveBeenCalledWith(
          'x-request-id',
          expect.any(String),
        );
      },
      complete: () => done(),
    });
  });

  it('keeps propagating errors', (done) => {
    const setHeader = jest.fn();

    const context = {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => ({
          method: 'GET',
          url: '/ops/readyz',
          headers: {},
        }),
        getResponse: () => ({
          statusCode: 500,
          setHeader,
        }),
      }),
    } as unknown as ExecutionContext;

    const next = {
      handle: jest.fn().mockReturnValue(throwError(() => new Error('boom'))),
    };

    interceptor.intercept(context, next as any).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('boom');
        expect(setHeader).toHaveBeenCalledWith(
          'x-request-id',
          expect.any(String),
        );
        done();
      },
    });
  });
});