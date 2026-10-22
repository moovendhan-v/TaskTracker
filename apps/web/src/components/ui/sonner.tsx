import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return <Sonner position="bottom-right" richColors closeButton {...props} />;
}

export { toast } from 'sonner';
