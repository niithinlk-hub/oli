interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
  onCancel
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(7, 26, 51, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-card bg-white shadow-floating p-6 w-[420px] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-h4 mb-1">{title}</h3>
        <p className="text-body-sm text-ink-secondary">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-button border border-line bg-white text-btn hover:bg-surface-cloud"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-button text-btn text-white"
            style={{
              background: destructive
                ? 'linear-gradient(135deg, #FB7185 0%, #F59E0B 100%)'
                : 'var(--oli-gradient-primary)'
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
