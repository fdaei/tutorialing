import { releaseDiscount } from './discount-reservation';

describe('releaseDiscount', () => {
  const tx = () => ({ discount: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } });

  it('gives back one use of the reserved discount', async () => {
    const client = tx();
    await releaseDiscount(client as never, 'discount-1');
    expect(client.discount.updateMany).toHaveBeenCalledWith({
      // The `gt: 0` filter is the floor that stops a stray release driving the
      // counter negative and handing out unlimited redemptions.
      where: { id: 'discount-1', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });

  it('does nothing when the payment reserved no discount', async () => {
    const client = tx();
    await releaseDiscount(client as never, null);
    expect(client.discount.updateMany).not.toHaveBeenCalled();
  });
});
