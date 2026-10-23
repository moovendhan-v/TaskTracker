import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pager({ page, pageSize, total, onPage }: PagerProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
      <span>
        Page {page} of {lastPage} · {total} total
      </span>
      <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeftIcon />
      </Button>
      <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
        <ChevronRightIcon />
      </Button>
    </div>
  );
}
