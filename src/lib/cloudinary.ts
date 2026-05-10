export type CloudinaryConfig = {
  cloudName: string;
  uploadPreset: string;
};

export type ImagePosition = 'center' | 'left' | 'right' | 'full';

export async function uploadToCloudinary(
  file: File,
  config: CloudinaryConfig
): Promise<string> {
  if (!config.cloudName || !config.uploadPreset) {
    throw new Error('Cloudinary não configurado (faltam env vars)');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`Arquivo não é imagem (tipo: ${file.type})`);
  }
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_BYTES) {
    throw new Error(`Arquivo muito grande (max 10MB, atual: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', config.uploadPreset);

  const url = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;
  const res = await fetch(url, { method: 'POST', body: formData });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary respondeu ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { secure_url?: string };
  if (!json.secure_url) {
    throw new Error('Cloudinary não retornou secure_url');
  }
  return json.secure_url;
}
