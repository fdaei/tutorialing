import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import { CheckoutLoadError } from './checkout-load-error';

describe('checkout failure states', () => {
  it.each([
    ['fa', 'درخواست انجام نشد. لطفاً دوباره تلاش کنید.'],
    ['en', 'The request could not be completed. Please try again.'],
  ] as const)('shows a localized account retry state in %s', (locale, message) => {
    const retry = jest.fn();
    const view = render(<CheckoutLoadError locale={locale} onRetry={retry} />);

    expect(view.getByRole('alert')).toHaveTextContent(message);
    fireEvent.click(view.getByRole('button'));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
