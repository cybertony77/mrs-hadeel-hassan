import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Title from "../../components/Title";
import { useStudents, useStudent, useSaveMockExam } from '../../lib/api/students';
import { useSystemConfig } from '../../lib/api/system';
import apiClient from '../../lib/axios';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { TextInput, Button, Paper, Group, Text, Alert } from '@mantine/core';
import { IconSearch, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import Image from 'next/image';

export default function MockExam() {
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

  // Mock exam form states
  const [selectedExam, setSelectedExam] = useState("");
  const [examDegree, setExamDegree] = useState("");
  const [examOutOf, setExamOutOf] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isExamDropdownOpen, setIsExamDropdownOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Scoring state
  const [scoringMessage, setScoringMessage] = useState("");

  // System config - check if scoring is enabled
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';

  // Get all students for search functionality
  const { data: allStudents, isLoading: allStudentsLoading } = useStudents();
  
  // React Query mutation for saving mock exam
  const saveMockExamMutation = useSaveMockExam();

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
      
      // Pre-populate form with existing mock exam data
      if (studentData.mockExams && selectedExam) {
        const examIndex = parseInt(selectedExam.replace('Exam ', '')) - 1;
        const examData = studentData.mockExams[examIndex];
        if (examData) {
          setExamDegree(examData.examDegree?.toString() || "");
          setExamOutOf(examData.outOf?.toString() || "");
        } else {
          setExamDegree("");
          setExamOutOf("");
        }
      } else {
        setExamDegree("");
        setExamOutOf("");
      }
    }
  }, [studentData, selectedExam]);

  // Handle mock exam form submission
  const handleMockExamSubmit = async (e) => {
    e.preventDefault();
    
    if (!student) {
      setError("Please search and select a student first.");
      return;
    }

    if (!selectedExam) {
      setError("Please select an exam.");
      return;
    }

    if (!examDegree.trim() || !examOutOf.trim()) {
      setError("Exam degree and out of are required.");
      return;
    }

    const degree = parseFloat(examDegree);
    const outOf = parseFloat(examOutOf);

    if (isNaN(degree) || degree < 0) {
      setError("Exam degree must be a positive number.");
      return;
    }

    if (isNaN(outOf) || outOf <= 0) {
      setError("Out of must be a positive number.");
      return;
    }

    if (degree > outOf) {
      setError("Exam degree cannot be greater than out of.");
      return;
    }

    setError("");

    const examIndex = parseInt(selectedExam.replace('Exam ', '')) - 1;
    const percentage = Math.round((degree / outOf) * 100);

    const mockExamData = {
      studentId: student.id,
      examIndex: examIndex,
      examDegree: degree,
      outOf: outOf,
      percentage: percentage
    };

    console.log('📤 Sending mock exam data:', mockExamData);

    saveMockExamMutation.mutate(mockExamData, {
      onSuccess: async (result) => {
        console.log('✅ Mock exam saved successfully:', result);
        setSaveMessage("✅ Mock exam saved successfully");
        setError("");
        setScoringMessage("");

        // Calculate scoring if enabled
        if (isScoringEnabled) {
          try {
            // Get previous percentage for this exam (if it existed before)
            let previousPercentage = null;
            if (student.mockExams && Array.isArray(student.mockExams)) {
              const prevExam = student.mockExams[examIndex];
              if (prevExam && prevExam.percentage !== null && prevExam.percentage !== undefined) {
                previousPercentage = parseInt(String(prevExam.percentage).replace('%', ''), 10);
                if (isNaN(previousPercentage)) previousPercentage = null;
              }
            }

            const lessonName = `mock_exam_${examIndex + 1}`;
            const scoringResponse = await apiClient.post('/api/scoring/calculate', {
              studentId: student.id,
              type: 'mock_exam',
              lesson: lessonName,
              data: { percentage, previousPercentage }
            });

            if (scoringResponse.data) {
              const pts = scoringResponse.data.basePoints !== undefined 
                ? scoringResponse.data.basePoints 
                : scoringResponse.data.pointsAdded;
              const bonus = scoringResponse.data.bonusPoints || 0;
              const newScore = scoringResponse.data.newScore;

              let scoreMsg = `Score: ${pts >= 0 ? '+' : ''}${pts} points`;
              if (bonus > 0) scoreMsg += ` (+${bonus} bonus)`;
              if (newScore !== undefined) scoreMsg += ` | Total: ${newScore}`;
              setScoringMessage(scoreMsg);
            }
          } catch (err) {
            console.error('Error calculating mock exam score:', err);
            setScoringMessage("Score calculation failed");
          }
        }

        // Force refetch to sync with DB
        if (refetchStudent) {
          try { await refetchStudent(); } catch {}
        }
        
        // Clear success message after 5 seconds
        setTimeout(() => { setSaveMessage(""); setScoringMessage(""); }, 5000);
      },
      onError: (error) => {
        console.error('❌ Mock exam save error:', error);
        setError("Failed to save mock exam. Please try again.");
        setSaveMessage("");
        setScoringMessage("");
        
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
    setScoringMessage("");
  };

  // Handle clear mock exam form and database
  const handleClearMockExam = async () => {
    if (!student) {
      setError("Please search and select a student first.");
      return;
    }

    if (!selectedExam) {
      setError("Please select an exam to clear.");
      return;
    }

    setError("");
    setSaveMessage("");
    setScoringMessage("");
    setIsClearing(true);

    // Clear form fields
    setExamDegree("");
    setExamOutOf("");

    try {
      // Clear mock exam data in database
      const examIndex = parseInt(selectedExam.replace('Exam ', '')) - 1;
      const clearMockExamData = {
        studentId: student.id,
        examIndex: examIndex,
        examDegree: null,
        outOf: null,
        percentage: null
      };

      console.log('🗑️ Clearing mock exam data:', clearMockExamData);

      // Make direct API call instead of using mutation
      const response = await fetch('/api/mock-exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clearMockExamData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Mock exam cleared successfully:', result);
        setSaveMessage("✅ Mock exam data cleared successfully");
        setError("");
        
        // Force refetch to sync with DB
        if (refetchStudent) {
          try { await refetchStudent(); } catch {}
        }
        
        // Clear success message after 3 seconds
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        const errorData = await response.json();
        console.error('❌ Mock exam clear error:', errorData);
        setError(errorData.error || "Failed to clear mock exam data. Please try again.");
        setSaveMessage("");
      }

    } catch (err) {
      console.error('❌ Error clearing mock exam:', err);
      setError("Error clearing mock exam data. Please try again.");
      setSaveMessage("");
    } finally {
      setIsClearing(false);
    }
  };

  

  // Exam options for dropdown
  const examOptions = Array.from({ length: 50 }, (_, i) => `Exam ${i + 1}`);

  // Handle exam selection
  const handleExamSelect = (exam) => {
    setSelectedExam(exam);
    setIsExamDropdownOpen(false);
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
          .mock-exam-form { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); margin-top: 20px; margin-bottom: 50px;}
          .form-group { margin-bottom: 16px; }
          .form-label { display: block; font-weight: 600; color: #495057; margin-bottom: 6px; }
          .form-input { width: 100%; padding: 10px 12px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; background: #fff; color: #222; box-sizing: border-box; }
          .form-input:focus { outline: none; border-color: #87CEEB; box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1); }
          .save-btn { width: 100%; padding: 12px; background: linear-gradient(90deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
          .save-btn:hover { background: linear-gradient(90deg, #218838 0%, #1e7e34 100%); transform: translateY(-1px); }
          .save-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
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
          .search-results { margin-top: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6; max-height: 240px; overflow-y: auto; }
          .search-result-button { display: block; width: 100%; padding: 12px 16px; margin: 8px 0; background: white; border: 1px solid #dee2e6; border-radius: 6px; text-align: left; cursor: pointer; transition: all 0.2s ease; }
          .result-name { font-weight: 600; color: #1FA8DC; }
          .result-details { font-size: 0.9rem; color: #6c757d; margin-top: 4px; }
          .error-message { background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); color: white; border-radius: 10px; padding: 16px; margin-top: 16px; text-align: center; font-weight: 600; box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3); }
          .success-message { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border-radius: 10px; padding: 16px; margin-top: 16px; text-align: center; font-weight: 600; box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3); }
          .scoring-message { background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); color: white; border-radius: 10px; padding: 14px 16px; margin-top: 12px; text-align: center; font-weight: 600; font-size: 0.95rem; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px; }
          .input-row { display: flex; gap: 12px; }
          .input-half { flex: 1; }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
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
            .input-row { flex-direction: column; }
            .student-details {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        <Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/exam.svg" alt="Mock Exam" width={32} height={32} />
            Mock Exam
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
                  {s.grade || 'N/A'} • {s.main_center || 'N/A'}
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
                <div className="detail-label">Name</div>
                <div className="detail-value">{student.name || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Grade</div>
                <div className="detail-value">{student.grade || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Course</div>
                <div className="detail-value">{student.course || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Course Type</div>
                <div className="detail-value" style={{ textTransform: 'capitalize' }}>{student.courseType || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Student Phone</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{student.phone || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Parent Phone</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{student.parents_phone || student.parentsPhone || 'N/A'}</div>
              </div>
              {isScoringEnabled && (
                <div className="detail-item" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <div className="detail-label">Score</div>
                  <div className="detail-value" style={{ 
                    fontSize: '1.4rem', 
                    fontWeight: '800',
                    color: (student.score !== undefined && student.score !== null && student.score >= 0) ? '#059669' : '#dc2626'
                  }}>
                    {student.score !== undefined && student.score !== null ? student.score : 'N/A'}
                    <span style={{ fontSize: '0.8rem', fontWeight: '500', color: '#6c757d', marginLeft: '6px' }}>pts</span>
                  </div>
                </div>
              )}
            </div>

            {/* Display existing mock exam data */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#495057', marginBottom: '16px' }}>
                Mock Exam Results
              </div>
              {student.mockExams && Array.isArray(student.mockExams) && student.mockExams.some(exam => exam && (exam.examDegree !== null || exam.percentage !== null)) ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {student.mockExams.map((exam, index) => {
                    if (exam && (exam.examDegree !== null || exam.percentage !== null)) {
                      return (
                        <div key={index} className="detail-item" style={{ padding: '12px' }}>
                          <div className="detail-label">Exam {index + 1}</div>
                          <div className="detail-value">
                            {exam.examDegree !== null && exam.outOf !== null && (
                              <div>Degree: {exam.examDegree} / {exam.outOf}</div>
                            )}
                            {exam.percentage !== null && (
                              <div style={{ color: '#28a745', fontWeight: 'bold', marginTop: '1px', marginBottom: '3px' }}>
                                Percentage: {exam.percentage}%
                              </div>
                            )}
                            {exam.date && (
                              <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                Date: {exam.date}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '20px', 
                  color: '#6c757d', 
                  fontSize: '1rem',
                  fontStyle: 'italic'
                }}>
                  There are no recent exams.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mock Exam Form */}
        {student && (
          <div className="mock-exam-form">
            <form onSubmit={handleMockExamSubmit}>
              <div className="form-group">
                <label className="form-label">Select Exam</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <div
                    style={{
                      padding: '14px 16px',
                      border: isExamDropdownOpen ? '2px solid #1FA8DC' : '2px solid #e9ecef',
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '1rem',
                      color: selectedExam ? '#000000' : '#adb5bd',
                      transition: 'all 0.3s ease',
                      boxShadow: isExamDropdownOpen ? '0 0 0 3px rgba(31, 168, 220, 0.1)' : 'none'
                    }}
                    onClick={() => setIsExamDropdownOpen(!isExamDropdownOpen)}
                    onBlur={() => setTimeout(() => setIsExamDropdownOpen(false), 200)}
                  >
                    <span>{selectedExam || 'Select Exam'}</span>
                  </div>
                  
                  {isExamDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#ffffff',
                      border: '2px solid #e9ecef',
                      borderRadius: '10px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      zIndex: 1000,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}>
                      {/* Clear selection option */}
                      <div
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f8f9fa',
                          transition: 'background-color 0.2s ease',
                          color: '#dc3545',
                          fontWeight: '500'
                        }}
                        onClick={() => handleExamSelect('')}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#fff5f5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
                      >
                        ✕ Clear selection
                      </div>
                      {examOptions.map((exam) => (
                        <div
                          key={exam}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f8f9fa',
                            transition: 'background-color 0.2s ease',
                            color: '#000000'
                          }}
                          onClick={() => handleExamSelect(exam)}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
                        >
                          {exam}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedExam && (
                <>
                  <div className="form-group">
                    <div className="input-row">
                      <div className="input-half">
                        <label className="form-label">Degree</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Enter degree"
                          value={examDegree}
                          onChange={(e) => setExamDegree(e.target.value)}
                          required
                          min="0"
                          step="0.1"
                        />
                      </div>
                      <div className="input-half">
                        <label className="form-label">Out Of</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Enter out of"
                          value={examOutOf}
                          onChange={(e) => setExamOutOf(e.target.value)}
                          required
                          min="0"
                          step="0.1"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="save-btn"
                    disabled={saveMockExamMutation.isPending || isClearing || !examDegree.trim() || !examOutOf.trim()}
                  >
                    {saveMockExamMutation.isPending ? (
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
                        <IconCheck size={16} />
                        Save Mock Exam
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="clear-btn"
                    onClick={handleClearMockExam}
                    disabled={saveMockExamMutation.isPending || isClearing}
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
                        🗑️ Clear Mock Exam
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {/* Success Message */}
        {saveMessage && (
          <div className="success-message">
            {saveMessage}
          </div>
        )}

        {/* Scoring Message */}
        {scoringMessage && isScoringEnabled && (
          <div className="scoring-message">
            {scoringMessage}
          </div>
        )}
      </div>
    </div>
  );
}
