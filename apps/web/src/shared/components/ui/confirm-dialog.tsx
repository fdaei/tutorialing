'use client';
import { Button } from './button';
import { Sheet } from './sheet';

/** Small yes/no confirmation, built on `Sheet`. Not wired to any call site yet. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  loading,
  tone = 'primary',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  tone?: 'primary' | 'danger';
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            block
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button type="button" variant={tone === 'danger' ? 'danger' : 'primary'} block onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {description && <p className="text-sm text-muted">{description}</p>}
    </Sheet>
  );
}
