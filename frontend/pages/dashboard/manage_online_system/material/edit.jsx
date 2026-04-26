import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Title from '../../../../components/Title';
import apiClient from '../../../../lib/axios';
import MaterialForm from '../../../../components/MaterialForm';

export default function EditMaterial() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = router.query;
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => (await apiClient.get('/api/materials')).data,
  });

  const selected = useMemo(() => (data?.materials || []).find((m) => String(m._id) === String(id)), [data?.materials, id]);

  useEffect(() => {
    if (!isLoading && id && !selected) {
      setError('❌ Material not found');
    }
  }, [isLoading, id, selected]);

  const mutation = useMutation({
    mutationFn: async (payload) => (await apiClient.put(`/api/materials?id=${id}`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries(['materials']);
      router.push('/dashboard/manage_online_system/material');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to update material'),
  });

  return (
    <div style={{ minHeight: '100vh', padding: '20px 5px' }}>
      <div style={{ maxWidth: 800, margin: '40px auto', padding: '20px 5px' }}>
        <Title backText="Back" href="/dashboard/manage_online_system/material">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Image src="/edit.svg" alt="Edit" width={30} height={30} />
            Edit Material
          </div>
        </Title>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          {isLoading || !selected ? (
            <div style={{ textAlign: 'center', color: '#6c757d', padding: 24 }}>Loading material...</div>
          ) : (
            <MaterialForm
              mode="edit"
              initialData={selected}
              materials={data?.materials || []}
              onSubmit={(payload) => mutation.mutate(payload)}
              onCancel={() => router.push('/dashboard/manage_online_system/material')}
              submitting={mutation.isPending}
              errorMessage={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}
