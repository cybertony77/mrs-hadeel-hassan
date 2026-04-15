import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Title from '../../components/Title';
import { useProfile } from '../../lib/api/auth';
import { useStudent } from '../../lib/api/students';
import apiClient from '../../lib/axios';
import NeedHelp from '../../components/NeedHelp';

// API function to get centers
const centersAPI = {
  getCenters: async () => {
    const response = await apiClient.get('/api/centers');
    return response.data.centers;
  }
};

export default function CentersSchedule() {
  const router = useRouter();
  
  // Get current logged-in user profile
  const { data: profile, isLoading: profileLoading } = useProfile();
  
  // Get student ID from profile
  const studentId = profile?.id ? profile.id.toString() : null;
  
  // Fetch student data to get course
  const { data: studentData, isLoading: studentLoading } = useStudent(studentId, { enabled: !!studentId });
  
  // Fetch centers
  const { data: centers = [], isLoading: centersLoading } = useQuery({
    queryKey: ['centers'],
    queryFn: () => centersAPI.getCenters(),
    retry: 3,
    retryDelay: 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Build schedule data filtered by student course and courseType
  const buildSchedule = () => {
    if (!studentData?.course || !centers || centers.length === 0) {
      console.log('🔍 Schedule Debug - Missing data:', {
        hasStudentCourse: !!studentData?.course,
        studentCourse: studentData?.course,
        centersCount: centers?.length || 0
      });
      return [];
    }

    // Normalize course for comparison (trim whitespace)
    const studentCourse = (studentData.course || '').trim();
    const studentCourseType = (studentData.courseType || '').trim();
    const scheduleRows = [];

    console.log('🔍 Schedule Debug - Building schedule:', {
      studentCourse,
      studentCourseType,
      centersCount: centers.length
    });

    centers.forEach(center => {
      if (!center.grades || center.grades.length === 0) {
        console.log('🔍 Center has no grades:', center.name);
        return;
      }

      console.log('🔍 Checking center:', center.name, {
        grades: center.grades.map(g => ({ course: g.course || g.grade, courseType: g.courseType }))
      });

      // Check if this center has matching course (or "All") and courseType
      const matchingGrades = center.grades.filter(g => {
        const centerCourse = (g.course || g.grade || '').trim(); // Support both course and grade for backward compatibility
        const centerCourseType = (g.courseType || '').trim();
        
        // Check if course matches (either exact match or center has "All")
        const courseMatch = centerCourse.toLowerCase() === 'all' || 
                           centerCourse.toLowerCase() === studentCourse.toLowerCase();
        
        // If courseType exists in center, it must match student's courseType
        // If courseType doesn't exist in center, it matches any student
        const courseTypeMatch = !centerCourseType || 
                               centerCourseType === '' || 
                               centerCourseType.toLowerCase() === studentCourseType.toLowerCase();
        
        const matches = courseMatch && courseTypeMatch;
        
        if (!matches) {
          console.log('🔍 Course/CourseType mismatch:', {
            centerCourse,
            studentCourse,
            centerCourseType,
            studentCourseType,
            matches: false
          });
        } else {
          console.log('✅ Course/CourseType match found:', {
            centerCourse,
            studentCourse,
            centerCourseType,
            studentCourseType
          });
        }
        return matches;
      });
      
      if (matchingGrades.length > 0) {
        console.log('✅ Found matching grades for center:', center.name, {
          count: matchingGrades.length,
          timingsCount: matchingGrades.reduce((sum, g) => sum + (g.timings?.length || 0), 0)
        });
      } else {
        console.log('❌ No matching grades for center:', center.name);
      }
      
      // Add rows for all matching grades
      matchingGrades.forEach(gradeData => {
        if (gradeData.timings && gradeData.timings.length > 0) {
          // Add a row for each timing in this grade
          gradeData.timings.forEach(timing => {
            scheduleRows.push({
              center: center.name,
              day: timing.day,
              time: `${timing.time} ${timing.period}`,
              location: center.location || null
            });
          });
        }
      });
    });

    console.log('🔍 Schedule Debug - Final rows:', scheduleRows.length);
    return scheduleRows;
  };

  const scheduleData = buildSchedule();
  const isLoading = profileLoading || studentLoading || centersLoading;

  return (
    <div style={{ 
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: "800px",
      margin: "40px auto",
      padding: "20px 15px 20px 15px" 
    }}>
      <Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src="/calendar.svg" alt="Calendar" width={32} height={32} />
          Centers Schedule
        </div>
      </Title>
      
      <div className="schedule-container" style={{ 
        maxWidth: '800px', 
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '30px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        width: '100%'
      }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ 
              fontSize: '1.2rem', 
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Loading schedule...
            </div>
          </div>
        ) : !studentData?.course ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: '#666', margin: '0 0 16px 0' }}>No Course Assigned</h3>
            <p style={{ color: '#999', margin: 0 }}>
              Please contact your administrator to assign a course.
            </p>
          </div>
        ) : scheduleData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: '#666', margin: '0 0 16px 0' }}>No Schedule Found</h3>
            <p style={{ color: '#999', margin: '0 0 16px 0' }}>
              No centers found with schedule for course:{' '}
              <strong>
                {studentData.courseType && studentData.courseType.toLowerCase() === 'basics'
                  ? 'Basics'
                  : studentData.course}
              </strong>
              {studentData.courseType &&
                studentData.courseType.toLowerCase() !== 'basics' && (
                  <span> ({studentData.courseType})</span>
                )}
            </p>
          </div>
        ) : (
          <>
            {studentData?.course && (
              <div
                className="student-course-header"
                style={{
                textAlign: 'center',
                marginBottom: '30px',
                color: 'rgb(29, 165, 245)',
                fontSize: '30px',
                  fontFamily: 'fantasy',
                }}
              >
                {studentData.courseType && studentData.courseType.toLowerCase() === 'basics'
                  ? 'Basics'
                  : studentData.course}
                {studentData.courseType &&
                  studentData.courseType.toLowerCase() !== 'basics' && (
                    <span
                      style={{
                        fontSize: '20px',
                        marginLeft: '8px',
                        textTransform: 'capitalize',
                      }}
                    >
                      ({studentData.courseType})
                    </span>
                  )}
              </div>
            )}
            <div className="schedule-table-container" style={{
              overflowX: 'auto',
              border: '1px solid #e9ecef',
              borderRadius: '8px'
            }}>
              <table className="schedule-table" style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: '#fff'
              }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#333',
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.95rem'
                    }}>Center</th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#333',
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.95rem'
                    }}>Day</th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#333',
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.95rem'
                    }}>Time</th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#333',
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.95rem'
                    }}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.map((row, index) => (
                    <tr key={index} style={{
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                    >
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e9ecef',
                        color: '#666',
                        fontSize: '0.9rem',
                        textAlign: 'center'
                      }}>{row.center}</td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e9ecef',
                        color: '#666',
                        fontSize: '0.9rem',
                        textAlign: 'center'
                      }}>{row.day}</td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e9ecef',
                        color: '#666',
                        fontSize: '0.9rem',
                        textAlign: 'center'
                      }}>{row.time}</td>
                      <td style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e9ecef',
                        color: '#666',
                        fontSize: '0.9rem',
                        textAlign: 'center'
                      }}>
                        {row.location && row.location.trim() !== '' && row.location !== null ? (
                          <span
                            onClick={() => window.open(row.location, '_blank')}
                            style={{
                              color: '#1FA8DC',
                              cursor: 'pointer',
                              textDecoration: 'none',
                              fontWeight: '600',
                              fontSize: '0.9rem',
                              transition: 'all 0.2s ease',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'transparent',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.color = '#0d5a7a';
                              e.target.style.backgroundColor = '#e9ecef';
                              e.target.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.color = '#1FA8DC';
                              e.target.style.backgroundColor = 'transparent';
                              e.target.style.textDecoration = 'none';
                            }}
                          >
                            <Image src="/maps.svg" alt="Location" width={20} height={20} />
                            Location
                          </span>
                        ) : (
                          <span style={{ color: '#999' }}>No Location</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        
        <NeedHelp style={{ padding: '16px' }} />
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .schedule-table tbody tr:last-child td {
          border-bottom: none;
        }
        
        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .student-course-header {
            font-size: 24px !important;
            margin-bottom: 20px !important;
          }
          
          .schedule-container {
            margin: 20px auto !important;
            padding: 20px 5px 20px 5px !important;
          }
          
          .schedule-table {
            font-size: 0.85rem !important;
          }
          
          .schedule-table th,
          .schedule-table td {
            padding: 10px 12px !important;
          }
        }
        
        @media (max-width: 480px) {
          .student-course-header {
            font-size: 20px !important;
            margin-bottom: 15px !important;
          }
          
          .schedule-container {
            margin: 10px auto !important;
            padding: 20px 5px 20px 5px !important;
          }
          
          .schedule-table {
            font-size: 0.8rem !important;
          }
          
          .schedule-table th,
          .schedule-table td {
            padding: 8px 10px !important;
          }
        }
      `}</style>
    </div>
  );
}

