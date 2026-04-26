import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Title from '../../../../components/Title';
import apiClient from '../../../../lib/axios';
import MaterialForm from '../../../../components/MaterialForm';

export default function AddMaterial() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => (await apiClient.get('/api/materials')).data,
  });

  const mutation = useMutation({
    mutationFn: async (payload) => (await apiClient.post('/api/materials', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries(['materials']);
      router.push('/dashboard/manage_online_system/material');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to create material'),
  });

  return (
    <div style={{ minHeight: '100vh', padding: '20px 5px' }}>
      <div style={{ maxWidth: 800, margin: '40px auto', padding: '20px 5px' }}>
        <Title backText="Back" href="/dashboard/manage_online_system/material">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Image src="/plus.svg" alt="Add" width={30} height={30} />
            Add Material
          </div>
        </Title>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          <MaterialForm
            mode="add"
            materials={data?.materials || []}
            onSubmit={(payload) => mutation.mutate(payload)}
            onCancel={() => router.push('/dashboard/manage_online_system/material')}
            submitting={mutation.isPending}
            errorMessage={error}
          />
        </div>
      </div>
    </div>
  );
}
