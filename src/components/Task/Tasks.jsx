import { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiCalendar, FiClock, FiCheckCircle, FiCircle, FiBookOpen, FiUsers, FiTrendingUp } from 'react-icons/fi';
import { Card, Modal } from '../Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const Tugas = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [taskCompletions, setTaskCompletions] = useState({});
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('all'); // all, completed, pending, overdue
  const [taskStats, setTaskStats] = useState({});

  useEffect(() => {
    fetchTasks();
    fetchSchedules();
    if (user?.role === 'anggota' || user?.role === 'admin') {
      fetchTaskCompletions();
    }
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      fetchTaskStats();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tugas')
        .select(`
          *,
          users:created_by (nama_lengkap)
        `)
        .order('tenggat_waktu', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskCompletions = async () => {
    try {
      const { data, error } = await supabase
        .from('task_completions')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      
      const completionsMap = {};
      data?.forEach(completion => {
        completionsMap[completion.task_id] = completion;
      });
      setTaskCompletions(completionsMap);
    } catch (error) {
      console.error('Error fetching task completions:', error);
    }
  };

  const fetchTaskStats = async () => {
    try {
      const { data, error } = await supabase
        .from('task_completion_stats')
        .select('*');

      if (error) throw error;
      
      const statsMap = {};
      data?.forEach(stat => {
        statsMap[stat.task_id] = stat;
      });
      setTaskStats(statsMap);
    } catch (error) {
      console.error('Error fetching task stats:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('jadwal')
        .select('mata_kuliah')
        .order('mata_kuliah');

      if (error) throw error;
      
      // Get unique subjects
      const uniqueSubjects = [...new Set(data?.map(s => s.mata_kuliah) || [])];
      setSchedules(uniqueSubjects);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const canManageTask = user?.role === 'admin' || user?.role === 'super_admin';
  const canMarkComplete = user?.role === 'anggota' || user?.role === 'admin';
  const canViewStats = user?.role === 'admin' || user?.role === 'super_admin';

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Hapus tugas ini? Semua data completion akan terhapus.')) return;

    try {
      const { error } = await supabase
        .from('tugas')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      
      // Refresh data
      fetchTasks();
      if (canMarkComplete) {
        fetchTaskCompletions();
      }
      if (canViewStats) {
        fetchTaskStats();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Gagal menghapus tugas');
    }
  };

  const handleToggleCompletion = async (taskId) => {
    const currentCompletion = taskCompletions[taskId];
    const newStatus = currentCompletion?.status === 'completed' ? 'pending' : 'completed';
    
    try {
      const { error } = await supabase
        .from('task_completions')
        .upsert({
          task_id: taskId,
          user_id: user.id,
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        }, {
          onConflict: 'task_id,user_id'
        });

      if (error) throw error;
      
      // Refresh completions
      await fetchTaskCompletions();
      
      // Refresh stats if user can view them
      if (canViewStats) {
        await fetchTaskStats();
      }
    } catch (error) {
      console.error('Error toggling task completion:', error);
      alert('Gagal mengubah status tugas');
    }
  };

  const isTaskOverdue = (deadline) => {
    return new Date(deadline) < new Date();
  };

  const isTaskDueSoon = (deadline) => {
    const now = new Date();
    const due = new Date(deadline);
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diffDays <= 3 && diffDays >= 0;
  };

  const getTaskStatus = (task) => {
    const completion = taskCompletions[task.id];
    const isCompleted = completion?.status === 'completed';
    
    if (isCompleted) {
      return { label: 'Selesai', className: 'bg-green-100 text-green-700 border border-green-200' };
    } else if (isTaskOverdue(task.tenggat_waktu)) {
      return { label: 'Terlambat', className: 'bg-red-100 text-red-700 border border-red-200' };
    } else if (isTaskDueSoon(task.tenggat_waktu)) {
      return { label: 'Segera', className: 'bg-yellow-100 text-yellow-700 border border-yellow-200' };
    } else {
      return { label: 'Normal', className: 'bg-blue-100 text-blue-700 border border-blue-200' };
    }
  };

  const getFilteredTasks = () => {
    return tasks.filter(task => {
      const completion = taskCompletions[task.id];
      const isCompleted = completion?.status === 'completed';
      const isOverdue = isTaskOverdue(task.tenggat_waktu) && !isCompleted;
      
      switch (filter) {
        case 'completed':
          return isCompleted;
        case 'pending':
          return !isCompleted && !isOverdue;
        case 'overdue':
          return isOverdue;
        default:
          return true;
      }
    });
  };

  const getPersonalTaskStats = () => {
    const completedTasks = tasks.filter(task => taskCompletions[task.id]?.status === 'completed').length;
    const overdueTasks = tasks.filter(task => 
      taskCompletions[task.id]?.status !== 'completed' && isTaskOverdue(task.tenggat_waktu)
    ).length;
    const pendingTasks = tasks.length - completedTasks - overdueTasks;

    return { total: tasks.length, completed: completedTasks, pending: pendingTasks, overdue: overdueTasks };
  };

  const filteredTasks = getFilteredTasks();
  const personalStats = canMarkComplete ? getPersonalTaskStats() : { total: 0, completed: 0, pending: 0, overdue: 0 };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-2xl mb-6"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl mb-4"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 text-white relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-white/30 rounded-full"></div>
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white/40 rounded-full"></div>
        </div>

        <div className="relative z-10 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
              <FiBookOpen size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Tugas </h2>
              <p className="text-blue-100 text-sm">
                {canMarkComplete ? 'Kelola dan pantau progres tugas Anda' : 'Lihat semua tugas yang tersedia'}
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            {canViewStats && (
              <button
                onClick={() => setShowStatsModal(true)}
                className="bg-white/20 backdrop-blur-sm border border-white/30 text-white p-3 rounded-xl hover:bg-white/30 transition-all duration-200 shadow-lg hover:shadow-xl"
                title="Lihat Statistik"
              >
                <FiTrendingUp size={20} />
              </button>
            )}
            {canManageTask && (
              <button
                onClick={() => {
                  setEditingTask(null);
                  setShowModal(true);
                }}
                className="bg-white/20 backdrop-blur-sm border border-white/30 text-white p-3 rounded-xl hover:bg-white/30 transition-all duration-200 shadow-lg hover:shadow-xl"
                title="Tambah Tugas"
              >
                <FiPlus size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards - Only show for users who can mark completion */}
      {canMarkComplete && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card 
            className={`p-3 sm:p-4 text-center hover:shadow-md transition-all cursor-pointer ${
              filter === 'all' ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}
            onClick={() => setFilter('all')}
          >
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FiBookOpen className="text-blue-600" size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-600 mb-1">{personalStats.total}</p>
            <span className="font-semibold text-gray-800 text-xs sm:text-sm">Total</span>
          </Card>

          <Card 
            className={`p-3 sm:p-4 text-center hover:shadow-md transition-all cursor-pointer ${
              filter === 'completed' ? 'ring-2 ring-green-500 bg-green-50' : ''
            }`}
            onClick={() => setFilter('completed')}
          >
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <FiCheckCircle className="text-green-600" size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-green-600 mb-1">{personalStats.completed}</p>
            <span className="font-semibold text-gray-800 text-xs sm:text-sm">Selesai</span>
          </Card>

          <Card 
            className={`p-3 sm:p-4 text-center hover:shadow-md transition-all cursor-pointer ${
              filter === 'pending' ? 'ring-2 ring-yellow-500 bg-yellow-50' : ''
            }`}
            onClick={() => setFilter('pending')}
          >
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <FiCircle className="text-yellow-600" size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600 mb-1">{personalStats.pending}</p>
            <span className="font-semibold text-gray-800 text-xs sm:text-sm">Pending</span>
          </Card>

          <Card 
            className={`p-3 sm:p-4 text-center hover:shadow-md transition-all cursor-pointer ${
              filter === 'overdue' ? 'ring-2 ring-red-500 bg-red-50' : ''
            }`}
            onClick={() => setFilter('overdue')}
          >
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <FiClock className="text-red-600" size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-red-600 mb-1">{personalStats.overdue}</p>
            <span className="font-semibold text-gray-800 text-xs sm:text-sm">Terlambat</span>
          </Card>
        </div>
      )}

      {/* Tasks List */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FiBookOpen className="text-blue-600" size={20} />
              <h3 className="font-bold text-gray-800 text-lg">
                {filter === 'all' ? 'Semua Tugas' :
                 filter === 'completed' ? 'Tugas Selesai' :
                 filter === 'pending' ? 'Tugas Pending' :
                 'Tugas Terlambat'}
              </h3>
            </div>
            <div className="text-sm text-gray-600">
              {filteredTasks.length} tugas
            </div>
          </div>
        </div>

        <div className="p-4">
          {filteredTasks.length > 0 ? (
            <div className="space-y-4">
              {filteredTasks.map((task) => {
                const status = getTaskStatus(task);
                const completion = taskCompletions[task.id];
                const isCompleted = completion?.status === 'completed';
                const stats = taskStats[task.id];
                
                return (
                  <div 
                    key={task.id} 
                    className={`group p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${
                      isCompleted 
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:from-green-100 hover:to-emerald-100' 
                        : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 hover:from-blue-100 hover:to-indigo-100'
                    }`}
                  >
                    {/* Header with subject and completion button */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
                          isCompleted ? 'bg-green-200' : 'bg-blue-200'
                        }`}>
                          <FiBookOpen size={20} className={isCompleted ? 'text-green-700' : 'text-blue-700'} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className={`font-bold text-lg mb-1 pr-2 ${
                            isCompleted ? 'text-green-800 line-through' : 'text-gray-800'
                          }`}>
                            {task.mata_kuliah}
                          </h4>
                        </div>
                      </div>
                      
                      {canMarkComplete && (
                        <button
                          onClick={() => handleToggleCompletion(task.id)}
                          className={`p-2 rounded-lg transition-all ${
                            isCompleted 
                              ? 'text-green-600 hover:bg-green-100' 
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={isCompleted ? 'Tandai belum selesai' : 'Tandai selesai'}
                        >
                          {isCompleted ? <FiCheckCircle size={24} /> : <FiCircle size={24} />}
                        </button>
                      )}
                    </div>

                    {/* Status and Time Badge */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`px-3 py-1 text-sm rounded-lg font-medium ${status.className}`}>
                        {status.label}
                      </span>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <FiCalendar size={14} />
                          <span>{new Date(task.tenggat_waktu).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <FiClock size={14} />
                          <span>
                            {new Date(task.tenggat_waktu).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className={`text-sm mb-3 ${
                      isCompleted ? 'text-green-700 line-through' : 'text-gray-600'
                    }`}>
                      {task.deskripsi}
                    </p>

                    {/* Creator info */}
                    {task.users && (
                      <div className="flex items-center space-x-2 text-xs text-gray-500 mb-3">
                        <FiUsers size={12} />
                        <span>Dibuat oleh {task.users.nama_lengkap}</span>
                      </div>
                    )}

                    {/* Global completion stats for admins */}
                    {canViewStats && stats && (
                      <div className="bg-white/50 rounded-lg p-3 mb-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Progres Keseluruhan</span>
                          <span className="text-sm text-gray-600">{stats.completion_percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${stats.completion_percentage}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{stats.completed_count} selesai</span>
                          <span>{stats.total_eligible_users} total anggota</span>
                        </div>
                      </div>
                    )}

                    {/* Personal completion info */}
                    {isCompleted && completion?.completed_at && (
                      <div className="flex items-center space-x-2 text-xs text-green-600 mb-3 bg-green-100 p-2 rounded-lg">
                        <FiCheckCircle size={12} />
                        <span>
                          Diselesaikan pada {new Date(completion.completed_at).toLocaleDateString('id-ID')} 
                          {' '}{new Date(completion.completed_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {canManageTask && (
                      <div className="flex justify-end space-x-2 pt-3 border-t border-blue-200">
                        <button
                          onClick={() => handleEdit(task)}
                          className="flex items-center space-x-1 px-3 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-all text-sm font-medium"
                        >
                          <FiEdit size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="flex items-center space-x-1 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-all text-sm font-medium"
                        >
                          <FiTrash2 size={14} />
                          <span>Hapus</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiBookOpen className="text-gray-400" size={32} />
              </div>
              <p className="text-gray-500 font-medium mb-1">
                {filter === 'all' ? 'Belum ada tugas' :
                 filter === 'completed' ? 'Belum ada tugas yang diselesaikan' :
                 filter === 'pending' ? 'Tidak ada tugas pending' :
                 'Tidak ada tugas terlambat'}
              </p>
              <p className="text-sm text-gray-400">
                {filter === 'all' ? 'Tugas akan muncul di sini' :
                 'Coba ubah filter untuk melihat tugas lainnya'}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Task Modal */}
      <TaskModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        task={editingTask}
        schedules={schedules}
        onSuccess={() => {
          setShowModal(false);
          fetchTasks();
          if (canMarkComplete) {
            fetchTaskCompletions();
          }
          if (canViewStats) {
            fetchTaskStats();
          }
        }}
      />

      {/* Stats Modal */}
      <TaskStatsModal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        taskStats={taskStats}
        tasks={tasks}
      />
    </div>
  );
};

const TaskModal = ({ isOpen, onClose, task, schedules, onSuccess }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    mata_kuliah: '',
    tenggat_waktu: '',
    deskripsi: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        mata_kuliah: task.mata_kuliah || '',
        tenggat_waktu: task.tenggat_waktu ? 
          new Date(task.tenggat_waktu).toISOString().slice(0, 16) : '',
        deskripsi: task.deskripsi || ''
      });
    } else {
      setFormData({
        mata_kuliah: schedules[0] || '',
        tenggat_waktu: '',
        deskripsi: ''
      });
    }
  }, [task, schedules]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const taskData = {
        ...formData,
        tenggat_waktu: new Date(formData.tenggat_waktu).toISOString()
      };

      if (task) {
        // Update existing task
        const { error } = await supabase
          .from('tugas')
          .update(taskData)
          .eq('id', task.id);

        if (error) throw error;
      } else {
        // Create new task
        const { error } = await supabase
          .from('tugas')
          .insert([{
            ...taskData,
            created_by: user.id
          }]);

        if (error) throw error;

        // Send notification to all users
        const { data: users } = await supabase
          .from('users')
          .select('id');

        if (users) {
          const notifications = users.map(u => ({
            user_id: u.id,
            title: 'Tugas Baru',
            message: `Tugas baru untuk ${formData.mata_kuliah}: ${formData.deskripsi}`,
            type: 'task'
          }));

          await supabase
            .from('notifications')
            .insert(notifications);
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Gagal menyimpan tugas');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? 'Edit Tugas' : 'Tambah Tugas'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mata Kuliah
          </label>
          <select
            name="mata_kuliah"
            value={formData.mata_kuliah}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          >
            {schedules.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tenggat Waktu
          </label>
          <input
            type="datetime-local"
            name="tenggat_waktu"
            value={formData.tenggat_waktu}
            onChange={handleChange}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Deskripsi
          </label>
          <textarea
            name="deskripsi"
            value={formData.deskripsi}
            onChange={handleChange}
            rows="4"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Deskripsi tugas..."
            required
          />
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-shadow disabled:opacity-50"
          >
            {loading ? 'Menyimpan...' : (task ? 'Update' : 'Simpan')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const TaskStatsModal = ({ isOpen, onClose, taskStats, tasks }) => {
  const getOverallStats = () => {
    const totalTasks = tasks.length;
    if (totalTasks === 0) return { totalTasks: 0, avgCompletion: 0, highestCompletion: 0, lowestCompletion: 0 };

    const completionRates = Object.values(taskStats).map(stat => stat.completion_percentage || 0);
    const avgCompletion = completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length;
    const highestCompletion = Math.max(...completionRates);
    const lowestCompletion = Math.min(...completionRates);

    return {
      totalTasks,
      avgCompletion: Math.round(avgCompletion * 100) / 100,
      highestCompletion,
      lowestCompletion
    };
  };

  const getSortedTaskStats = () => {
    return Object.values(taskStats)
      .sort((a, b) => a.completion_percentage - b.completion_percentage)
      .slice(0, 10); // Show top 10
  };

  const overallStats = getOverallStats();
  const sortedStats = getSortedTaskStats();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Statistik Penyelesaian Tugas"
      size="large"
    >
      <div className="space-y-6">
        {/* Overall Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center mx-auto mb-2">
                <FiBookOpen className="text-blue-700" size={20} />
              </div>
              <p className="text-2xl font-bold text-blue-700 mb-1">{overallStats.totalTasks}</p>
              <span className="text-sm text-blue-600 font-medium">Total Tugas</span>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-xl border border-green-200">
            <div className="text-center">
              <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center mx-auto mb-2">
                <FiTrendingUp className="text-green-700" size={20} />
              </div>
              <p className="text-2xl font-bold text-green-700 mb-1">{overallStats.avgCompletion}%</p>
              <span className="text-sm text-green-600 font-medium">Rata-rata</span>
            </div>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <div className="text-center">
              <div className="w-10 h-10 bg-emerald-200 rounded-lg flex items-center justify-center mx-auto mb-2">
                <FiCheckCircle className="text-emerald-700" size={20} />
              </div>
              <p className="text-2xl font-bold text-emerald-700 mb-1">{overallStats.highestCompletion}%</p>
              <span className="text-sm text-emerald-600 font-medium">Tertinggi</span>
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-xl border border-red-200">
            <div className="text-center">
              <div className="w-10 h-10 bg-red-200 rounded-lg flex items-center justify-center mx-auto mb-2">
                <FiClock className="text-red-700" size={20} />
              </div>
              <p className="text-2xl font-bold text-red-700 mb-1">{overallStats.lowestCompletion}%</p>
              <span className="text-sm text-red-600 font-medium">Terendah</span>
            </div>
          </div>
        </div>

        {/* Detailed Task Stats */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Detail Penyelesaian per Tugas</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sortedStats.length > 0 ? sortedStats.map((stat) => (
              <div key={stat.task_id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">{stat.mata_kuliah}</h4>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{stat.deskripsi}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Deadline: {new Date(stat.tenggat_waktu).toLocaleDateString('id-ID')} {' '}
                      {new Date(stat.tenggat_waktu).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      stat.completion_percentage >= 80 
                        ? 'bg-green-100 text-green-800'
                        : stat.completion_percentage >= 50
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {stat.completion_percentage}%
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="text-gray-800 font-medium">
                      {stat.completed_count} / {stat.total_eligible_users}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        stat.completion_percentage >= 80 
                          ? 'bg-green-500'
                          : stat.completion_percentage >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${stat.completion_percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiTrendingUp className="text-gray-400" size={24} />
                </div>
                <p className="text-gray-500">Belum ada data statistik</p>
              </div>
            )}
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
};