'use client';

import { translate } from '@/lib/i18n';
import { api } from '@/shared/services/api';
import {
  Area,
  Field,
  LearningPlanSelect,
  Localized,
  Select,
  Shell,
  Status,
  StudentSelect,
  Submit,
  list,
  numeric,
  useAction,
  value,
} from '../shared/action-controls';
export function PlanForm({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Shell title={translate(fa, 'legacyCreateLearningPlan')}>
        <form
          className="mt-4 grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api('/learning/plans', {
                method: 'POST',
                body: JSON.stringify({
                  studentId: value(form, 'studentId'),
                  title: value(form, 'title'),
                  targetBand: numeric(form, 'targetBand', 7),
                  examDate: value(form, 'examDate') || undefined,
                  weakSkills: list(form, 'weakSkills'),
                  milestones: [{ title: value(form, 'milestone'), order: 1, dueAt: value(form, 'dueAt') || undefined }],
                }),
              }),
            );
          }}
        >
          <StudentSelect fa={fa} />
          <Field name="title" label={translate(fa, 'legacyPlanTitle')} required />
          <Field
            name="targetBand"
            label={translate(fa, 'legacyTargetBand')}
            type="number"
            step="0.5"
            min={4}
            max={9}
            defaultValue={7}
          />
          <Field name="examDate" label={translate(fa, 'legacyExamDate')} type="date" />
          <Field
            name="weakSkills"
            label={translate(fa, 'legacyWeakSkillsCommaSeparated')}
            defaultValue="writing,speaking"
            dir="ltr"
          />
          <Field name="milestone" label={translate(fa, 'legacyFirstMilestone')} required />
          <Field name="dueAt" label={translate(fa, 'legacyDueDate')} type="date" />
          <div className="md:col-span-2">
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacyCreatePlan')}
            </Submit>
          </div>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
      <Shell title={translate(fa, 'legacyAddAnAssignmentToAPlan')}>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api(`/learning/plans/${value(form, 'planId')}/assignments`, {
                method: 'POST',
                body: JSON.stringify({
                  title: value(form, 'assignmentTitle'),
                  instructions: value(form, 'instructions'),
                  dueAt: value(form, 'assignmentDueAt') || undefined,
                }),
              }),
            );
          }}
        >
          <LearningPlanSelect fa={fa} />
          <Field name="assignmentTitle" label={translate(fa, 'legacyAssignmentTitle')} required />
          <Area name="instructions" label={translate(fa, 'legacyInstructionsAndSubmissionDetails')} required />
          <Field name="assignmentDueAt" label={translate(fa, 'legacydueDate2')} type="date" />
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyAddAssignment')}
          </Submit>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
    </div>
  );
}
