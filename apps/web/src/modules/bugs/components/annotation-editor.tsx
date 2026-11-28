import { ANNOTATION_COLORS, canvasToPng, drawAnnotation, renderAnnotated, type Annotation, type AnnotationTool, type Point } from '@taskflow/bug-capture';
import { ArrowUpRightIcon, EyeOffIcon, HighlighterIcon, PencilIcon, SquareIcon, TypeIcon, Undo2Icon } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

const TOOLS: { tool: AnnotationTool; label: string; icon: typeof ArrowUpRightIcon }[] = [
  { tool: 'arrow', label: 'Arrow', icon: ArrowUpRightIcon },
  { tool: 'rect', label: 'Box', icon: SquareIcon },
  { tool: 'highlight', label: 'Highlight', icon: HighlighterIcon },
  { tool: 'pen', label: 'Draw', icon: PencilIcon },
  { tool: 'text', label: 'Text', icon: TypeIcon },
  { tool: 'blur', label: 'Hide (pixelate)', icon: EyeOffIcon },
];

/** Marks up a screenshot: arrows, boxes, highlights, freehand, text, and pixelating anything private. */
export function AnnotationEditor({ image, onDone, onCancel }: { image: Blob; onDone: (annotated: Blob) => void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [tool, setTool] = useState<AnnotationTool>('arrow');
  const [color, setColor] = useState<string>(ANNOTATION_COLORS[0]);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void createImageBitmap(image).then((loaded) => {
      if (!cancelled) setBitmap(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [image]);

  useEffect(() => {
    if (!bitmap || !canvas.current) return;
    renderAnnotated(canvas.current, bitmap, annotations);
    if (draft) drawAnnotation(canvas.current.getContext('2d')!, draft);
  }, [bitmap, annotations, draft]);

  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width, y: ((event.clientY - rect.top) / rect.height) * event.currentTarget.height };
  };

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    const at = point(event);
    if (tool === 'text') {
      if (label.trim()) setAnnotations((current) => [...current, { tool: 'text', color, at, text: label.trim().slice(0, 120) }]);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft(tool === 'pen' ? { tool: 'pen', color, points: [at] } : { tool, color, from: at, to: at });
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!draft) return;
    const at = point(event);
    setDraft(draft.tool === 'pen' ? { ...draft, points: [...draft.points, at] } : draft.tool === 'text' ? draft : { ...draft, to: at });
  };
  const up = () => {
    if (draft) setAnnotations((current) => [...current, draft]);
    setDraft(null);
  };

  const done = async () => {
    if (!canvas.current) return;
    setSaving(true);
    try {
      onDone(await canvasToPng(canvas.current));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3" data-bug-capture-ignore="">
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Annotation tools">
        {TOOLS.map(({ tool: value, label: name, icon: Icon }) => (
          <Button key={value} variant={tool === value ? 'secondary' : 'ghost'} size="icon" className="size-8" aria-label={name} aria-pressed={tool === value} title={name} onClick={() => setTool(value)}>
            <Icon className="size-4" />
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        {ANNOTATION_COLORS.map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`Colour ${value}`}
            aria-pressed={color === value}
            onClick={() => setColor(value)}
            className={cn('size-5 rounded-full border-2 border-transparent', color === value && 'ring-2 ring-ring ring-offset-1')}
            style={{ background: value }}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <Button variant="ghost" size="icon" className="size-8" aria-label="Undo" title="Undo" disabled={!annotations.length} onClick={() => setAnnotations((current) => current.slice(0, -1))}>
          <Undo2Icon className="size-4" />
        </Button>
        {tool === 'text' ? <Input aria-label="Text to place" placeholder="Type, then click the image" value={label} onChange={(event) => setLabel(event.target.value)} className="h-8 w-56" maxLength={120} /> : null}
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-lg border bg-muted">
        {bitmap ? (
          <canvas
            ref={canvas}
            aria-label="Screenshot being annotated"
            className={cn('block h-auto w-full touch-none', tool === 'text' ? 'cursor-text' : 'cursor-crosshair')}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          />
        ) : (
          <div className="grid h-48 place-items-center text-sm text-muted-foreground">Loading the screenshot…</div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Discard
        </Button>
        <Button onClick={() => void done()} disabled={!bitmap || saving}>
          Use screenshot
        </Button>
      </div>
    </div>
  );
}
