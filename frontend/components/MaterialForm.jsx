import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import CourseSelect from './CourseSelect';
import CourseTypeSelect from './CourseTypeSelect';
import CenterSelect from './CenterSelect';
import AccountStateSelect from './AccountStateSelect';
import ImportExistingOnlineItemModal from './ImportExistingOnlineItemModal';

export default function MaterialForm({
  mode = 'add',
  initialData,
  materials,
  onSubmit,
  onCancel,
  submitting = false,
  errorMessage = '',
}) {
  const [formData, setFormData] = useState({
    course: initialData?.course || '',
    courseType: initialData?.courseType || '',
    center: initialData?.center || '',
    material_name: initialData?.material_name || '',
    state: initialData?.state || 'Activated',
    comment: initialData?.comment || '',
    pdf_file_name: initialData?.pdf_file_name || '',
    pdf_url: initialData?.pdf_url || '',
  });
  const [errors, setErrors] = useState({});
  const [courseOpen, setCourseOpen] = useState(false);
  const [courseTypeOpen, setCourseTypeOpen] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfUploadError, setPdfUploadError] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importSelectedId, setImportSelectedId] = useState('');
  const [importApplyLoading, setImportApplyLoading] = useState(false);
  const pdfFileInputRef = useRef(null);

  const options = useMemo(
    () =>
      (materials || []).map((m) => ({
        value: String(m._id),
        label: [m.course, m.courseType, m.center, m.material_name].filter(Boolean).join(' • '),
      })),
    [materials]
  );

  const validate = () => {
    const next = {};
    if (!formData.course.trim()) next.course = '❌ Material course is required';
    if (!formData.material_name.trim()) next.material_name = '❌ Material name is required';
    if (!formData.pdf_file_name.trim()) next.pdf_file_name = '❌ PDF file name is required';
    if (!formData.pdf_url.trim()) next.pdf_url = '❌ PDF file is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') return setPdfUploadError('Only PDF files are allowed');
    if (file.size > 20 * 1024 * 1024) return setPdfUploadError('File size exceeds 20MB limit');
    setPdfUploadError('');
    setPdfUploading(true);
    setPdfProgress(0);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPdfProgress(30);
      const apiClient = (await import('../lib/axios')).default;
      const response = await apiClient.post(
        '/api/upload/pdf-file',
        { file: base64, fileType: file.type, folder: 'material' },
        { onUploadProgress: (p) => p.total && setPdfProgress(30 + Math.round((p.loaded / p.total) * 70)) }
      );
      if (response.data.success) {
        setFormData((prev) => ({ ...prev, pdf_url: response.data.url }));
        setErrors((prev) => ({ ...prev, pdf_url: undefined }));
        setPdfProgress(100);
      }
    } catch (err) {
      setPdfUploadError(err.response?.data?.error || 'Failed to upload PDF');
    } finally {
      setPdfUploading(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!validate()) return;
        onSubmit({
          course: formData.course.trim(),
          courseType: formData.course.trim() ? (formData.courseType.trim() || null) : null,
          center: formData.center.trim() || null,
          material_name: formData.material_name.trim(),
          state: formData.state || 'Activated',
          comment: formData.comment.trim() || '',
          pdf_file_name: formData.pdf_file_name.trim(),
          pdf_url: formData.pdf_url.trim(),
        });
      }}
    >
      <div style={{ marginBottom: 24, padding: 18, borderRadius: 14, background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1.5px solid #bae6fd', textAlign: 'center' }}>
        <div style={{ fontWeight: 700, color: '#0c4a6e', marginBottom: 8 }}>Import from another material</div>
        <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: '#0369a1', lineHeight: 1.45, maxWidth: 520, marginInline: 'auto' }}>
          Copy fields from an existing material into this form. You can edit before saving, and nothing is saved until you submit.
        </p>
        <button type="button" onClick={() => { setImportSelectedId(''); setImportModalOpen(true); }} style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #1FA8DC 0%, #0284c7 100%)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Choose material to import...
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Material Course <span style={{ color: 'red' }}>*</span></label>
        <CourseSelect selectedGrade={formData.course} onGradeChange={(v) => setFormData((p) => ({ ...p, course: v }))} showAllOption={true} required={true} isOpen={courseOpen} onToggle={() => { setCourseOpen(!courseOpen); setCourseTypeOpen(false); setCenterOpen(false); }} onClose={() => setCourseOpen(false)} />
        {errors.course && <div style={{ color: '#dc3545', fontSize: '.875rem', marginTop: 4 }}>{errors.course}</div>}
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Material Course Type</label>
        <CourseTypeSelect selectedCourseType={formData.courseType} onCourseTypeChange={(v) => setFormData((p) => ({ ...p, courseType: v }))} isOpen={courseTypeOpen} onToggle={() => { setCourseTypeOpen(!courseTypeOpen); setCourseOpen(false); setCenterOpen(false); }} onClose={() => setCourseTypeOpen(false)} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Material Center</label>
        <CenterSelect selectedCenter={formData.center} onCenterChange={(v) => setFormData((p) => ({ ...p, center: v }))} required={false} isOpen={centerOpen} onToggle={() => { setCenterOpen(!centerOpen); setCourseOpen(false); setCourseTypeOpen(false); }} onClose={() => setCenterOpen(false)} />
      </div>
      <AccountStateSelect value={formData.state} onChange={(v) => setFormData((p) => ({ ...p, state: v || 'Activated' }))} label="Material State" placeholder="Select Material State" required={true} />
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Material Name <span style={{ color: 'red' }}>*</span></label>
        <input value={formData.material_name} onChange={(e) => setFormData((p) => ({ ...p, material_name: e.target.value }))} placeholder="Enter Material Name" style={{ width: '100%', padding: '12px 16px', border: errors.material_name ? '2px solid #dc3545' : '2px solid #e9ecef', borderRadius: 10, fontSize: '1rem' }} />
        {errors.material_name && <div style={{ color: '#dc3545', fontSize: '.875rem', marginTop: 4 }}>{errors.material_name}</div>}
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Comment (Optional)</label>
        <textarea rows={3} value={formData.comment} onChange={(e) => setFormData((p) => ({ ...p, comment: e.target.value }))} placeholder="Add a comment or note..." style={{ width: '100%', padding: '12px 16px', border: '2px solid #e9ecef', borderRadius: 10, fontSize: '1rem', resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e9ecef', marginBottom: 20 }}>
          <button type="button" style={{ padding: '12px 24px', border: 'none', borderBottom: '3px solid #1FA8DC', background: 'transparent', color: '#1FA8DC', fontWeight: 600 }}>PDF</button>
        </div>
        <div style={{ padding: 20, border: '2px solid #e9ecef', borderRadius: 12, backgroundColor: '#f8f9fa' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>File Name <span style={{ color: 'red' }}>*</span></label>
            <input value={formData.pdf_file_name} onChange={(e) => setFormData((p) => ({ ...p, pdf_file_name: e.target.value }))} placeholder="Enter PDF File Name" style={{ width: '100%', padding: '12px 16px', border: errors.pdf_file_name ? '2px solid #dc3545' : '2px solid #e9ecef', borderRadius: 10, fontSize: '1rem' }} />
            {errors.pdf_file_name && <div style={{ color: '#dc3545', fontSize: '.875rem', marginTop: 4 }}>{errors.pdf_file_name}</div>}
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Upload PDF <span style={{ color: 'red' }}>*</span></label>
            {!formData.pdf_url && !pdfUploading && !pdfUploadError && (
              <div onClick={() => pdfFileInputRef.current?.click()} style={{ border: errors.pdf_url ? '2px dashed #dc3545' : '2px dashed #ccc', borderRadius: 8, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#fff' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8, color: '#999' }}>+</div>
                <div style={{ color: '#666', fontSize: '.95rem' }}>Click to select a PDF file</div>
                <div style={{ color: '#999', fontSize: '.8rem', marginTop: 4 }}>PDF (max 20MB)</div>
              </div>
            )}
            {pdfUploading && (
              <div style={{ border: '2px solid #1FA8DC', borderRadius: 8, padding: 20, backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span>Uploading PDF...</span><span>{pdfProgress}%</span></div>
                <div style={{ width: '100%', height: 8, backgroundColor: '#e9ecef', borderRadius: 4 }}><div style={{ width: `${pdfProgress}%`, height: '100%', backgroundColor: '#1FA8DC', borderRadius: 4 }} /></div>
              </div>
            )}
            {formData.pdf_url && !pdfUploading && (
              <div style={{ border: '2px solid #28a745', borderRadius: 8, padding: '16px 20px', backgroundColor: '#f0fff4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#28a745', fontWeight: 600 }}>✅ Uploaded successfully</div>
                  <div style={{ color: '#666', fontSize: '.85rem' }}>{formData.pdf_file_name || 'PDF file'}</div>
                </div>
                <button type="button" onClick={() => setFormData((p) => ({ ...p, pdf_url: '' }))} style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>❌ Remove</button>
              </div>
            )}
            {pdfUploadError && !pdfUploading && !formData.pdf_url && <div style={{ color: '#dc3545', marginTop: 6 }}>{pdfUploadError}</div>}
            <input ref={pdfFileInputRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => handleUpload(e.target.files?.[0])} />
            {errors.pdf_url && !pdfUploadError && <div style={{ color: '#dc3545', fontSize: '.875rem', marginTop: 4 }}>{errors.pdf_url}</div>}
          </div>
        </div>
      </div>

      {errorMessage && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 10, padding: 16, marginBottom: 24, textAlign: 'center', fontWeight: 600 }}>{errorMessage}</div>}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button type="submit" disabled={submitting || pdfUploading} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          {submitting ? 'Saving...' : mode === 'edit' ? 'Update' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} style={{ padding: '12px 24px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
      </div>

      <ImportExistingOnlineItemModal
        open={importModalOpen}
        onClose={() => !importApplyLoading && setImportModalOpen(false)}
        title="Import material"
        description="Pick a material to copy into this form. Edit before saving."
        options={options}
        selectedValue={importSelectedId}
        onSelectedValueChange={setImportSelectedId}
        onApply={async () => {
          if (!importSelectedId) return;
          const selected = (materials || []).find((m) => String(m._id) === importSelectedId);
          if (!selected) return;
          setImportApplyLoading(true);
          setFormData({
            course: selected.course || '',
            courseType: selected.courseType || '',
            center: selected.center || '',
            material_name: selected.material_name || '',
            state: selected.state || 'Activated',
            comment: selected.comment || '',
            pdf_file_name: selected.pdf_file_name || '',
            pdf_url: selected.pdf_url || '',
          });
          setImportApplyLoading(false);
          setImportSelectedId('');
        }}
        applyLabel="Load"
        emptyMessage="No materials found in the system."
        applyLoading={importApplyLoading}
      />
    </form>
  );
}
