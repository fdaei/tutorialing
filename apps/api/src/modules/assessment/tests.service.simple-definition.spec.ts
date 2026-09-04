import { HttpException } from '@nestjs/common';
import { TestsService } from './tests.service';

/**
 * The simple builder rejected every payload the admin UI sent, because the UI
 * never collected an educational language. The 400 carried a bare
 * FIELD_REQUIRED with an empty `fieldErrors`, so the response named no field
 * and the operator had nothing to act on.
 */
describe('TestsService.createSimpleDefinition validation', () => {
  const body = (error: unknown) => (error as HttpException).getResponse() as Record<string, unknown>;

  function service(language: unknown = { id: 'lang-en', active: true }) {
    const create = jest.fn().mockResolvedValue({ id: 'test-1' });
    const db = {
      language: { findFirst: jest.fn().mockResolvedValue(language) },
      testDefinition: { create },
    };
    return { svc: new TestsService(db as never, {} as never), db, create };
  }

  it('names the missing educational language instead of a bare FIELD_REQUIRED', async () => {
    const { svc, db } = service();

    const error = await svc
      .createSimpleDefinition({ titleFa: 'تست', titleEn: 'tes', durationMinutes: 169 })
      .catch((caught: unknown) => caught);

    expect(body(error)).toMatchObject({
      code: 'TEST_LANGUAGE_REQUIRED',
      fieldErrors: { languageId: 'TEST_LANGUAGE_REQUIRED' },
    });
    // Validation must not have cost a database round-trip.
    expect(db.language.findFirst).not.toHaveBeenCalled();
  });

  it('names whichever other field is missing', async () => {
    const { svc } = service();

    const error = await svc
      .createSimpleDefinition({ languageId: 'lang-en', titleEn: 'tes' })
      .catch((caught: unknown) => caught);

    expect(body(error)).toMatchObject({ code: 'FIELD_REQUIRED', fieldErrors: { titleFa: 'FIELD_REQUIRED' } });
  });

  it('still rejects a language that is unknown or inactive', async () => {
    const { svc } = service(null);

    const error = await svc
      .createSimpleDefinition({ languageId: 'lang-gone', titleFa: 'تست', titleEn: 'tes' })
      .catch((caught: unknown) => caught);

    expect(body(error)).toMatchObject({ code: 'TEST_LANGUAGE_INVALID' });
  });

  it('creates the four-skill definition once the language is supplied', async () => {
    const { svc, create } = service();

    await svc.createSimpleDefinition({
      languageId: 'lang-en',
      titleFa: 'تست',
      titleEn: 'tes',
      durationMinutes: 169,
    });

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ languageId: 'lang-en', titleFa: 'تست', titleEn: 'tes', durationMinutes: 169 });
    expect(data.slug).toMatch(/^tes-/);
    expect(data.sections.create.map((section: { skill: string }) => section.skill)).toEqual([
      'listening',
      'reading',
      'writing',
      'speaking',
    ]);
  });
});
