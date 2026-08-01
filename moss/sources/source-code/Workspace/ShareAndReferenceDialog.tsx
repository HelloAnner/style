import helpCircleIcon from '../../assets/icons/file-panel/help-circle.svg';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface ShareAndReferenceDialogProps {
  open: boolean;
  fileName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ShareAndReferenceDialog({
  open,
  fileName: _fileName,
  onCancel,
  onConfirm,
}: ShareAndReferenceDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="共享文件并引用到当前会话"
      description="当前文件未被共享，无法被引用到当前会话。共享文件后，所有会话均可引用此文件。该操作不支持撤销。"
      confirmText="共享并引用"
      cancelText="取消"
      variant="dark"
      icon={<img src={helpCircleIcon} alt="" style={{ width: 24, height: 24 }} />}
      onConfirm={onConfirm}
      onCancel={onCancel}
      backdropTestId="share-and-reference-dialog-backdrop"
      panelTestId="share-and-reference-dialog"
      titleTestId="share-and-reference-dialog-title"
      descriptionTestId="share-and-reference-dialog-description"
      cancelButtonTestId="share-and-reference-dialog-cancel"
      confirmButtonTestId="share-and-reference-dialog-confirm"
    />
  );
}
