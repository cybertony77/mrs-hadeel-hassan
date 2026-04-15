import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import { useSystemConfig } from '../../lib/api/system';

export default function Dashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const { data: systemConfig } = useSystemConfig();
  const isWhatsAppJoinGroupEnabled = systemConfig?.whatsapp_join_group_btn === true || systemConfig?.whatsapp_join_group_btn === 'true';
  const isMockExamsEnabled = systemConfig?.mock_exams === true || systemConfig?.mock_exams === 'true';
  const isZoomJoinMeetingEnabled = systemConfig?.zoom_join_meeting === true || systemConfig?.zoom_join_meeting === 'true';
  const isPaymentSystemEnabled = systemConfig?.payment_system === true || systemConfig?.payment_system === 'true';

  useEffect(() => {
    // Authentication is now handled by _app.js with HTTP-only cookies
    // This component will only render if user is authenticated
    setUserRole("user"); // Default role, will be updated by _app.js if needed
  }, []);

  return (
    <div style={{ 
      // height: "calc(100dvh - 10rem)",
      padding: "10px 35px 5px 35px",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto'
    }}>
      <div className="main-container" style={{ maxWidth: 600, margin: "10px auto", textAlign: "center" }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          gap: "16px",
          marginBottom: "15px"
        }}>
          <Image
            src="/logo.png"
            alt="Logo"
            width={70}
            height={70}
            style={{
              borderRadius: "50%",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
              objectFit: "cover",
              background: "transparent"
            }}
          />
              <h1 style={{ margin: 0, color: "#ffffff" }}>System Main Dashboard</h1>
        </div>
        
        {/* Access Denied Message */}
        {/* Removed access denied message rendering */}
      <style jsx>{`
        .dashboard-btn {
          width: 100%;
          margin-bottom: 10px;
          padding: 16px 0;
          background: linear-gradient(90deg, #87CEEB 0%, #B0E0E6 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 1px;
          box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .dashboard-btn:hover:not(:disabled) {
          background: linear-gradient(90deg, #5F9EA0 0%, #87CEEB 100%);
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
        }
        .dashboard-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .dashboard-btn.zoom-btn {
          background: linear-gradient(90deg, #2d8cff 0%, #1a6fdb 100%);
          box-shadow: 0 4px 16px rgba(45, 140, 255, 0.3);
        }
        .dashboard-btn.zoom-btn:hover:not(:disabled) {
          background: linear-gradient(90deg, #1a6fdb 0%, #2d8cff 100%);
          box-shadow: 0 8px 25px rgba(45, 140, 255, 0.4);
        }
        .dashboard-btn.whatsapp-btn {
          background: linear-gradient(90deg, #25D366 0%, #128C7E 100%);
          box-shadow: 0 4px 16px rgba(37, 211, 102, 0.3);
        }
        .dashboard-btn.whatsapp-btn:hover:not(:disabled) {
          background: linear-gradient(90deg, #128C7E 0%, #25D366 100%);
          box-shadow: 0 8px 25px rgba(37, 211, 102, 0.4);
        }
        
        @media (max-width: 768px) {
          .dashboard-btn {
            padding: 16px 0;
            font-size: 1.1rem;
            margin-bottom: 10px;
          }
          h1 {
            font-size: 1.8rem !important;
          }
        }
        
        @media (max-width: 480px) {
          .main-container {
            max-width: 600px;
            margin: 20px auto !important;
            text-align: center;
          }
          .dashboard-btn {
            padding: 14px 0;
            font-size: 1.1rem;
            margin-bottom: 10px;
          }
          h1 {
            font-size: 1.5rem !important;
          }
        }
      `}</style>
          <div style={{ marginTop: 30 }}>
        <button 
          className="dashboard-btn"
          onClick={() => router.push("/dashboard/scan_page")}
        >
          <Image src="/scan.svg" alt="Scan" width={20} height={20} />
          QR Code Scanner
        </button>

        <button
          className="dashboard-btn"
          onClick={() => router.push("/dashboard/all_students")}
        >
          <Image src="/users.svg" alt="All Students" width={20} height={20} />
          All Students
        </button>
        <button
          className="dashboard-btn"
          onClick={() => router.push("/dashboard/student_info")}
        >
          <Image src="/user2.svg" alt="Student Info" width={20} height={20} />
          Student Info
        </button>
        <button
          className="dashboard-btn"
          onClick={() => router.push("/dashboard/add_student")}
        >
          <Image src="/user-plus2.svg" alt="Add Student" width={20} height={20} />
          Add Student
        </button>
        <button
          className="dashboard-btn"
          onClick={() => router.push("/dashboard/edit_student")}
        >
          <Image src="/user-edit2.svg" alt="Edit Student" width={20} height={20} />
          Edit Student
        </button>
        <button 
          className="dashboard-btn"
          onClick={() => router.push("/dashboard/delete_student")}
          style={{ background: "linear-gradient(90deg, #dc3545 0%, #ff6b6b 100%)" }}
        >
          <Image src="/trash2.svg" alt="Delete Student" width={20} height={20} />
          Delete Student
        </button>
        {isPaymentSystemEnabled && (
        <button
          className="dashboard-btn"
          onClick={() => router.push("/dashboard/payment")}
          style={{ background: "linear-gradient(90deg, #28a745 0%, #20c997 100%)" }}
        >
          <Image src="/money.svg" alt="Payment" width={25} height={25} />
          Payment
        </button>
        )}
        {isMockExamsEnabled && (
          <button
            className="dashboard-btn"
            onClick={() => router.push("/dashboard/mock_exam")}
            style={{ background: "linear-gradient(90deg, #6f42c1 0%, #8e44ad 100%)" }}
          >
            <Image src="/exam.svg" alt="Mock Exam" width={20} height={20} />
            Mock Exam
          </button>
        )}
        {/* <button
          className="dashboard-btn"
          onClick={() => router.push("/dashboard/qr_generator")}
        >
          <Image src="/qrcode.svg" alt="QR Code" width={20} height={20} />
          Create QR Code
        </button> */}
        <button
          className="dashboard-btn"
          onClick={() => router.push("/dashboard/lessons")}
        >
          <Image src="/books.svg" alt="Lessons" width={20} height={20} />
          Lessons
        </button>
        <button
          className="dashboard-btn"
          onClick={() => router.push("/dashboard/centers")}
        >
          <Image src="/center.svg" alt="Centers" width={20} height={20} />
          Centers
        </button>
        <button
          className="dashboard-btn"
          onClick={() => router.push('/dashboard/session_info')}
        >
          <Image src="/chart6.svg" alt="Session Info" width={20} height={20} />
          Session Info
        </button>
        <button
          className="dashboard-btn"
          onClick={() => router.push("/dashboard/history")}
        >
          <Image src="/history.svg" alt="History" width={20} height={20} />
          History
        </button>
        {isZoomJoinMeetingEnabled && (
          <button
            className="dashboard-btn zoom-btn"
            onClick={() => router.push("/dashboard/join_zoom_meeting")}
          >
            <Image src="/zoom.svg" alt="Zoom" width={20} height={20} />
            Join Zoom Meeting
          </button>
        )}
        {isWhatsAppJoinGroupEnabled && (
          <button
            className="dashboard-btn whatsapp-btn"
            onClick={() => router.push("/dashboard/join_whatsapp_group")}
          >
            <Image src="/whatsapp2.svg" alt="WhatsApp Groups" width={20} height={20} />
            Join WhatsApp Group
          </button>
        )}
      </div>
      </div>
    </div>
  );
}