import { ValidationPipe } from '@nestjs/common';
import { validationResponse } from '../../../../common';
import { PlacementSubmitDto } from './placement-submit.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: validationResponse,
});

const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: PlacementSubmitDto });

describe('PlacementSubmitDto', () => {
  it.each([0, 'written answer', ['a', 'b'], { selected: true }, null])(
    'preserves the supported answer value %p through the production validation pipe',
    async (value) => {
      await expect(validate({ testId: 'test-1', answers: [{ questionId: 'question-1', value }] })).resolves.toEqual({
        testId: 'test-1',
        answers: [{ questionId: 'question-1', value }],
      });
    },
  );

  it('still rejects unexpected fields inside a nested answer', async () => {
    await expect(
      validate({
        testId: 'test-1',
        answers: [{ questionId: 'question-1', value: 0, privileged: true }],
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
        fieldErrors: { 'answers.0.privileged': 'VALIDATION_WHITELIST_VALIDATION' },
      },
    });
  });
});
