import { useState, useMemo } from "react";
import HwChart from "./HwChart";
import QuizChart from "./QuizChart";
import MockExamChart from "./MockExamChart";

export default function ChartTabs({
  lessons,
  mockExams,
  onlineMockExams,
  mockExamChartData,
  homeworkChartData,
  homeworkChartLoading,
  quizChartData,
  quizChartLoading,
}) {
  const [active, setActive] = useState('hw');

  const normalizedLessons = useMemo(() => {
    // Ensure lessons are in array of { lesson, homework_degree, quizDegree }
    if (!lessons) return [];
    return Object.keys(lessons).map((key) => ({
      lesson: key,
      ...(lessons[key] || {})
    }));
  }, [lessons]);

  const normalizedMockExams = useMemo(() => {
    // If API chart data is provided, use it directly (same logic as mock-exam-performance API)
    if (mockExamChartData && Array.isArray(mockExamChartData) && mockExamChartData.length > 0) {
      return mockExamChartData.map(item => ({
        exam: item.lesson_name || item.lesson || 'Unknown',
        percentage: item.percentage || 0,
        examDegree: null,
        outOf: null,
        result: item.result || '0 / 0',
        date: null
      })).sort((a, b) => {
        const numA = parseInt((a.exam.match(/\d+/) || [0])[0], 10) || 0;
        const numB = parseInt((b.exam.match(/\d+/) || [0])[0], 10) || 0;
        return numA - numB;
      });
    }

    // Fallback: build from onlineMockExams + mockExams props
    const examDataMap = {}; // keyed by exam label like "Exam 1"

    // First, populate from online_mock_exams (higher priority)
    if (onlineMockExams && Array.isArray(onlineMockExams) && onlineMockExams.length > 0) {
      onlineMockExams.forEach(ome => {
        const lesson = ome.lesson || '';
        const examMatch = lesson.match(/Exam\s+(\d+)/i);
        if (examMatch) {
          const examLabel = `Exam ${examMatch[1]}`;
          const percentageNum = parseInt((ome.percentage || '0').toString().replace('%', ''), 10) || 0;
          // Parse result string "5 / 10"
          const resultParts = (ome.result || '0 / 0').split('/').map(s => s.trim());
          const correctCount = parseInt(resultParts[0], 10) || 0;
          const totalQuestions = parseInt(resultParts[1], 10) || 0;
          
          // Only use the latest result for each exam (last one in array)
          examDataMap[examLabel] = {
            exam: examLabel,
            percentage: percentageNum,
            examDegree: correctCount,
            outOf: totalQuestions,
            date: ome.date_of_end || ome.date_of_start || null
          };
        }
      });
    }

    // Then, fill in from mockExams array (lower priority - only for exams not already covered)
    if (mockExams && Array.isArray(mockExams)) {
      mockExams.forEach((exam, index) => {
        const examLabel = `Exam ${index + 1}`;
        if (!examDataMap[examLabel] && exam && (exam.percentage > 0 || exam.examDegree > 0)) {
          examDataMap[examLabel] = {
            exam: examLabel,
            percentage: exam.percentage || 0,
            examDegree: exam.examDegree || 0,
            outOf: exam.outOf || 0,
            date: exam.date || null
          };
        }
      });
    }

    // Convert to sorted array
    return Object.values(examDataMap)
      .sort((a, b) => {
        const numA = parseInt(a.exam.replace('Exam ', ''), 10) || 0;
        const numB = parseInt(b.exam.replace('Exam ', ''), 10) || 0;
        return numA - numB;
      });
  }, [mockExams, onlineMockExams, mockExamChartData]);

  return (
    <div style={{ marginTop: 24 }}>
      <div className="chart-tabs-buttons" style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
        <button
          onClick={() => setActive('hw')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '8px 0 0 0',
            border: active === 'hw' ? '2px solid #1FA8DC' : '1px solid #dee2e6',
            background: active === 'hw' ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : 'white',
            color: active === 'hw' ? '#1FA8DC' : '#6c757d',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Homeworks Chart
        </button>
        <button
          onClick={() => setActive('quiz')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '0',
            border: active === 'quiz' ? '2px solid #1FA8DC' : '1px solid #dee2e6',
            background: active === 'quiz' ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : 'white',
            color: active === 'quiz' ? '#1FA8DC' : '#6c757d',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Quizzes Chart
        </button>
        <button
          onClick={() => setActive('mock')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '0 8px 8px 0',
            border: active === 'mock' ? '2px solid #1FA8DC' : '1px solid #dee2e6',
            background: active === 'mock' ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : 'white',
            color: active === 'mock' ? '#1FA8DC' : '#6c757d',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Mock Exams Chart
        </button>
      </div>

      <div className="chart-tabs-body" style={{ background: 'white', border: '1px solid #dee2e6', borderRadius: 12, padding: 20 }}>
        {active === 'hw' ? (
          <HwChart
            lessons={normalizedLessons}
            chartData={homeworkChartData}
            chartLoading={homeworkChartLoading}
          />
        ) : active === 'quiz' ? (
          <QuizChart
            lessons={normalizedLessons}
            chartData={quizChartData}
            chartLoading={quizChartLoading}
          />
        ) : (
          <MockExamChart mockExams={normalizedMockExams} />
        )}
      </div>
      <style jsx>{`
        @media (max-width: 900px) {
          .chart-tabs-buttons {
            display: flex !important;
            flex-direction: row !important;
            gap: 0 !important;
          }
          .chart-tabs-buttons button {
            width: auto !important;
            flex: 1 !important;
            border-radius: 0 !important;
            font-size: 0.84rem !important;
            padding: 10px 8px !important;
            white-space: nowrap !important;
          }
          .chart-tabs-buttons button:first-child {
            border-radius: 8px 0 0 0 !important;
          }
          .chart-tabs-buttons button:last-child {
            border-radius: 0 8px 8px 0 !important;
          }
          .chart-tabs-body {
            padding: 12px !important;
          }
        }
      `}</style>
    </div>
  );
}

