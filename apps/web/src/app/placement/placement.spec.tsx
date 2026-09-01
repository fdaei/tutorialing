import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { LocaleProvider } from '@/components/shared/locale-provider';
import Placement from './page';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@/components/layout/site', () => ({
  Header: () => null,
  Footer: () => null,
}));
jest.mock('@/components/marketplace/cards', () => ({ CourseCard: () => null }));

const mockedUseQuery = jest.mocked(useQuery);

describe('placement entry route', () => {
  afterEach(() => mockedUseQuery.mockReset());

  it('localizes the English entry experience and lets the user retry language loading', () => {
    const refetchLanguages = jest.fn();
    mockedUseQuery.mockImplementation(
      (options: { queryKey: readonly unknown[] }) =>
        (options.queryKey[0] === 'educational-languages'
          ? { isLoading: false, isError: true, refetch: refetchLanguages }
          : { isLoading: false, isError: false, refetch: jest.fn() }) as never,
    );

    render(
      <LocaleProvider locale="en">
        <Placement />
      </LocaleProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Know your level. Start on the right path.' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the language list.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetchLanguages).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('زبان آزمون را انتخاب کنید')).not.toBeInTheDocument();
  });
});
