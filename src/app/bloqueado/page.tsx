import Image from 'next/image';

export default function BloqueadoPage({
  searchParams,
}: {
  searchParams: { sales?: string };
}) {
  const salesUrl = searchParams.sales || '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#0a0a0f' }}>
      <div className="max-w-md w-full text-center">
        <Image src="/logo.webp" alt="Logo" width={160} height={60} className="mx-auto mb-8 object-contain" />

        <div className="bg-surface rounded-2xl p-8 border border-gray-800">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-3">Acesso não disponível</h1>
          <p className="text-gray-400 mb-6 leading-relaxed">
            Este acesso já foi utilizado nesta edição da imersão. Cada participação é única e exclusiva por evento.
          </p>

          {salesUrl ? (
            <a
              href={salesUrl}
              className="block w-full bg-brand hover:bg-brand-hover text-white font-bold py-3 px-6 rounded-xl transition-colors text-center"
            >
              Quero garantir meu acesso
            </a>
          ) : (
            <p className="text-gray-500 text-sm">
              Fique atento aos canais oficiais para a próxima edição.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
