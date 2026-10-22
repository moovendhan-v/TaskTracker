import { PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { EMPLOYMENT_TYPES, JOB_TITLE_MAX, type DepartmentResponse, type EmployeeResponse, type EmploymentType, type UpsertEmployeeProfileRequest } from '@taskflow/shared-types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EMPLOYMENT_LABELS } from '../lib/hr-labels';

/** Radix Select can't use an empty value, so "none" stands in for null. */
const NONE = 'none';
const toValue = (value: string | null) => value ?? NONE;
const fromValue = (value: string) => (value === NONE ? null : value);

interface ProfileDialogProps {
  employee: EmployeeResponse;
  departments: DepartmentResponse[];
  people: EmployeeResponse[];
  onSave: (body: UpsertEmployeeProfileRequest) => Promise<unknown>;
}

export function ProfileDialog({ employee, departments, people, onSave }: ProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState(NONE);
  const [managerUserId, setManagerUserId] = useState(NONE);
  const [employmentType, setEmploymentType] = useState(NONE);
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);

  /** Opening the dialog starts from the saved values, so a cancelled edit leaves nothing behind. */
  function changeOpen(next: boolean) {
    if (next) {
      setJobTitle(employee.jobTitle ?? '');
      setDepartmentId(toValue(employee.departmentId));
      setManagerUserId(toValue(employee.managerUserId));
      setEmploymentType(toValue(employee.employmentType));
      setStartDate(employee.startDate ?? '');
    }
    setOpen(next);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({
        jobTitle: jobTitle.trim() || null,
        departmentId: fromValue(departmentId),
        managerUserId: fromValue(managerUserId),
        employmentType: fromValue(employmentType) as EmploymentType | null,
        startDate: startDate || null,
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${employee.name}'s profile`}>
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee.name}</DialogTitle>
          <DialogDescription>{employee.email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField id="profile-title" label="Job title">
            <Input id="profile-title" value={jobTitle} maxLength={JOB_TITLE_MAX} onChange={(event) => setJobTitle(event.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="profile-department" label="Department">
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="profile-department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="profile-manager" label="Manager">
              <Select value={managerUserId} onValueChange={setManagerUserId}>
                <SelectTrigger id="profile-manager">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {people
                    .filter((person) => person.userId !== employee.userId)
                    .map((person) => (
                      <SelectItem key={person.userId} value={person.userId}>
                        {person.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="profile-type" label="Employment">
              <Select value={employmentType} onValueChange={setEmploymentType}>
                <SelectTrigger id="profile-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {EMPLOYMENT_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="profile-start" label="Start date">
              <Input id="profile-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </FormField>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving}>
            Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
