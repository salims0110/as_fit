'use client';

import { useRef, useState, useTransition } from 'react';
import { Button, FormStatus } from '@/components/ui';
import { MAX_CATALOG_JSON_BYTES } from '@/lib/validation/catalog-import';
import type { ActionResult } from '@/lib/validation/common';

export function CatalogPortability({
  kind,
  itemCount,
  onImport,
}: {
  kind: 'foods' | 'drinks';
  itemCount: number;
  onImport: (rawJson: string) => Promise<ActionResult<{ added: number; skipped: number }>>;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ tone: 'brand' | 'danger'; text: string } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_CATALOG_JSON_BYTES) {
      setStatus({ tone: 'danger', text: 'حجم الملف يتجاوز الحد المسموح (512 كيلوبايت).' });
      return;
    }

    const raw = await file.text();
    startTransition(async () => {
      const res = await onImport(raw);
      if (res.ok) {
        setStatus({
          tone: 'brand',
          text: `اكتمل الاستيراد: أُضيف ${res.added} وتم تخطي ${res.skipped} موجود مسبقاً.`,
        });
      } else {
        setStatus({ tone: 'danger', text: res.message ?? 'تعذّر استيراد الملف.' });
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {itemCount > 0 && (
          <a
            id={`export-${kind}-json`}
            href={`/api/catalog/${kind}`}
            download
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            تصدير JSON
          </a>
        )}
        <input
          ref={fileRef}
          id={`import-${kind}-file`}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={handleFileChange}
        />
        <Button
          id={`import-${kind}-json`}
          variant="secondary"
          disabled={pending}
          className="px-3 py-1.5 text-sm"
          onClick={() => fileRef.current?.click()}
        >
          {pending ? 'جارٍ الاستيراد…' : 'استيراد JSON'}
        </Button>
      </div>
      <FormStatus status={status} />
    </div>
  );
}
