import cssIcon from '../../assets/file-icons/css.png';
import docIcon from '../../assets/file-icons/doc.png';
import htmlIcon from '../../assets/file-icons/html.png';
import jsonIcon from '../../assets/file-icons/json.png';
import markdownIcon from '../../assets/file-icons/md.png';
import pdfIcon from '../../assets/file-icons/pdf.png';
import imageIcon from '../../assets/file-icons/pic.png';
import presentationIcon from '../../assets/file-icons/ppt.png';
import unknownIcon from '../../assets/file-icons/unknown.png';
import videoIcon from '../../assets/file-icons/video.png';
import spreadsheetIcon from '../../assets/file-icons/xls.png';
import archiveIcon from '../../assets/file-icons/zip.png';
import {
  getWorkspaceFileCategory,
  getWorkspaceFileExtension,
} from './fileCardModel';

export function resolveFileIcon(fileName: string): string {
  const ext = getWorkspaceFileExtension(fileName);

  switch (ext) {
    case 'css':
      return cssIcon;
    case 'html':
      return htmlIcon;
    case 'json':
      return jsonIcon;
    case 'md':
    case 'markdown':
      return markdownIcon;
    case 'pdf':
      return pdfIcon;
    case 'xls':
    case 'xlsx':
    case 'csv':
    case 'ods':
      return spreadsheetIcon;
    case 'ppt':
    case 'pptx':
    case 'key':
    case 'odp':
      return presentationIcon;
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return archiveIcon;
    default:
      break;
  }

  switch (getWorkspaceFileCategory(fileName)) {
    case 'image':
      return imageIcon;
    case 'document':
      return docIcon;
    case 'code':
      return htmlIcon;
    case 'video':
    case 'audio':
      return videoIcon;
    case 'presentation':
      return presentationIcon;
    case 'spreadsheet':
      return spreadsheetIcon;
    case 'archive':
      return archiveIcon;
    case 'pdf':
      return pdfIcon;
    case 'unknown':
    default:
      return unknownIcon;
  }
}

interface FileCardPreviewProps {
  fileName: string;
  imageUrl?: string;
}

export function FileCardPreview({ fileName }: FileCardPreviewProps) {
  const iconSrc = resolveFileIcon(fileName);

  return (
    <div
      data-testid="file-card-preview"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        boxSizing: 'border-box',
      }}
    >
      <img
        src={iconSrc}
        alt=""
        aria-hidden="true"
        data-testid="file-card-preview-icon"
        style={{
          width: 64,
          height: 64,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
        }}
      />
    </div>
  );
}
