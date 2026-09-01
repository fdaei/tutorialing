import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { EducationalLanguage } from '@/features/languages';
import { TeacherLanguageFilter } from './teacher-language-filter';

const languages = [
  {
    id: 'language-1',
    code: 'en',
    nameFa: 'انگلیسی',
    nameEn: 'English',
    nativeName: 'English',
    direction: 'LTR',
    active: true,
    order: 1,
    proficiencySystem: 'CEFR',
  },
] satisfies EducationalLanguage[];

describe('TeacherLanguageFilter', () => {
  it('disables the filter while languages are unavailable', () => {
    const { rerender } = render(
      <TeacherLanguageFilter locale="fa" value="" loading languages={languages} error={false} onChange={jest.fn()} />,
    );
    expect(screen.getByRole('combobox', { name: 'زبان' })).toBeDisabled();

    rerender(
      <TeacherLanguageFilter locale="en" value="" loading={false} languages={languages} error onChange={jest.fn()} />,
    );
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Languages unavailable' })).toBeInTheDocument();
  });

  it('emits a selected live language', () => {
    const onChange = jest.fn();
    render(
      <TeacherLanguageFilter
        locale="en"
        value=""
        loading={false}
        languages={languages}
        error={false}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } });
    expect(onChange).toHaveBeenCalledWith('en');
  });
});
