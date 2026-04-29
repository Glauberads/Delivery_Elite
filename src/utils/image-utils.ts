export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const validateImageFile = (
  file: File,
  maxSizeMB: number = 2
): string | null => {
  const validTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "image/x-icon",
  ];

  if (!validTypes.includes(file.type)) {
    return "Formato de arquivo inválido. Use JPG, PNG, WebP, SVG ou ICO.";
  }

  const maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
  if (file.size > maxSize) {
    return `Arquivo muito grande. O tamanho máximo é ${maxSizeMB}MB.`;
  }

  return null;
};



