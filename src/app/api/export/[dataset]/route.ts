import { buildDatasetCsv, isExportDataset } from '@/server/queries/export';
import { USER_ID } from '@/server/session';

export async function GET(_request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  if (!isExportDataset(dataset)) {
    return Response.json({ error: 'مجموعة البيانات غير معروفة' }, { status: 404 });
  }

  const { csv, filename } = await buildDatasetCsv(USER_ID, dataset);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
