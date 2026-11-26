import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/ui';

const DATASETS = [
  { id: 'weigh-ins', label: 'سجل الوزن واتجاه EMA', hint: 'جميع القراءات مع حالة البروتوكول' },
  { id: 'daily-nutrition', label: 'الملخص الغذائي والتمارين اليومي', hint: 'السعرات والبروتين والكافيين والحرق لآخر 365 يوماً' },
  { id: 'sleep', label: 'سجل النوم وكفاءته', hint: 'أوقات النوم والكمون و WASO والكفاءة لآخر 365 يوماً' },
] as const;

export function DataExportCard() {
  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle>تصدير بياناتي (CSV)</SectionTitle>
      <p className="text-sm text-ink-muted">
        نزّل سجلاتك بصيغة <bdi className="font-mono">CSV (UTF-8)</bdi> متوافقة مباشرة مع العربية في برامج الجداول للتحليل الشخصي أو الأرشفة المحلية.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {DATASETS.map((d) => (
          <a
            key={d.id}
            id={`export-${d.id}-csv`}
            href={`/api/export/${d.id}`}
            download
            className="flex flex-col gap-1 rounded-xl border border-line p-4 text-start transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="text-sm font-semibold text-brand-ink">{d.label}</span>
            <span className="text-xs text-ink-muted">{d.hint}</span>
          </a>
        ))}
      </div>
    </Card>
  );
}
