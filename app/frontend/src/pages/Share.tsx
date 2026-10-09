import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { client } from '@/lib/client';

export default function Share() {
  const { id } = useParams();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    client.apiCall
      .invoke({ url: `/api/v1/share/${id}`, method: 'GET', data: {} })
      .then((res) => {
        setHtml(res.data.html);
        document.title = res.data.title;
      })
      .catch((e) => setError(e?.response?.data?.detail || e?.data?.detail || '加载失败'));
  }, [id]);

  if (error || html === null)
    return (
      <div className="flex h-screen items-center justify-center bg-[#111214] font-mono text-sm text-[#8B8D93]">
        {error || '加载中…'}
      </div>
    );
  return (
    <iframe
      title="分享的应用"
      srcDoc={html}
      sandbox="allow-scripts allow-modals allow-forms allow-popups"
      className="fixed inset-0 h-full w-full border-0 bg-white"
    />
  );
}
