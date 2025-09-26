import { useState } from 'react';
import { AuthProvider, useAuth } from './components/contexts/AuthContext'; // perbaiki path sesuai file asli
import { AuthContainer } from './components/Auth/AuthContainer'; 
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { Jadwal } from './components/Schedule/Schedule';
import { Tugas } from './components/Task/Tasks';
import { Absensi } from './components/Attendance/Attendance';
import { Manage } from './components/UserManagement/UserManagement';

// Main App Content Component
const AppContent = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-center">Loading...</p>
        </div>
      </div>
    );
  }

  // Jika user belum login, tampilkan AuthContainer
  if (!user) {
    return <AuthContainer />; // otomatis handle login & register
  }

  // Render main app content
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'jadwal':
        return <Jadwal />;
      case 'tugas':
        return <Tugas />;
      case 'absensi':
        return <Absensi />;
      case 'manage':
        return <Manage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

// Main App Component with Provider
const App = () => {
  return (
    <AuthProvider>
      <div className="App">
        <AppContent />
      </div>
    </AuthProvider>
  );
};

export default App;
