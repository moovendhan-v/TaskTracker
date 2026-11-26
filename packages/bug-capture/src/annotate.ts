/**
 * Screenshot annotations as plain data (arrows, boxes, highlights, text, freehand), drawn onto a
 * canvas. Framework-free so the app, the SDK and the extension share it.
 */
export type AnnotationTool = 'arrow' | 'rect' | 'highlight' | 'text' | 'pen' | 'blur';

export interface Point {
  x: number;
  y: number;
}

export type Annotation =
  | { tool: 'arrow' | 'rect' | 'highlight' | 'blur'; color: string; from: Point; to: Point }
  | { tool: 'pen'; color: string; points: Point[] }
  | { tool: 'text'; color: string; at: Point; text: string };

export const ANNOTATION_COLORS = ['#e5484d', '#f5a524', '#30a46c', '#0090ff', '#111111'] as const;

function box(from: Point, to: Point) {
  return { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) };
}

/** Line widths and font sizes follow the image size, so annotations read the same on any screen. */
function scale(canvas: HTMLCanvasElement): number {
  return Math.max(1, Math.round(Math.max(canvas.width, canvas.height) / 1000));
}

export function drawAnnotation(context: CanvasRenderingContext2D, annotation: Annotation): void {
  const unit = scale(context.canvas);
  context.save();
  context.strokeStyle = annotation.color;
  context.fillStyle = annotation.color;
  context.lineWidth = 3 * unit;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  switch (annotation.tool) {
    case 'rect': {
      const { x, y, width, height } = box(annotation.from, annotation.to);
      context.strokeRect(x, y, width, height);
      break;
    }
    case 'highlight': {
      const { x, y, width, height } = box(annotation.from, annotation.to);
      context.globalAlpha = 0.3;
      context.fillRect(x, y, width, height);
      break;
    }
    case 'blur': {
      // Pixelate: hides text (emails, names, numbers) for good once exported.
      const { x, y, width, height } = box(annotation.from, annotation.to);
      if (width < 2 || height < 2) break;
      const block = 10 * unit;
      const image = context.getImageData(x, y, width, height);
      for (let by = 0; by < height; by += block) {
        for (let bx = 0; bx < width; bx += block) {
          const index = (Math.floor(by) * Math.floor(width) + Math.floor(bx)) * 4;
          context.fillStyle = `rgb(${image.data[index]}, ${image.data[index + 1]}, ${image.data[index + 2]})`;
          context.fillRect(x + bx, y + by, Math.min(block, width - bx), Math.min(block, height - by));
        }
      }
      break;
    }
    case 'arrow': {
      const { from, to } = annotation;
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const head = 16 * unit;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.beginPath();
      context.moveTo(to.x, to.y);
      context.lineTo(to.x - head * Math.cos(angle - Math.PI / 7), to.y - head * Math.sin(angle - Math.PI / 7));
      context.lineTo(to.x - head * Math.cos(angle + Math.PI / 7), to.y - head * Math.sin(angle + Math.PI / 7));
      context.closePath();
      context.fill();
      break;
    }
    case 'pen': {
      const [first, ...rest] = annotation.points;
      if (!first) break;
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (const point of rest) context.lineTo(point.x, point.y);
      context.stroke();
      break;
    }
    case 'text': {
      const size = 20 * unit;
      context.font = `600 ${size}px system-ui, sans-serif`;
      context.textBaseline = 'top';
      const width = context.measureText(annotation.text).width;
      context.fillStyle = 'rgba(255, 255, 255, 0.85)';
      context.fillRect(annotation.at.x - 4 * unit, annotation.at.y - 3 * unit, width + 8 * unit, size + 6 * unit);
      context.fillStyle = annotation.color;
      context.fillText(annotation.text, annotation.at.x, annotation.at.y);
      break;
    }
  }
  context.restore();
}

/** Draws the image and every annotation; used both for the live editor and the exported PNG. */
export function renderAnnotated(canvas: HTMLCanvasElement, image: CanvasImageSource & { width: number; height: number }, annotations: readonly Annotation[]): void {
  const context = canvas.getContext('2d')!;
  canvas.width = image.width;
  canvas.height = image.height;
  context.drawImage(image, 0, 0);
  for (const annotation of annotations) drawAnnotation(context, annotation);
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not export the image'))), 'image/png'));
}
