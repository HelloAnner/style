import helpCircleIcon from '../../assets/icons/file-panel/help-circle.svg';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface ShareConfirmDialogProps {
  open: boolean;
  fileName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ShareConfirmDialog({
  open,
  fileName: _fileName,
  onCancel,
  onConfirm,
}: ShareConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="共享文件"
      description="共享文件后，所有会话均可引用此文件。该操作不支持撤销。"
      confirmText="共享"
      cancelText="取消"
      variant="dark"
      icon={<img src={helpCircleIcon} alt="" style={{ width: 24, height: 24 }} />}
      onConfirm={onConfirm}
      onCancel={onCancel}
      backdropTestId="share-confirm-dialog-backdrop"
      panelTestId="share-confirm-dialog"
      titleTestId="share-confirm-dialog-title"
      descriptionTestId="share-confirm-dialog-description"
      cancelButtonTestId="share-confirm-dialog-cancel"
      confirmButtonTestId="share-confirm-dialog-confirm"
    />
  );
}
