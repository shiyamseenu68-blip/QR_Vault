import QRCode from 'qrcode';

export interface QROptions {
  margin?: number;
  width?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export async function generateQRPng(text: string, options: QROptions = {}): Promise<string> {
  const opts: QRCode.QRCodeToDataURLOptions = {
    errorCorrectionLevel: options.errorCorrectionLevel || 'H',
    margin: options.margin !== undefined ? options.margin : 2,
    width: options.width || 400,
    color: {
      dark: options.color?.dark || '#0f172a', // crisp deep slate / black
      light: options.color?.light || '#ffffff', // crisp white background for high contrast scanning
    },
  };
  return QRCode.toDataURL(text, opts);
}

export async function generateQRSvg(text: string, options: QROptions = {}): Promise<string> {
  const opts: QRCode.QRCodeToStringOptions = {
    type: 'svg',
    errorCorrectionLevel: options.errorCorrectionLevel || 'H',
    margin: options.margin !== undefined ? options.margin : 2,
    width: options.width || 400,
    color: {
      dark: options.color?.dark || '#0f172a',
      light: options.color?.light || '#ffffff',
    },
  };
  return QRCode.toString(text, opts);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadSvgText(svgText: string, filename: string) {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}
