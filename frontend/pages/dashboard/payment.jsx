import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Title from "../../components/Title";
import { useStudents, useStudent, useSavePayment } from '../../lib/api/students';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import Image from 'next/image';

export default function Payment() {
  const containerRef = useRef(null);
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState("");
  const [error, setError] = useState("");
  const [student, setStudent] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [studentDeleted, setStudentDeleted] = useState(false);

  // Payment form states
  const [numberOfSessions, setNumberOfSessions] = useState("");
  const [cost, setCost] = useState("");
  const [paymentComment, setPaymentComment] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  // Get all students for search functionality
  const { data: allStudents, isLoading: allStudentsLoading } = useStudents();
  
  // React Query mutation for saving payment
  const savePaymentMutation = useSavePayment();

  // Handle search form submission
  const handleIdSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    
    setError("");
    setStudentDeleted(false);
    setSearchResults([]);
    setShowSearchResults(false);
    setIsSearching(true);

    const searchTerm = studentId.trim();
    const isAllDigits = /^\d+$/.test(searchTerm);
    const isFullPhone = /^\d{11}$/.test(searchTerm);

    try {
      if (isFullPhone) {
        // Search by full phone number
        if (allStudents) {
          const matchingStudents = allStudents.filter(s =>
            s.phone === searchTerm || s.parents_phone === searchTerm
          );
          if (matchingStudents.length === 1) {
            setSearchId(matchingStudents[0].id.toString());
            setStudentId(matchingStudents[0].id.toString());
            setStudent(matchingStudents[0]);
          } else if (matchingStudents.length > 1) {
            setSearchResults(matchingStudents);
            setShowSearchResults(true);
            setError(`Found ${matchingStudents.length} students. Please select one.`);
          } else {
            setError(`No student found with phone number ${searchTerm}`);
          }
        } else {
          setError("Student data not loaded. Please try again.");
        }
        return;
      }

      if (isAllDigits) {
        // Search by student ID
        if (allStudents) {
          const byId = allStudents.find(s => String(s.id) === searchTerm);
          if (byId) {
            setSearchId(String(byId.id));
            setStudentId(String(byId.id));
            setStudent(byId);
            return;
          }

          // Search by partial phone number
          const term = searchTerm;
          const matchingStudents = allStudents.filter(s => {
            const phone = String(s.phone || '').replace(/[^0-9]/g, '');
            const parent = String(s.parents_phone || '').replace(/[^0-9]/g, '');
            return phone.startsWith(term) || parent.startsWith(term);
          });

          if (matchingStudents.length === 1) {
            const foundStudent = matchingStudents[0];
            setSearchId(foundStudent.id.toString());
            setStudentId(foundStudent.id.toString());
            setStudent(foundStudent);
            return;
          }

          if (matchingStudents.length > 1) {
            setSearchResults(matchingStudents);
            setShowSearchResults(true);
            setError(`Found ${matchingStudents.length} students. Please select one.`);
            return;
          }
        }
        setError(`No student found with ID ${searchTerm}`);
        return;
      }

      // Search by name
      if (allStudents) {
        const matchingStudents = allStudents.filter(s => 
          s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (matchingStudents.length === 1) {
          const foundStudent = matchingStudents[0];
          setSearchId(foundStudent.id.toString());
          setStudentId(foundStudent.id.toString());
          setStudent(foundStudent);
        } else if (matchingStudents.length > 1) {
          setSearchResults(matchingStudents);
          setShowSearchResults(true);
          setError(`Found ${matchingStudents.length} students. Please select one.`);
        } else {
          setError(`No student found matching "${searchTerm}"`);
        }
      } else {
        setError("Student data not loaded. Please try again.");
      }
    } catch (err) {
      setError("Error searching for student. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // Handle student selection from search results
  const handleStudentSelect = (selectedStudent) => {
    setSearchId(selectedStudent.id.toString());
    setStudentId(selectedStudent.id.toString());
    setSearchResults([]);
    setShowSearchResults(false);
    setError("");
  };

  // Get individual student data using React Query
  const { data: studentData, isLoading: studentLoading, refetch: refetchStudent } = useStudent(searchId ? parseInt(searchId) : null, {
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 1000,
    refetchOnMount: true,
  });

  // Update student state when data is loaded
  useEffect(() => {
    if (studentData) {
      setStudent(studentData);
      
      // Pre-populate form with existing payment data
      if (studentData.payment) {
        setNumberOfSessions(studentData.payment.numberOfSessions?.toString() || "");
        setCost(studentData.payment.cost?.toString() || "");
        setPaymentComment(studentData.payment.paymentComment || "");
      } else {
        // Clear form if no payment data exists
        setNumberOfSessions("");
        setCost("");
        setPaymentComment("");
      }
    }
  }, [studentData]);

  // Handle payment form submission
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    if (!student) {
      setError("Please search and select a student first.");
      return;
    }

    if (!numberOfSessions.trim() && !cost.trim()) {
      setError("Number of sessions and cost are required.");
      return;
    }
    if (!numberOfSessions.trim()) {
      setError("Number of sessions is required.");
      return;
    }
    if (!cost.trim()) {
      setError("Cost is required.");
      return;
    }

    const sessions = parseInt(numberOfSessions);
    const costValue = parseFloat(cost);

    if (isNaN(sessions) || sessions <= 0) {
      setError("Number of sessions must be a positive number.");
      return;
    }

    if (isNaN(costValue) || costValue <= 0) {
      setError("Cost must be a positive number.");
      return;
    }

    setError("");

    const paymentData = {
      studentId: student.id,
      numberOfSessions: sessions,
      cost: costValue,
      paymentComment: paymentComment.trim() || null
    };

    console.log('📤 Sending payment data:', paymentData);
    console.log('👤 Student data:', student);

    savePaymentMutation.mutate(paymentData, {
      onSuccess: async (result) => {
        console.log('✅ Payment saved successfully:', result);
        setSaveMessage("✅ Payment saved successfully");
        setError("");
        // Optimistically update local student state for instant UI feedback
        setStudent((prev) => prev ? {
          ...prev,
          payment: {
            numberOfSessions: sessions,
            cost: costValue,
            paymentComment: paymentComment.trim() || null,
            date: studentData?.payment?.date || null
          }
        } : prev);
        // Force refetch to sync with DB
        if (refetchStudent) {
          try { await refetchStudent(); } catch {}
        }
        
        // Clear success message after 5 seconds
        setTimeout(() => setSaveMessage(""), 5000);
      },
      onError: (error) => {
        console.error('❌ Payment save error:', error);
        
        // Determine error type and message
        let errorMessage = "Failed to save payment. Please try again.";
        
        if (error.message?.includes('Authentication failed')) {
          errorMessage = "Authentication failed. Please log in again.";
        } else if (error.message?.includes('Student not found')) {
          errorMessage = "Student not found. Please search for the student again.";
        } else if (error.message?.includes('validation') || error.message?.includes('required')) {
          errorMessage = error.message;
        } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        setError(errorMessage);
        setSaveMessage("");
        
        // Clear error message after 8 seconds
        setTimeout(() => setError(""), 8000);
      }
    });
  };

  // Clear error message after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle input change like student_info page (hide student until search)
  const handleIdChange = (e) => {
    const value = e.target.value;
    setStudentId(value);
    setSearchId("");
    setStudent(null);
    setShowSearchResults(false);
    setSearchResults([]);
    setError("");
    setSaveMessage("");
  };

  // Handle clear payment form and database
  const handleClearPayment = async () => {
    if (!student) {
      setError("Please search and select a student first.");
      return;
    }

    setError("");
    setSaveMessage("");
    setIsClearing(true);

    // Clear form fields
    setNumberOfSessions("");
    setCost("");
    setPaymentComment("");

    try {
      // Clear payment data in database
      const clearPaymentData = {
        studentId: student.id,
        numberOfSessions: null,
        cost: null,
        paymentComment: null,
        date: null
      };

      console.log('🗑️ Clearing payment data:', clearPaymentData);

      // Make direct API call instead of using mutation
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clearPaymentData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Payment cleared successfully:', result);
        setSaveMessage("✅ Payment data cleared successfully");
        setError("");
        
        // Force refetch to sync with DB
        if (refetchStudent) {
          try { await refetchStudent(); } catch {}
        }
        
        // Clear success message after 3 seconds
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        const errorData = await response.json();
        console.error('❌ Payment clear error:', errorData);
        setError(errorData.error || "Failed to clear payment data. Please try again.");
        setSaveMessage("");
      }

    } catch (err) {
      console.error('❌ Error clearing payment:', err);
      setError("Error clearing payment data. Please try again.");
      setSaveMessage("");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '20px 5px 20px 5px' }}>
      <div ref={containerRef} style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
        <style jsx>{`
          .title { font-size: 2rem; font-weight: 700; color: #ffffff; margin-bottom: 24px; text-align: center; }
          .search-section { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); margin-bottom: 24px; }
          .search-form { display: flex; gap: 12px; align-items: center; margin-bottom: 0; }
          .fetch-input { flex: 1; padding: 14px 16px; border: 2px solid #e9ecef; border-radius: 10px; font-size: 1rem; transition: all 0.3s ease; background: #ffffff; color: #000000; }
          .fetch-input:focus { outline: none; border-color: #667eea; background: white; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
          .fetch-btn { background: linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%); color: white; border: none; border-radius: 12px; padding: 16px 28px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3); display: flex; align-items: center; gap: 8px; min-width: 140px; justify-content: center; }
          .fetch-btn:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4); background: linear-gradient(135deg, #0d8bc7 0%, #5bb8e6 100%); }
          .fetch-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: 0 2px 8px rgba(31, 168, 220, 0.2); }
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .info-container { background: white; border-radius: 16px; padding: 32px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.2); margin-top: 20px; }
          .student-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 30px;
          }
          
          .student-details .detail-item:last-child:nth-child(odd) {
            grid-column: 1 / -1;
          }
          .detail-item { padding: 20px; background: #ffffff; border-radius: 12px; border: 2px solid #e9ecef; border-left: 4px solid #1FA8DC; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: all 0.3s ease; }
          .detail-label { font-weight: 700; color: #6c757d; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
          .detail-value { font-size: 1rem; color: #212529; font-weight: 600; line-height: 1.4; }
          .payment-form { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
          .form-group {
            margin-bottom: 16px;
          }
          .form-label {
            display: block;
            font-weight: 600;
            color: #495057;
            margin-bottom: 6px;
          }
          .form-input {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 1rem;
            background: #fff;
            color: #222;
            box-sizing: border-box;
          }
          .form-input:focus {
            outline: none;
            border-color: #87CEEB;
            box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
          }
          .form-textarea {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 1rem;
            background: #fff;
            color: #222;
            min-height: 80px;
            resize: vertical;
            font-family: inherit;
            box-sizing: border-box;
          }
          .form-textarea:focus {
            outline: none;
            border-color: #87CEEB;
            box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
          }
          .save-btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          .save-btn:hover {
            background: linear-gradient(90deg, #218838 0%, #1e7e34 100%);
            transform: translateY(-1px);
          }
          .save-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }
          .clear-btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(90deg, #dc3545 0%, #c82333 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-top: 12px;
          }
          .clear-btn:hover {
            background: linear-gradient(90deg, #c82333 0%, #bd2130 100%);
            transform: translateY(-1px);
          }
          .search-results {
            margin-top: 16px;
            padding: 16px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #dee2e6;
            max-height: 240px;
            overflow-y: auto;
          }
          .search-result-button {
            display: block;
            width: 100%;
            padding: 12px 16px;
            margin: 8px 0;
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .result-name {
            font-weight: 600;
            color: #1FA8DC;
          }
          .result-details {
            font-size: 0.9rem;
            color: #6c757d;
            margin-top: 4px;
          }
          .required {
            color: #dc3545;
          }
          .error-message { background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); color: white; border-radius: 10px; padding: 16px; margin-top: 16px; text-align: center; font-weight: 600; box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3); }
          .success-message { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border-radius: 10px; padding: 16px; margin-top: 16px; text-align: center; font-weight: 600; box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3); }
          
          @media (max-width: 768px) {
            .search-form {
              flex-direction: column;
              gap: 12px;
            }
            .fetch-btn {
              width: 100%;
              padding: 14px 20px;
              font-size: 0.95rem;
              justify-content: center;
            }
            .fetch-input {
              width: 100%;
            }
            .student-details {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        <Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/money.svg" alt="Payment" width={35} height={35} />
            Payment
          </div>
        </Title>

        {/* Search Section */}
        <div className="search-section">
          <form onSubmit={handleIdSubmit} className="search-form">
            <input
              type="text"
              className="fetch-input"
              placeholder="Enter Student ID, Name, Phone Number"
              value={studentId}
              onChange={handleIdChange}
              disabled={isSearching}
              required
            />
            <button
              type="submit"
              className="fetch-btn"
              disabled={isSearching}
            >
              {isSearching ? 'Loading...' : '🔍 Search'}
            </button>
          </form>
        </div>

        {/* Search Results */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="search-results">
            <div style={{ marginBottom: "12px", fontWeight: 600, color: "#495057" }}>Select a student:</div>
            {searchResults.map((s) => (
              <button
                key={s.id}
                className="search-result-button"
                onClick={() => handleStudentSelect(s)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#e9ecef";
                  e.currentTarget.style.borderColor = "#1FA8DC";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.borderColor = "#dee2e6";
                }}
              >
                <div className="result-name">{s.name} (ID: {s.id})</div>
                <div className="result-details">
                  <span style={{ fontFamily: 'monospace' }}>{s.phone || 'N/A'}</span>
                </div>
                <div className="result-details" style={{ marginTop: 2 }}>
                  {s.course || s.grade || 'N/A'} • {s.main_center || 'N/A'}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Student Information */}
        {student && (
          <div className="info-container">
            <div className="student-details">
              <div className="detail-item">
                <div className="detail-label">Full Name</div>
                <div className="detail-value">{student.name}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Course</div>
                <div className="detail-value">{student.course || student.grade || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Course Type</div>
                <div className="detail-value">{student.courseType || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Student Phone</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{student.phone || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Parent Phone</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{student.parents_phone || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Number of Sessions</div>
                <div className="detail-value" style={{ 
                  color: (() => {
                    const sessions = student.payment?.numberOfSessions || 0;
                    if (sessions <= 2) return '#dc3545'; // red
                    if (sessions <= 5) return '#ffc107'; // yellow
                    if (sessions <= 8) return '#28a745'; // green
                    return '#1FA8DC'; // blue (>= 9)
                  })(),
                  fontWeight: 'bold',
                  fontSize: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <span style={{ 
                    fontSize: '18px', 
                    fontWeight: '800',
                    lineHeight: '1.2'
                  }}>
                    {student.payment?.numberOfSessions ?? 0}
                  </span>
                  <span style={{ 
                    fontSize: '17px', 
                    fontWeight: '600',
                    opacity: '0.9',
                    textTransform: 'lowercase'
                  }}>
                    sessions
                  </span>
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Cost</div>
                <div className="detail-value">{student.payment?.cost ?? 0} EGP</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Payment Comment</div>
                <div className="detail-value">{student.payment?.paymentComment || 'No Comment'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Last Payment Date</div>
                <div className="detail-value">{student.payment?.date || 'No date'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Spacing between info and payment sections */}
        {student && <div style={{ height: 20 }} />}

        {/* Payment Form */}
        {student && (
          <div className="payment-form">
            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#495057', marginBottom: '16px' }}>
              Payment Details
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="form-group">
                <label className="form-label">
                  Number of Sessions <span className="required">*</span>
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Enter number of sessions"
                  value={numberOfSessions}
                  onChange={(e) => setNumberOfSessions(e.target.value)}
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Cost <span className="required">*</span>
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Enter cost amount"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Comment (Optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Enter payment comment or notes..."
                  value={paymentComment}
                  onChange={(e) => setPaymentComment(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="save-btn"
                disabled={savePaymentMutation.isPending || isClearing || !numberOfSessions.trim() || !cost.trim()}
              >
                {savePaymentMutation.isPending ? (
                  <>
                    <div style={{
                      width: 16,
                      height: 16,
                      border: '2px solid #ffffff',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Image src="/success-mark2.svg" alt="Save" width={18} height={18} />
                    Save Payment
                  </>
                )}
              </button>

              <button
                type="button"
                className="clear-btn"
                onClick={handleClearPayment}
                disabled={savePaymentMutation.isPending || isClearing}
              >
                {isClearing ? (
                  <>
                    <div style={{
                      width: 16,
                      height: 16,
                      border: '2px solid #ffffff',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Clearing...
                  </>
                ) : (
                  <>
                  🗑️ Clear Payment
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {allStudentsLoading && <LoadingSkeleton />}

        {/* Bottom banners like scan page */}
        {(saveMessage || error) && (
          <div style={{ maxWidth: 600, margin: '12px auto 0 auto' }}>
            {saveMessage && (
              <div className="success-message">{saveMessage}</div>
            )}
            {error && (
              <div className="error-message">❌ {error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
