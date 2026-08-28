import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { api } from '@/shared/services/api';
import { LocaleProvider } from '@/components/shared/locale-provider';
import { PanelActions } from './panel-actions';
import { uploadPanelFile } from '../services/upload-panel-file';

jest.mock('@/shared/services/api', () => ({
  api: jest.fn(),
  ApiError: class ApiError extends Error {},
  apiMessage: (_error: unknown, fallback: string) => fallback,
}));
jest.mock('../services/upload-panel-file', () => ({ uploadPanelFile: jest.fn() }));

const mockedApi = jest.mocked(api);
const mockedUploadPanelFile = jest.mocked(uploadPanelFile);

function renderAction(role: 'student' | 'teacher' | 'admin', section: string, endpoint = '/resource') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <LocaleProvider locale="fa">
      <QueryClientProvider client={client}>
        <PanelActions role={role} section={section} endpoint={endpoint} />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

function field(form: HTMLFormElement, name: string): Element {
  const control = form.elements.namedItem(name);
  if (!(control instanceof Element)) throw new Error(`Expected form control: ${name}`);
  return control;
}

describe('PanelActions characterization', () => {
  beforeEach(() => {
    mockedApi.mockResolvedValue([]);
    mockedUploadPanelFile.mockResolvedValue('file-1');
  });

  afterEach(() => {
    mockedApi.mockReset();
    mockedUploadPanelFile.mockReset();
  });

  it('dispatches student profile and preserves its payload', async () => {
    const view = renderAction('student', 'profile', '/users/me');
    const form = view.container.querySelector('form');
    if (!form) throw new Error('Expected student profile form');
    fireEvent.change(field(form, 'name'), { target: { value: 'Sara' } });
    fireEvent.change(field(form, 'email'), { target: { value: 'sara@example.com' } });
    fireEvent.change(field(form, 'locale'), { target: { value: 'en' } });
    fireEvent.submit(form);
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith('/users/me', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Sara', email: 'sara@example.com', locale: 'en', timezone: 'Asia/Tehran' }),
      }),
    );
  });

  it('dispatches teacher availability and preserves weekly-rule payload', async () => {
    const view = renderAction('teacher', 'availability', '/availability/me');
    const form = view.container.querySelector('form');
    if (!form) throw new Error('Expected teacher availability form');
    fireEvent.submit(form);
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith('/availability/me/rules', {
        method: 'PUT',
        body: JSON.stringify({
          rules: [{ weekday: 6, startMinute: 540, endMinute: 1020, timezone: 'Asia/Tehran' }],
        }),
      }),
    );
  });

  it('dispatches admin settings and preserves setting payload', async () => {
    const view = renderAction('admin', 'settings', '/admin/settings');
    const form = view.container.querySelector('form');
    if (!form) throw new Error('Expected admin setting form');
    fireEvent.change(field(form, 'key'), { target: { value: 'site.title' } });
    fireEvent.change(field(form, 'settingValue'), { target: { value: 'LingoSpeak' } });
    fireEvent.submit(form);
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith('/admin/settings/site.title', {
        method: 'PUT',
        body: JSON.stringify({ value: { value: 'LingoSpeak' }, public: false }),
      }),
    );
  });

  it('keeps the submit action disabled while a student mutation is pending', async () => {
    mockedApi.mockImplementation(() => new Promise(() => undefined));
    const view = renderAction('student', 'profile', '/users/me');
    const form = view.container.querySelector('form');
    if (!form) throw new Error('Expected student profile form');
    fireEvent.change(field(form, 'name'), { target: { value: 'Sara' } });
    fireEvent.submit(form);
    const submit = form.querySelector('button');
    if (!submit) throw new Error('Expected submit button');
    await waitFor(() => expect(submit).toBeDisabled());
  });

  it('preserves the visible error state after an API failure', async () => {
    mockedApi.mockRejectedValueOnce(new Error('request failed'));
    const view = renderAction('student', 'profile', '/users/me');
    const form = view.container.querySelector('form');
    if (!form) throw new Error('Expected student profile form');
    fireEvent.change(field(form, 'name'), { target: { value: 'Sara' } });
    fireEvent.submit(form);
    await waitFor(() => expect(view.getByRole('alert')).toBeInTheDocument());
  });

  it('uploads a teacher intro video before attaching its file id', async () => {
    const view = renderAction('teacher', 'video', '/teacher/application');
    const form = view.container.querySelector('form');
    const input = form?.querySelector('input[type="file"]');
    if (!form || !(input instanceof HTMLInputElement)) throw new Error('Expected teacher video form');
    const file = new File(['video'], 'intro.webm', { type: 'video/webm' });
    const BrowserFormData = globalThis.FormData;
    globalThis.FormData = class TestFormData extends BrowserFormData {
      get(name: string) {
        return name === 'file' ? file : super.get(name);
      }
    };
    try {
      fireEvent.submit(form);
      await waitFor(() => expect(mockedUploadPanelFile).toHaveBeenCalledWith(file, 'teacher-intro-video', true));
      await waitFor(() =>
        expect(mockedApi).toHaveBeenCalledWith('/teacher/profile/intro-video', {
          method: 'PUT',
          body: JSON.stringify({ fileId: 'file-1' }),
        }),
      );
      expect(mockedUploadPanelFile.mock.invocationCallOrder[0]).toBeLessThan(
        mockedApi.mock.invocationCallOrder.at(-1) ?? Number.POSITIVE_INFINITY,
      );
    } finally {
      globalThis.FormData = BrowserFormData;
    }
  });

  it('renders no action for unsupported sections', () => {
    const view = renderAction('student', 'unknown');
    expect(view.container).toBeEmptyDOMElement();
  });
});
