import React, { useState, useEffect } from 'react';
import { FiUser, FiCalendar, FiClock, FiCheckSquare, FiTrendingUp, FiBookOpen, FiUsers, FiUserCheck, FiShield } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card } from '../Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const Dashboard = () => {
    const { user } = useAuth();
    const [todaySchedule, setTodaySchedule] = useState([]);
    const [upcomingTasks, setUpcomingTasks] = useState([]);
    const [weeklyAttendance, setWeeklyAttendance] = useState([]);
    const [stats, setStats] = useState({
        totalSchedules: 0,
        activeTasks: 0,
        attendanceRate: 0,
        pendingAttendance: 0,
        totalUsers: 0,
        totalAdmins: 0,
        totalMembers: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, [user]);

    const fetchDashboardData = async () => {
        if (!user) return;

        try {
            // Get today's schedule
            const today = new Date().toLocaleDateString('en-CA');
            const dayName = new Date().toLocaleDateString('id-ID', { weekday: 'long' });

            const { data: scheduleData } = await supabase
                .from('jadwal')
                .select('*')
                .eq('hari', dayName);

            setTodaySchedule(scheduleData || []);

            // Get upcoming tasks
            const { data: tasksData } = await supabase
                .from('tugas')
                .select('*')
                .gte('tenggat_waktu', new Date().toISOString())
                .order('tenggat_waktu', { ascending: true })
                .limit(5);

            setUpcomingTasks(tasksData || []);

            // Get stats based on user role
            await fetchStatsBasedOnRole();
            // panggil dengan jumlah task
            await fetchStatsBasedOnRole(tasksData?.length || 0);


            // Only fetch attendance data for non-super admin users
            if (user.role !== 'super_admin') {
                await fetchAttendanceData();
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

   const fetchStatsBasedOnRole = async () => {
  try {
    // Common stats
    const { count: totalSchedulesCount } = await supabase
      .from('jadwal')
      .select('*', { count: 'exact', head: true });

    let pendingCount = 0;
    let totalUsers = 0;
    let totalAdmins = 0;
    let totalMembers = 0;

    // 🔹 hitung tugas aktif (tenggat >= sekarang)
    const { data: activeTasksData, error: tasksError } = await supabase
      .from('tugas')
      .select('id')
      .gte('tenggat_waktu', new Date().toISOString());

    const tasksCount = activeTasksData?.length || 0;

    if (user.role === 'super_admin') {
      // Super Admin: Count total users and pending admin attendance
      const { data: usersData } = await supabase
        .from('users')
        .select('role');

      totalUsers = usersData?.length || 0;
      totalAdmins = usersData?.filter(u => u.role === 'admin').length || 0;
      totalMembers = usersData?.filter(u => u.role === 'anggota').length || 0;

      // Count pending admin attendance
      const { data: pendingAdminAttendance } = await supabase
        .from('absensi')
        .select(`id, users:user_id (role)`)
        .eq('status', 'pending');

      pendingCount = pendingAdminAttendance?.filter(a => a.users?.role === 'admin').length || 0;

    } else if (user.role === 'admin') {
      // Admin: Count pending member attendance
      const { data: pendingMemberAttendance } = await supabase
        .from('absensi')
        .select(`id, users:user_id (role)`)
        .eq('status', 'pending');

      pendingCount = pendingMemberAttendance?.filter(a => a.users?.role === 'anggota').length || 0;

    } else {
      // Anggota: Count their own pending attendance
      const { data: myPendingAttendance } = await supabase
        .from('absensi')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      pendingCount = myPendingAttendance?.length || 0;
    }

    // 🔹 update state
    setStats(prevStats => ({
      ...prevStats,
      totalSchedules: totalSchedulesCount || 0,
      activeTasks: tasksCount, // langsung isi angka
      pendingAttendance: pendingCount,
      totalUsers,
      totalAdmins,
      totalMembers
    }));

  } catch (error) {
    console.error('Error fetching role-based stats:', error);
  }
};


    const fetchAttendanceData = async () => {
        try {
            // Get weekly attendance data (last 7 days) - only for non-super admin
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            const { data: attendanceData } = await supabase
                .from('absensi')
                .select('tanggal, status')
                .eq('user_id', user.id)
                .gte('tanggal', oneWeekAgo.toISOString().split('T')[0]);

            // Process weekly attendance for chart (last 7 days)
            const weeklyData = [];
            let weekdayAttendanceData = [];

            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const dayName = date.toLocaleDateString('id-ID', { weekday: 'short' });
                const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

                const dayAttendance = attendanceData?.filter(a => a.tanggal === dateStr) || [];
                const approvedCount = dayAttendance.filter(a => a.status === 'approved').length;

                weeklyData.push({
                    day: dayName,
                    count: approvedCount
                });

                // Collect weekday attendance for calculation (Monday to Friday only)
                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    weekdayAttendanceData = weekdayAttendanceData.concat(dayAttendance);
                }
            }
            setWeeklyAttendance(weeklyData);

            // Calculate attendance rate based on weekdays only from last 7 days
            const approvedWeekdayAttendance = weekdayAttendanceData.filter(a => a.status === 'approved').length;
            const totalWeekdayAttendance = weekdayAttendanceData.length;
            const attendanceRate = totalWeekdayAttendance > 0 ? Math.round((approvedWeekdayAttendance / totalWeekdayAttendance) * 100) : 0;

            setStats(prevStats => ({
                ...prevStats,
                attendanceRate: attendanceRate
            }));

        } catch (error) {
            console.error('Error fetching attendance data:', error);
        }
    };

    const formatTime = (timeString) => {
        return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getDaysUntilDeadline = (deadline) => {
        const today = new Date();
        const deadlineDate = new Date(deadline);
        const diffTime = deadlineDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Hari ini';
        if (diffDays === 1) return 'Besok';
        if (diffDays < 0) return 'Terlambat';
        return `${diffDays} hari lagi`;
    };

    // Get first name only
    const getFirstName = (fullName) => {
        return fullName?.split(' ')[0] || 'User';
    };

    const getPendingLabel = () => {
        switch (user.role) {
            case 'super_admin':
                return 'Pending Admin';
            case 'admin':
                return 'Pending Anggota';
            default:
                return 'Absensi Pending';
        }
    };

    if (loading) {
        return (
            <div className="p-4">
                <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-gray-200 rounded-xl"></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>
                        ))}
                    </div>
                    <div className="h-48 bg-gray-200 rounded-xl"></div>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="h-64 bg-gray-200 rounded-xl"></div>
                        <div className="h-64 bg-gray-200 rounded-xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    const pieData = [
        { name: 'Hadir', value: stats.attendanceRate, fill: '#10B981' },
        { name: 'Tidak Hadir', value: 100 - stats.attendanceRate, fill: '#F1F5F9' }
    ];

    return (
        <div className="p-4 space-y-4">
            {/* User Info Card - Updated with first name only */}
            <Card className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
                {/* Background decorations */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-16 -translate-x-16"></div>
                    <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-white/30 rounded-full"></div>
                    <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white/40 rounded-full"></div>
                </div>

                <div className="relative z-10 p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                                <FiUser size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold mb-1">
                                    Selamat datang, {getFirstName(user?.nama_lengkap)}!
                                </h2>
                                <p className="text-blue-100 text-sm mb-2">
                                    Semoga hari Anda produktif dan menyenangkan
                                </p>
                                <div className="flex flex-wrap items-center gap-3 text-xs">
                                    <div className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-md backdrop-blur-sm">
                                        <span className="text-blue-200">NPM:</span>
                                        <span className="font-medium">{user?.npm}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="hidden lg:flex flex-col items-end text-right">
                            <div className="text-blue-100 text-lg font-semibold mb-1">
                                {new Date().toLocaleDateString('id-ID', {
                                    weekday: 'long'
                                })}
                            </div>
                            <div className="text-white text-sm mb-2">
                                {new Date().toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}
                            </div>
                            <div className="text-xs text-blue-200 bg-white/20 px-2 py-1 rounded-md backdrop-blur-sm">
                                {new Date().toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Stats Overview - Role-based */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalSchedules}</p>
                            <p className="text-sm text-gray-600">Mata Kuliah</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FiCalendar className="text-blue-600" size={20} />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.activeTasks}</p>
                            <p className="text-sm text-gray-600">Tugas Aktif</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <FiCheckSquare className="text-purple-600" size={20} />
                        </div>
                    </div>
                </Card>

                {/* Different stats based on role */}
                {user.role === 'super_admin' ? (
                    <>
                        <Card className="p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                                    <p className="text-sm text-gray-600">Total Akun</p>
                                </div>
                                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                                    <FiUsers className="text-indigo-600" size={20} />
                                </div>
                            </div>
                        </Card>

                        <Card className="p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{stats.pendingAttendance}</p>
                                    <p className="text-sm text-gray-600">{getPendingLabel()}</p>
                                </div>
                                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <FiUserCheck className="text-orange-600" size={20} />
                                </div>
                            </div>
                        </Card>
                    </>
                ) : (
                    <>
                        <Card className="p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{stats.attendanceRate}%</p>
                                    <p className="text-sm text-gray-600">Kehadiran 7 Hari</p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                    <FiTrendingUp className="text-green-600" size={20} />
                                </div>
                            </div>
                        </Card>

                        <Card className="p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{stats.pendingAttendance}</p>
                                    <p className="text-sm text-gray-600">{getPendingLabel()}</p>
                                </div>
                                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <FiClock className="text-orange-600" size={20} />
                                </div>
                            </div>
                        </Card>
                    </>
                )}
            </div>

            {/* Today's Schedule */}
            <Card className="p-4">
                <div className="flex items-center space-x-2 mb-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FiCalendar className="text-blue-600" size={16} />
                    </div>
                    <h3 className="font-semibold text-gray-800">Jadwal Hari Ini</h3>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                        {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </span>
                </div>
                {todaySchedule.length > 0 ? (
                    <div className="space-y-3">
                        {todaySchedule.map((schedule) => (
                            <div key={schedule.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors border border-blue-100">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FiBookOpen size={18} className="text-blue-700" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-800 truncate">{schedule.mata_kuliah}</p>
                                        <p className="text-sm text-gray-600 truncate">{schedule.deskripsi || 'Tidak ada deskripsi'}</p>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-semibold text-blue-700 bg-blue-200 px-2 py-1 rounded-md">
                                        {formatTime(schedule.jam_mulai)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {formatTime(schedule.jam_selesai)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiCalendar className="text-gray-400" size={32} />
                        </div>
                        <p className="text-gray-500 font-medium mb-1">Tidak ada jadwal hari ini</p>
                        <p className="text-sm text-gray-400">Nikmati hari libur Anda!</p>
                    </div>
                )}
            </Card>

            {/* Bottom section - Different for super admin */}
            <div className="grid lg:grid-cols-2 gap-4">
                {/* Conditional left section */}
                {user.role === 'super_admin' ? (
                    // Super Admin: User Statistics
                    <Card className="p-4">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <FiUsers className="text-indigo-600" size={16} />
                            </div>
                            <h3 className="font-semibold text-gray-800">Statistik Pengguna</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-indigo-200 rounded-lg flex items-center justify-center">
                                        <FiUsers className="text-indigo-700" size={20} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">Total Pengguna</p>
                                        <p className="text-sm text-gray-600">Seluruh sistem</p>
                                    </div>
                                </div>
                                <span className="text-2xl font-bold text-indigo-700">{stats.totalUsers}</span>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-purple-200 rounded-lg flex items-center justify-center">
                                        <FiUserCheck className="text-purple-700" size={20} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">Admin</p>
                                        <p className="text-sm text-gray-600">Maksimal 2 admin</p>
                                    </div>
                                </div>
                                <span className="text-2xl font-bold text-purple-700">{stats.totalAdmins}/2</span>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center">
                                        <FiUser className="text-blue-700" size={20} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">Anggota</p>
                                        <p className="text-sm text-gray-600">Mahasiswa aktif</p>
                                    </div>
                                </div>
                                <span className="text-2xl font-bold text-blue-700">{stats.totalMembers}</span>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-red-200 rounded-lg flex items-center justify-center">
                                        <FiShield className="text-red-700" size={20} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">Super Admin</p>
                                        <p className="text-sm text-gray-600">Hanya Anda</p>
                                    </div>
                                </div>
                                <span className="text-2xl font-bold text-red-700">1</span>
                            </div>
                        </div>
                    </Card>
                ) : (
                    // Admin & Anggota: Weekly Attendance
                    <Card className="p-4">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <FiClock className="text-green-600" size={16} />
                            </div>
                            <h3 className="font-semibold text-gray-800">Kehadiran 7 Hari Terakhir</h3>
                        </div>
                        <div className="h-32 mb-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyAttendance}>
                                    <XAxis
                                        dataKey="day"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#6B7280' }}
                                    />
                                    <YAxis hide />
                                    <Bar
                                        dataKey="count"
                                        fill="#10B981"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex items-center justify-center space-x-4 bg-gray-50 rounded-xl p-4">
                            <div className="w-16 h-16 flex-shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={20}
                                            outerRadius={32}
                                            dataKey="value"
                                            strokeWidth={0}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.attendanceRate}%</p>
                                <p className="text-sm text-gray-600">Tingkat Kehadiran</p>
                                <p className="text-xs text-gray-500">Senin - Jumat</p>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Upcoming Tasks - Same for all roles */}
                <Card className="p-4">
                    <div className="flex items-center space-x-2 mb-4">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <FiCheckSquare className="text-purple-600" size={16} />
                        </div>
                        <h3 className="font-semibold text-gray-800">Tugas Mendatang</h3>
                    </div>
                    {upcomingTasks.length > 0 ? (
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {upcomingTasks.map((task) => {
                                const daysLeft = getDaysUntilDeadline(task.tenggat_waktu);
                                const isUrgent = daysLeft === 'Hari ini' || daysLeft === 'Besok' || daysLeft === 'Terlambat';

                                return (
                                    <div key={task.id} className="p-3 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors border border-purple-100">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-gray-800 text-sm truncate">{task.mata_kuliah}</p>
                                                <p className="text-sm text-gray-600 line-clamp-2 mt-1">{task.deskripsi}</p>
                                                <p className="text-xs text-gray-500 mt-2 bg-white px-2 py-1 rounded-md inline-block">
                                                    {new Date(task.tenggat_waktu).toLocaleDateString('id-ID', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${isUrgent
                                                        ? daysLeft === 'Terlambat'
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-orange-100 text-orange-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {daysLeft}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiCheckSquare className="text-gray-400" size={32} />
                            </div>
                            <p className="text-gray-500 font-medium mb-1">Tidak ada tugas mendatang</p>
                            <p className="text-sm text-gray-400">Semua tugas sudah selesai!</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;