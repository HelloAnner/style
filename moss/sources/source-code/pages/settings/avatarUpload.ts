/**
 * 头像上传前的文件处理工具。
 *
 * 直接搬运自 V1 fineinsight `src/pages/me/avatarUpload.ts`，
 * 包含格式校验、尺寸裁剪与压缩逻辑。
 * 调用方：SettingsPage 个人信息 Tab 的头像上传交互。
 */

const MAX_AVATAR_DIMENSION = 1024;
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const COMPRESSION_TRIGGER_SIZE = 512 * 1024;
const COMPRESSION_PRESETS = [
  { maxDimension: 1024, quality: 0.82 },
  { maxDimension: 768, quality: 0.76 },
  { maxDimension: 512, quality: 0.7 },
] as const;
const SUPPORTED_AVATAR_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const SUPPORTED_AVATAR_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export const AVATAR_FILE_ACCEPT = 'image/png,image/jpeg,image/webp';
export const AVATAR_FILE_LIMIT_MB = 5;

type AvatarErrorMessageKey =
  | 'admin.profile.avatarUnsupported'
  | 'admin.profile.avatarTooLarge'
  | 'admin.profile.avatarProcessFailed';

/** 头像上传前的本地校验异常（携带 messageKey 供 UI 层映射为中文文案）。 */
export class AvatarUploadClientError extends Error {
  readonly messageKey: AvatarErrorMessageKey;

  constructor(messageKey: AvatarErrorMessageKey) {
    super(messageKey);
    this.messageKey = messageKey;
    this.name = 'AvatarUploadClientError';
  }
}

/** 文件 messageKey → 中文文案映射（V1 使用 i18n，corevo 暂无 i18n 直接用文字）。 */
export function mapAvatarErrorMessageKey(messageKey: AvatarErrorMessageKey): string {
  const map: Record<AvatarErrorMessageKey, string> = {
    'admin.profile.avatarUnsupported': '不支持该图片格式，请上传 JPG/PNG/WebP',
    'admin.profile.avatarTooLarge': '图片过大，最大支持 5MB',
    'admin.profile.avatarProcessFailed': '图片处理失败，请重试',
  };
  return map[messageKey];
}

/** 在发起请求前统一做头像格式校验、缩放与压缩。 */
export async function prepareAvatarUploadFile(file: File): Promise<File> {
  validateAvatarType(file);
  const image = await loadImage(file);
  if (!shouldCompress(file, image)) {
    validateAvatarSize(file.size);
    return file;
  }
  return compressAvatarFile(file, image);
}

function validateAvatarType(file: File): void {
  const fileName = file.name.trim().toLowerCase();
  const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.') + 1) : '';
  const contentType = file.type.trim().toLowerCase();
  if (SUPPORTED_AVATAR_TYPES.has(contentType) || SUPPORTED_AVATAR_EXTENSIONS.has(extension)) {
    return;
  }
  throw new AvatarUploadClientError('admin.profile.avatarUnsupported');
}

function validateAvatarSize(size: number): void {
  if (size > MAX_AVATAR_FILE_SIZE) {
    throw new AvatarUploadClientError('admin.profile.avatarTooLarge');
  }
}

function shouldCompress(file: File, image: HTMLImageElement): boolean {
  return (
    file.size > COMPRESSION_TRIGGER_SIZE ||
    image.width > MAX_AVATAR_DIMENSION ||
    image.height > MAX_AVATAR_DIMENSION
  );
}

async function compressAvatarFile(file: File, image: HTMLImageElement): Promise<File> {
  let bestCandidate: File | null = null;
  const outputType = resolveOutputType(file.type);
  for (const preset of COMPRESSION_PRESETS) {
    const candidate = await renderCompressedAvatar(
      file,
      image,
      preset.maxDimension,
      outputType,
      preset.quality
    );
    if (!bestCandidate || candidate.size < bestCandidate.size) {
      bestCandidate = candidate;
    }
    if (candidate.size <= MAX_AVATAR_FILE_SIZE) {
      if (candidate.size < file.size || file.size > MAX_AVATAR_FILE_SIZE) {
        return candidate;
      }
      return file;
    }
  }
  if (bestCandidate && bestCandidate.size <= MAX_AVATAR_FILE_SIZE) {
    return bestCandidate;
  }
  throw new AvatarUploadClientError('admin.profile.avatarTooLarge');
}

async function renderCompressedAvatar(
  file: File,
  image: HTMLImageElement,
  maxDimension: number,
  outputType: string,
  quality: number
): Promise<File> {
  const { width, height } = scaleDimensions(image.width, image.height, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new AvatarUploadClientError('admin.profile.avatarProcessFailed');
  }
  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, outputType, quality);
  return new File([blob], renameAvatarFile(file.name, outputType), {
    type: blob.type || outputType,
    lastModified: Date.now(),
  });
}

function resolveOutputType(contentType: string): string {
  const normalized = contentType.trim().toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return 'image/jpeg';
  }
  return 'image/webp';
}

function renameAvatarFile(fileName: string, outputType: string): string {
  const normalizedName = fileName.trim();
  const baseName = normalizedName.includes('.')
    ? normalizedName.substring(0, normalizedName.lastIndexOf('.'))
    : normalizedName || 'avatar';
  const extension = outputType === 'image/jpeg' ? 'jpg' : 'webp';
  return `${baseName}.${extension}`;
}

function scaleDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    throw new AvatarUploadClientError('admin.profile.avatarProcessFailed');
  }
  const ratio = Math.min(maxDimension / width, maxDimension / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new AvatarUploadClientError('admin.profile.avatarProcessFailed'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new AvatarUploadClientError('admin.profile.avatarProcessFailed'));
      },
      type,
      quality
    );
  });
}
