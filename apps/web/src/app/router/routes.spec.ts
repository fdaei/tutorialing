import { routeConfig, routes, routeTo } from './index';

describe('route registry', () => {
  it('keeps configured paths canonical and absolute', () => {
    expect(Object.values(routeConfig).every(({ path }) => path.startsWith('/'))).toBe(true);
    expect(new Set(Object.values(routes)).size).toBe(Object.values(routes).length);
  });

  it('encodes dynamic route segments', () => {
    expect(routeTo.teacher('ali/reza')).toBe('/teachers/ali%2Freza');
    expect(routeTo.blogPost('hello world')).toBe('/blog/hello%20world');
  });

  it('builds query strings without undefined values', () => {
    expect(routeTo.withQuery(routes.auth, { next: '/dashboard/classes', source: undefined })).toBe(
      '/auth?next=%2Fdashboard%2Fclasses',
    );
  });
});
