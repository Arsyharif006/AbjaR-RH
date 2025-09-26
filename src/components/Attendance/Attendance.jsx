import { useState, useEffect } from 'react';
import { 
  FiCheck, 
  FiX, 
  FiFilter, 
  FiCalendar, 
  FiClock, 
  FiUser, 
  FiEye, 
  FiChevronLeft, 
  FiChevronRight,
  FiUsers,
  FiUserCheck,
  FiAlertCircle,
  FiCheckCircle,
  FiXCircle,
  FiDownload,
  FiBookOpen
} from 'react-icons/fi';
import { Card, Modal } from '../Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

export const Absensi = () => {
  const { user } = useAuth();
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [downloading, setDownloading] = useState(false);

  // Super admin cannot attend - only admin and anggota can attend
  const canAttendClass = user?.role === 'admin' || user?.role === 'anggota';
  // Can download excel - anggota, admin, and super_admin
  const canDownloadExcel = user?.role === 'anggota' || user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    if (canAttendClass) {
      fetchTodaySchedules();
    }
    fetchAttendanceData();
  }, [user, filterDate, filterStatus]);

  const fetchTodaySchedules = async () => {
    try {
      const today = new Date();
      const dayName = today.toLocaleDateString('id-ID', { weekday: 'long' });
      const currentTime = today.toTimeString().slice(0, 5);

      const { data, error } = await supabase
        .from('jadwal')
        .select('*')
        .eq('hari', dayName);

      if (error) throw error;

      // Check if user already attended today
      const todayStr = today.toISOString().split('T')[0];
      const { data: attendanceToday } = await supabase
        .from('absensi')
        .select('jadwal_id')
        .eq('user_id', user.id)
        .eq('tanggal', todayStr);

      const attendedScheduleIds = attendanceToday?.map(a => a.jadwal_id) || [];

      const schedulesWithStatus = data?.map(schedule => {
        const isTimeValid = currentTime >= schedule.jam_mulai && currentTime <= schedule.jam_selesai;
        const hasAttended = attendedScheduleIds.includes(schedule.id);
        
        return {
          ...schedule,
          canAttend: isTimeValid && !hasAttended,
          hasAttended
        };
      }) || [];

      setTodaySchedules(schedulesWithStatus);
    } catch (error) {
      console.error('Error fetching today schedules:', error);
    }
  };

  const fetchAttendanceData = async () => {
    try {
      let query = supabase
        .from('absensi')
        .select(`
          *,
          users:user_id (nama_lengkap, npm, role),
          jadwal:jadwal_id (mata_kuliah),
          approver:approved_by (nama_lengkap)
        `)
        .order('created_at', { ascending: false });

      // Filter by user role
      if (user?.role === 'anggota') {
        query = query.eq('user_id', user.id);
      }

      // Filter by date if specified
      if (filterDate) {
        query = query.eq('tanggal', filterDate);
      }

      // Filter by status if specified
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const attendanceList = data || [];
      setAttendanceData(attendanceList);

      // Calculate stats
      const statsData = {
        total: attendanceList.length,
        pending: attendanceList.filter(a => a.status === 'pending').length,
        approved: attendanceList.filter(a => a.status === 'approved').length,
        rejected: attendanceList.filter(a => a.status === 'rejected').length,
      };
      setStats(statsData);

    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAttendance = (schedule) => {
    setSelectedSchedule(schedule);
    setShowModal(true);
  };

  const submitAttendance = async () => {
    if (!selectedSchedule) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('absensi')
        .insert([{
          user_id: user.id,
          jadwal_id: selectedSchedule.id,
          tanggal: today,
          status: 'pending'
        }]);

      if (error) throw error;

      setShowModal(false);
      fetchTodaySchedules();
      fetchAttendanceData();
      alert('Absensi berhasil! Menunggu persetujuan admin.');
    } catch (error) {
      console.error('Error submitting attendance:', error);
      alert('Gagal melakukan absensi. Silakan coba lagi.');
    }
  };

  const approveAttendance = async (attendanceId, status) => {
    try {
      const { error } = await supabase
        .from('absensi')
        .update({
          status: status,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', attendanceId);

      if (error) throw error;
      fetchAttendanceData();
      
      const statusText = status === 'approved' ? 'disetujui' : 'ditolak';
      alert(`Absensi berhasil ${statusText}.`);
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('Gagal memperbarui status absensi.');
    }
  };

  const canApprove = (attendance) => {
    if (user?.role === 'super_admin') {
      return attendance.users?.role === 'admin' && attendance.status === 'pending';
    } else if (user?.role === 'admin') {
      return attendance.users?.role === 'anggota' && attendance.status === 'pending';
    }
    return false;
  };

  const getWeekNumber = (date) => {
    const startDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
    return Math.ceil(days / 7);
  };

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      // Determine query based on user role
      let query = supabase
        .from('absensi')
        .select(`
          *,
          users:user_id (nama_lengkap, npm, role),
          jadwal:jadwal_id (mata_kuliah),
          approver:approved_by (nama_lengkap)
        `)
        .order('tanggal', { ascending: true });

      // Filter based on role
      if (user?.role === 'anggota' || user?.role === 'admin') {
        // Anggota and admin can only download their own data
        query = query.eq('user_id', user.id);
      }
      // Super admin can download all data (no additional filter needed)

      const { data: allAttendance, error } = await query;

      if (error) throw error;

      // Group by week
      const weeklyData = {};
      
      allAttendance?.forEach(attendance => {
        const date = new Date(attendance.tanggal);
        const weekNum = getWeekNumber(date);
        
        if (!weeklyData[weekNum]) {
          weeklyData[weekNum] = [];
        }

        weeklyData[weekNum].push({
          'Minggu Ke': weekNum,
          'Tanggal': new Date(attendance.tanggal).toLocaleDateString('id-ID'),
          'Nama': attendance.users?.nama_lengkap || '',
          'NPM': attendance.users?.npm || '',
          'Mata Kuliah': attendance.jadwal?.mata_kuliah || '',
          'Status': attendance.status === 'approved' ? 'Disetujui' : 
                   attendance.status === 'rejected' ? 'Ditolak' : 'Menunggu',
          'Waktu Absen': new Date(attendance.created_at).toLocaleString('id-ID'),
          'Disetujui Oleh': attendance.approver?.nama_lengkap || '-',
          'Waktu Disetujui': attendance.approved_at ? 
                           new Date(attendance.approved_at).toLocaleString('id-ID') : '-'
        });
      });

      // Create workbook with multiple sheets (one per week)
      const wb = XLSX.utils.book_new();

      // Add summary sheet
      const summaryData = Object.keys(weeklyData).map(week => ({
        'Minggu Ke': week,
        'Total Absensi': weeklyData[week].length,
        'Disetujui': weeklyData[week].filter(a => a.Status === 'Disetujui').length,
        'Menunggu': weeklyData[week].filter(a => a.Status === 'Menunggu').length,
        'Ditolak': weeklyData[week].filter(a => a.Status === 'Ditolak').length
      }));

      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      
      // Style summary sheet
      const summaryRange = XLSX.utils.decode_range(summaryWs['!ref']);
      for (let R = summaryRange.s.r; R <= summaryRange.e.r; ++R) {
        for (let C = summaryRange.s.c; C <= summaryRange.e.c; ++C) {
          const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
          if (!summaryWs[cell_address]) continue;
          
          summaryWs[cell_address].s = {
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            },
            fill: R === 0 ? { fgColor: { rgb: '4F46E5' } } : { fgColor: { rgb: 'F8FAFC' } },
            font: R === 0 ? { color: { rgb: 'FFFFFF' }, bold: true } : { color: { rgb: '000000' } }
          };
        }
      }
      
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Ringkasan');

      // Add sheets for each week
      Object.keys(weeklyData).sort((a, b) => parseInt(a) - parseInt(b)).forEach(week => {
        const ws = XLSX.utils.json_to_sheet(weeklyData[week]);
        
        // Style the worksheet
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
            if (!ws[cell_address]) continue;
            
            ws[cell_address].s = {
              border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } }
              },
              fill: R === 0 ? { fgColor: { rgb: '3B82F6' } } : { fgColor: { rgb: 'FFFFFF' } },
              font: R === 0 ? { color: { rgb: 'FFFFFF' }, bold: true } : { color: { rgb: '000000' } }
            };
          }
        }
        
        // Set column widths
        ws['!cols'] = [
          { width: 12 }, // Minggu Ke
          { width: 15 }, // Tanggal
          { width: 20 }, // Nama
          { width: 15 }, // NPM
          { width: 25 }, // Mata Kuliah
          { width: 12 }, // Status
          { width: 20 }, // Waktu Absen
          { width: 20 }, // Disetujui Oleh
          { width: 20 }  // Waktu Disetujui
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, `Minggu ${week}`);
      });

      // Generate filename with current date
      const today = new Date().toISOString().split('T')[0];
      let filename;
      
      if (user?.role === 'super_admin') {
        filename = `Absensi_Semua_Data_${today}.xlsx`;
      } else {
        filename = `Absensi_${user.nama_lengkap.replace(/\s+/g, '_')}_${today}.xlsx`;
      }
      
      // Save file
      XLSX.writeFile(wb, filename);
      
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Gagal mengunduh data. Silakan coba lagi.');
    } finally {
      setDownloading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { 
        label: 'Menunggu', 
        className: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
        icon: FiAlertCircle 
      },
      approved: { 
        label: 'Disetujui', 
        className: 'bg-green-50 text-green-700 border border-green-200',
        icon: FiCheckCircle 
      },
      rejected: { 
        label: 'Ditolak', 
        className: 'bg-red-50 text-red-700 border border-red-200',
        icon: FiXCircle 
      }
    };
    return badges[status] || badges.pending;
  };

  const getRoleBadge = (role) => {
    const badges = {
      anggota: { label: 'Anggota', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
      admin: { label: 'Admin', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
      super_admin: { label: 'Super Admin', className: 'bg-red-50 text-red-700 border border-red-200' }
    };
    return badges[role] || badges.anggota;
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = attendanceData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(attendanceData.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-2xl mb-6"></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header Section - Matching Jadwal theme */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 text-white relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-white/30 rounded-full"></div>
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white/40 rounded-full"></div>
        </div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                <FiUsers size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">Absensi</h2>
                <p className="text-blue-100 text-sm">
                  {user?.role === 'anggota' ? 'Kelola absensi Anda' : 
                   user?.role === 'admin' ? 'Kelola dan setujui absensi anggota' :
                   'Kelola dan setujui absensi admin'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Enhanced styling */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600 mb-1">Total Absensi</p>
              <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-200 rounded-xl flex items-center justify-center">
              <FiUsers className="text-blue-600" size={20} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-yellow-50 via-yellow-100 to-amber-100 border-l-4 border-yellow-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-600 mb-1">Menunggu</p>
              <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-200 rounded-xl flex items-center justify-center">
              <FiAlertCircle className="text-yellow-600" size={20} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 via-green-100 to-emerald-100 border-l-4 border-green-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-600 mb-1">Disetujui</p>
              <p className="text-2xl font-bold text-green-900">{stats.approved}</p>
            </div>
            <div className="w-12 h-12 bg-green-200 rounded-xl flex items-center justify-center">
              <FiCheckCircle className="text-green-600" size={20} />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-50 via-red-100 to-rose-100 border-l-4 border-red-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-600 mb-1">Ditolak</p>
              <p className="text-2xl font-bold text-red-900">{stats.rejected}</p>
            </div>
            <div className="w-12 h-12 bg-red-200 rounded-xl flex items-center justify-center">
              <FiXCircle className="text-red-600" size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* Today's Schedule for Attendance - Enhanced styling to match Jadwal */}
      {canAttendClass && todaySchedules.length > 0 && (
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-100 p-4 border-b border-indigo-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <FiCalendar className="text-indigo-600" size={18} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Absensi Hari Ini</h3>
                <p className="text-sm text-gray-600">Klik tombol absen sesuai jadwal yang tersedia</p>
              </div>
            </div>
          </div>
          
        <div className="p-4">
  <div className="space-y-3">
    {todaySchedules.map((schedule) => (
      <div
        key={schedule.id}
        className="group p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:shadow-md transition-all duration-200 hover:from-blue-100 hover:to-indigo-100"
      >
        {/* flex jadi column di mobile, row di md ke atas */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Bagian Kiri */}
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              <FiBookOpen size={20} className="text-blue-700" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-gray-800 text-base md:text-lg mb-1">
                {schedule.mata_kuliah}
              </h4>
              <p className="text-sm text-gray-600 mb-2">{schedule.deskripsi}</p>
              <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs md:text-sm font-semibold shadow-sm inline-flex items-center space-x-1">
                <FiClock size={12} />
                <span>
                  {new Date(`2000-01-01T${schedule.jam_mulai}`).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })} -{' '}
                  {new Date(`2000-01-01T${schedule.jam_selesai}`).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Bagian Kanan */}
          <div className="flex-shrink-0">
            {schedule.hasAttended ? (
              <div className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg border border-green-200">
                <FiCheckCircle size={16} />
                <span className="text-sm font-medium">Sudah Absen</span>
              </div>
            ) : schedule.canAttend ? (
              <button
                onClick={() => handleAttendance(schedule)}
                className="w-full md:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all transform hover:scale-105"
              >
                <FiUserCheck size={16} />
                <span className="font-medium">Absen Sekarang</span>
              </button>
            ) : (
              <div className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg">
                <FiClock size={16} />
                <span className="text-sm font-medium">Diluar Jam</span>
              </div>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
</div>

        </Card>
      )}

      {/* Attendance Data Table - Enhanced styling */}
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <FiEye className="text-indigo-600" size={18} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">
                  {user?.role === 'anggota' ? 'Riwayat Absensi Saya' : 'Data Absensi'}
                </h3>
                <p className="text-sm text-gray-600">
                  {currentItems.length} dari {attendanceData.length} data
                </p>
              </div>
            </div>
            
            {/* Excel Download Button for all roles that can download */}
            {canDownloadExcel && (
              <button
                onClick={downloadExcel}
                disabled={downloading}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium"
              >
                <FiDownload size={16} />
                <span>{downloading ? 'Mengunduh...' : 'Excel'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters - Moved below title */}
        {(user?.role === 'admin' || user?.role === 'super_admin') && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-blue-100">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <FiCalendar className="text-blue-600" size={16} />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
           <button
                onClick={() => {
                  setFilterDate('');
                  setFilterStatus('all');
                  setCurrentPage(1);
                }}
                className="p-2 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-all duration-200"
                title="Reset Filter"
              >
                <FiFilter size={16} />
              </button>
            </div>
          </div>
        )}
        
        {currentItems.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-indigo-50 to-blue-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-100">
                      Mata Kuliah
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-100">
                      Mahasiswa
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-100">
                      Tanggal
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-100">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-100">
                      Disetujui oleh
                    </th>
                    {(user?.role === 'admin' || user?.role === 'super_admin') && (
                      <th className="px-6 py-4 text-center text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-100">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {currentItems.map((attendance, index) => {
                    const statusBadge = getStatusBadge(attendance.status);
                    const roleBadge = getRoleBadge(attendance.users?.role);
                    const canApproveThis = canApprove(attendance);
                    const StatusIcon = statusBadge.icon;
                    
                    return (
                      <tr key={attendance.id} className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FiBookOpen className="text-indigo-600" size={16} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{attendance.jadwal?.mata_kuliah}</p>
                              <p className="text-sm text-gray-500 flex items-center space-x-1">
                                <FiClock size={12} />
                                <span>
                                  {new Date(attendance.created_at).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <FiUser className="text-blue-600" size={16} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{attendance.users?.nama_lengkap}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-sm text-gray-500">NPM: {attendance.users?.npm}</span>
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${roleBadge.className}`}>
                                  {roleBadge.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FiCalendar className="text-blue-600" size={14} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {new Date(attendance.tanggal).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(attendance.tanggal).toLocaleDateString('id-ID', {
                                  weekday: 'long'
                                })}
                              </p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold ${statusBadge.className}`}>
                            <StatusIcon size={14} />
                            <span>{statusBadge.label}</span>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          {attendance.approver ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <FiUserCheck className="text-green-600" size={14} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{attendance.approver.nama_lengkap}</p>
                                <p className="text-xs text-gray-500">
                                  {new Date(attendance.approved_at).toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <FiUser className="text-gray-400" size={14} />
                              </div>
                              <span className="text-sm text-gray-500">Belum disetujui</span>
                            </div>
                          )}
                        </td>
                        
                        {(user?.role === 'admin' || user?.role === 'super_admin') && (
                          <td className="px-6 py-4">
                            {canApproveThis ? (
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={() => approveAttendance(attendance.id, 'approved')}
                                  className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors transform hover:scale-110 shadow-sm"
                                  title="Setujui Absensi"
                                >
                                  <FiCheck size={16} />
                                </button>
                                <button
                                  onClick={() => approveAttendance(attendance.id, 'rejected')}
                                  className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors transform hover:scale-110 shadow-sm"
                                  title="Tolak Absensi"
                                >
                                  <FiX size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <span className="text-sm text-gray-400">-</span>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination - Enhanced styling */}
            {totalPages > 1 && (
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 font-medium">
                    Menampilkan {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, attendanceData.length)} dari {attendanceData.length} data
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiChevronLeft size={16} />
                    </button>
                    
                    {[...Array(Math.min(5, totalPages))].map((_, index) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = index + 1;
                      } else if (currentPage <= 3) {
                        pageNum = index + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + index;
                      } else {
                        pageNum = currentPage - 2 + index;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => paginate(pageNum)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                            currentPage === pageNum
                              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg'
                              : 'text-gray-700 hover:bg-white hover:shadow-sm'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiCalendar className="text-indigo-400" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Tidak Ada Data Absensi</h3>
            <p className="text-gray-500 mb-4">
              {filterDate || filterStatus !== 'all' 
                ? 'Tidak ada data absensi yang sesuai dengan filter yang dipilih.' 
                : 'Belum ada data absensi yang tersedia.'}
            </p>
            {user?.role === 'anggota' && (
              <p className="text-sm text-gray-400">
                Lakukan absensi pada jadwal yang tersedia untuk melihat riwayat di sini.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Attendance Confirmation Modal - Enhanced styling */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Konfirmasi Absensi"
      >
        {selectedSchedule && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-blue-200 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                <FiUserCheck className="text-indigo-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {selectedSchedule.mata_kuliah}
              </h3>
              <p className="text-gray-600 mb-4">
                {selectedSchedule.deskripsi}
              </p>
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-4 mb-4 border border-indigo-100">
                <div className="flex items-center justify-center space-x-2 text-indigo-800">
                  <FiClock size={16} />
                  <p className="text-sm font-semibold">
                    Waktu Kuliah: {new Date(`2000-01-01T${selectedSchedule.jam_mulai}`).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })} - {new Date(`2000-01-01T${selectedSchedule.jam_selesai}`).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiAlertCircle className="text-yellow-600" size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-yellow-800 mb-1">Catatan Penting</h4>
                  <p className="text-sm text-yellow-700">
                    Absensi Anda akan berstatus "Menunggu" dan memerlukan persetujuan dari{' '}
                    {user?.role === 'admin' ? 'Super Admin' : 'Admin'} sebelum disetujui.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all"
              >
                Batal
              </button>
              <button
                onClick={submitAttendance}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-105"
              >
                Konfirmasi Absensi
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Absensi;