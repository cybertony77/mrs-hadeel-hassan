import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Title from '../../../components/Title';
import NeedHelp from '../../../components/NeedHelp';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import { clientItemVisibleByCenter } from '../../../lib/studentCenterMatch';

export default function MyMaterial() {
  const { data: profile } = useProfile();
  const [notePopup, setNotePopup] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['materials-student'],
    queryFn: async () => (await apiClient.get('/api/materials/student')).data,
    refetchOnWindowFocus: false,
  });

  const materials = data?.materials || [];
  const centerFiltered = useMemo(
    () =>
      materials
        .filter((item) => (item.state || 'Activated') !== 'Deactivated')
        .filter((item) => clientItemVisibleByCenter(item.center, profile?.main_center)),
    [materials, profile?.main_center]
  );

  return (
    <div className="page-wrapper" style={{ minHeight: '100vh', padding: '20px 5px' }}>
      <div className="page-content" style={{ maxWidth: 800, margin: '40px auto', padding: '20px 5px' }}>
        <Title backText="Back" href="/student_dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Image src="/notes4.svg" alt="Material" width={30} height={30} />
            My Material
          </div>
        </Title>

        <div className="homeworks-container" style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>Loading material...</div>
          ) : centerFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>❌ No material available.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {centerFiltered.map((item) => (
                <div
                  key={item._id}
                  className="homework-item"
                  style={{
                    border: '2px solid #e9ecef',
                    borderRadius: 12,
                    padding: 20,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1FA8DC';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(31, 168, 220, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e9ecef';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div className="material-item-content" style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 8 }}>{[item.material_name].filter(Boolean).join(' • ')}</div>
                    <div className="material-file-badge" style={{ padding: '12px 16px', backgroundColor: '#ffffff', border: '2px solid #e9ecef', borderRadius: 8, fontSize: '0.95rem', color: '#495057', textAlign: 'left', display: 'inline-block' }}>
                      <div style={{ fontWeight: 600 }}>{`File Name : ${item.pdf_file_name || 'file'}.pdf`}</div>
                    </div>
                  </div>
                  <div className="homework-buttons" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {item.pdf_url && (
                      <button onClick={() => fetch(item.pdf_url).then((r) => r.blob()).then((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${item.pdf_file_name || 'file'}.pdf`; a.click(); URL.revokeObjectURL(a.href); })} className="hw-action-btn" style={{ padding: '8px 16px', backgroundColor: '#32b750', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Image src="/pdf.svg" alt="PDF" width={18} height={18} />
                        Download PDF
                      </button>
                    )}
                    {item.comment && (
                      <button onClick={() => setNotePopup(item.comment)} className="hw-action-btn" style={{ padding: '8px 16px', backgroundColor: '#1FA8DC', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Image src="/notes4.svg" alt="Notes" width={18} height={18} />
                        Notes
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <NeedHelp style={{ padding: '20px', borderTop: '1px solid #e9ecef', marginTop: 20 }} />
        </div>
      </div>

      {notePopup && (
        <div onClick={() => setNotePopup(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)', borderRadius: 20, padding: 0, maxWidth: 500, width: '100%', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #1FA8DC 0%, #17a2b8 100%)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Image src="/notes4.svg" alt="Notes" width={22} height={22} style={{ filter: 'brightness(0) invert(1)' }} />
                <h3 style={{ margin: 0, color: 'white' }}>Note</h3>
              </div>
              <button onClick={() => setNotePopup(null)} style={{ background: '#dc3545', color: 'white', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 24, color: '#495057', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{notePopup}</div>
          </div>
        </div>
      )}

      <style jsx>{`
        .homework-item {
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        @media (max-width: 768px) {
          .page-wrapper {
            padding: 10px 5px !important;
          }
          .page-content {
            margin: 20px auto !important;
            padding: 8px !important;
          }
          .homeworks-container {
            padding: 16px !important;
          }
          .homework-item {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px;
            padding: 14px !important;
          }
          .material-item-content {
            width: 100%;
          }
          .material-file-badge {
            width: 100%;
            box-sizing: border-box;
          }
          .homework-buttons {
            width: 100%;
            flex-direction: column;
          }
          .homework-buttons button,
          .homework-buttons .hw-action-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
