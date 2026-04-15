import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from "recharts";

// Color function for bars - alternating colors
function getBarColor(index) {
  const colors = [
    'rgb(54, 162, 235)',  // Blue
    'rgb(255, 99, 132)',   // Pink/Red
    '#3dd228'              // Green
  ];
  return colors[index % colors.length];
}

export default function MockExamPerformanceChart({ chartData, height = 500 }) {
  const data = useMemo(() => {
    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      return [];
    }
    return chartData.map(item => ({
      lesson: item.lesson_name || item.lesson || 'Unknown',
      percentage: item.percentage || 0,
      result: item.result || '0 / 0' // Include result from API
    }));
  }, [chartData]);

  if (!data.length) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#6c757d',
        fontSize: '1.1rem',
        fontWeight: '500',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        📊 No mock exam data to display yet
      </div>
    );
  }

  return (
    <>
      <div className="mock-exam-chart-container" style={{ width: '100%', height: height }}>
        <ResponsiveContainer>
          <BarChart 
          data={data} 
          margin={{ top: 20, right: 10, left: 10, bottom: 50 }}
          className="mock-exam-bar-chart"
        >
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
            <XAxis 
              dataKey="lesson" 
              stroke="#6c757d"
              fontSize={12}
              tick={{ fill: '#495057', fontSize: 14 }}
              interval={0} 
              angle={-20} 
              textAnchor="end" 
              height={50}
              className="mock-exam-x-axis"
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fill: '#495057', fontSize: 14 }}
              stroke="#6c757d"
              label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', offset: -5, style: { textAnchor: 'middle', fontSize: 14 } }}
              className="mock-exam-y-axis"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '0.875rem'
              }}
              formatter={(value, name, props) => {
                const lesson = props.payload.lesson;
                const percentage = value.toFixed(1);
                const result = props.payload.result || '0 / 0';
                return [
                  <div key="tooltip" style={{ color: '#000000' }}>
                    <div><strong style={{ color: '#000000' }}>Lesson:</strong> {lesson}</div>
                    <div><strong style={{ color: '#000000' }}>Percentage:</strong> {percentage}%</div>
                    <div><strong style={{ color: '#000000' }}>Result:</strong> {result}</div>
                  </div>
                ];
              }}
              labelStyle={{ display: 'none' }}
            />
            <Bar 
              dataKey="percentage" 
              radius={[6, 6, 0, 0]} 
              maxBarSize={50}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <style jsx global>{`
        @media (max-width: 768px) {
          .mock-exam-chart-container {
            height: 350px !important;
            overflow-x: auto;
          }
          .mock-exam-bar-chart {
            min-width: 100%;
          }
          .mock-exam-chart-container .recharts-cartesian-axis-tick text {
            font-size: 11px !important;
          }
          .mock-exam-chart-container .mock-exam-x-axis .recharts-cartesian-axis-tick text {
            font-size: 10px !important;
          }
          .mock-exam-chart-container .mock-exam-y-axis .recharts-label {
            font-size: 16px !important;
            font-weight: 600 !important;
          }
          .mock-exam-chart-container .mock-exam-y-axis .recharts-cartesian-axis-tick text {
            font-size: 12px !important;
          }
        }
        
        @media (max-width: 480px) {
          .mock-exam-chart-container {
            height: 320px !important;
            overflow-x: auto;
          }
          .mock-exam-bar-chart {
            min-width: 100%;
          }
          .mock-exam-chart-container .recharts-cartesian-axis-tick text {
            font-size: 10px !important;
          }
          .mock-exam-chart-container .mock-exam-x-axis .recharts-cartesian-axis-tick text {
            font-size: 9px !important;
          }
          .mock-exam-chart-container .mock-exam-y-axis .recharts-label {
            font-size: 18px !important;
            font-weight: 700 !important;
          }
          .mock-exam-chart-container .mock-exam-y-axis .recharts-cartesian-axis-tick text {
            font-size: 11px !important;
          }
        }
        
        @media (max-width: 360px) {
          .mock-exam-chart-container {
            height: 280px !important;
            overflow-x: auto;
          }
          .mock-exam-bar-chart {
            min-width: 100%;
          }
          .mock-exam-chart-container .recharts-cartesian-axis-tick text {
            font-size: 9px !important;
          }
          .mock-exam-chart-container .mock-exam-x-axis .recharts-cartesian-axis-tick text {
            font-size: 8px !important;
          }
          .mock-exam-chart-container .mock-exam-y-axis .recharts-label {
            font-size: 16px !important;
            font-weight: 700 !important;
          }
          .mock-exam-chart-container .mock-exam-y-axis .recharts-cartesian-axis-tick text {
            font-size: 10px !important;
          }
        }
      `}</style>
    </>
  );
}
