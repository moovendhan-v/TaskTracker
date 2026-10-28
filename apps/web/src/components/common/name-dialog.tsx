import { useEffect, useState, type ReactNode } from 'react';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useServerForm } from '@/core/forms/use-server-form';
import type { IconKey } from '@taskflow/shared-types';
import { ColorPicker, PALETTE } from './color-picker';
import { IconGrid } from './icon-picker';

export interface NameDialogValues {
  name: string;
  color: string;
  icon: IconKey | null;
  [key: string]: unknown;
}

interface NameDialogProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  submitLabel: string;
  /** The API form whose rules apply, e.g. `space.create`. */
  formName: string;
  placeholder?: string;
  withColor?: boolean;
  /** Pick an icon (and colour) from the icon grid. `optional-color` allows "no colour". */
  withIcon?: boolean | 'optional-color';
  defaultValues?: Partial<NameDialogValues> & Record<string, unknown>;
  onSubmit: (values: NameDialogValues) => Promise<unknown>;
}

/** Reusable "name this thing" dialog for spaces, lists, departments and similar. */
export function NameDialog({ trigger, title, description, submitLabel, formName, placeholder, withColor = false, withIcon = false, defaultValues, onSubmit }: NameDialogProps) {
  const blankColor = withIcon === 'optional-color' ? '' : PALETTE[1];
  const [open, setOpen] = useState(false);
  const { form, applyServerErrors, hints } = useServerForm<NameDialogValues>(formName, {
    defaultValues: { name: '', color: blankColor, icon: null, ...defaultValues } as NameDialogValues,
  });

  useEffect(() => {
    if (open) form.reset({ name: '', color: blankColor, icon: null, ...defaultValues } as NameDialogValues);
  }, [open, defaultValues, form, blankColor]);

  const submit = form.handleSubmit(
    async (values) => {
      try {
        await onSubmit(values);
        setOpen(false);
      } catch (error) {
        if (!applyServerErrors(error)) throw error;
      }
    },
    (errors) => {
      console.warn('Form validation failed:', errors);
    },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormField id="name-dialog-name" label="Name" error={form.formState.errors.name?.message}>
            <Input id="name-dialog-name" placeholder={placeholder} autoFocus maxLength={hints('name').maxLength} {...form.register('name')} />
          </FormField>
          {withIcon ? (
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Icon and colour</span>
              <Controller
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <IconGrid
                    value={{ icon: field.value, color: form.watch('color') || null }}
                    colorOptional={withIcon === 'optional-color'}
                    onChange={(next) => {
                      field.onChange(next.icon);
                      form.setValue('color', next.color ?? '');
                    }}
                  />
                )}
              />
            </div>
          ) : withColor ? (
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Colour</span>
              <Controller control={form.control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
