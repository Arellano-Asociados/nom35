import { redirect } from 'next/navigation';

export default async function PaginaEmpresa({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa } = await params;
  redirect(`/panel/${empresa}/centros`);
}
