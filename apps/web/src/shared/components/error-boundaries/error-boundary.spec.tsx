import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppErrorBoundary, FeatureErrorBoundary, RouteErrorFallback } from './index';
import { LocaleProvider } from '@/components/shared/locale-provider';

function Broken({ fail = true }: { fail?: boolean }) {
  if (fail) throw new Error('sensitive implementation detail');
  return <span>healthy widget</span>;
}

describe('error boundaries', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  it('isolates a failed feature from its siblings', () => {
    render(
      <main>
        <nav>navigation remains</nav>
        <FeatureErrorBoundary name="wallet-widget">
          <Broken />
        </FeatureErrorBoundary>
      </main>,
    );
    expect(screen.getByText('navigation remains')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('sensitive implementation detail')).not.toBeInTheDocument();
  });

  it('catches unhandled client rendering errors at app level', () => {
    render(
      <AppErrorBoundary>
        <Broken />
      </AppErrorBoundary>,
    );
    expect(screen.getByText('این بخش موقتاً در دسترس نیست')).toBeInTheDocument();
  });

  it('lets a route retry through the Next reset callback', () => {
    const reset = jest.fn();
    render(<RouteErrorFallback error={new Error('route failed')} reset={reset} name="test-route" />);
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('uses the active English locale for route recovery', () => {
    render(
      <LocaleProvider locale="en">
        <RouteErrorFallback error={new Error('private failure')} reset={jest.fn()} name="english-route" />
      </LocaleProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('This section is temporarily unavailable');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('private failure')).not.toBeInTheDocument();
  });
});
