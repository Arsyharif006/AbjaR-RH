import { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiClock, FiBookOpen, FiUser, FiCalendar } from 'react-icons/fi';
import { Card, Modal } from '../Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const Jadwal = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('jadwal')
        .select(`
          *,
          users:created_by (nama_lengkap)
        `)
        .order('hari')
        .order('jam_mulai');

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const canManageSchedule = user?.role === 'admin' || user?.role === 'super_admin';

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    setShowModal(true);
  };

  const handleDelete = async (scheduleId) => {
    if (!window.confirm('Hapus jadwal ini?')) return;

    try {
      const { error } = await supabase
        .from('jadwal')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;
      fetchSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('Gagal menghapus jadwal');
    }
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const groupSchedulesByDay = (schedules) => {
    const grouped = {};
    days.forEach(day => {
      grouped[day] = schedules.filter(schedule => schedule.hari === day);
    });
    return grouped;
  };

  const groupedSchedules = groupSchedulesByDay(schedules);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded-xl w-48 mb-6"></div>
          {[1, 2, 3, 4].map(i => (
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
              <FiCalendar size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Jadwal Kuliah</h2>
              <p className="text-blue-100 text-sm">
                 Pantau jadwal mata kuliah Anda
              </p>
            </div>
          </div>
          {canManageSchedule && (
            <button
              onClick={() => {
                setEditingSchedule(null);
                setShowModal(true);
              }}
              className="bg-white/20 backdrop-blur-sm border border-white/30 text-white p-3 rounded-xl hover:bg-white/30 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <FiPlus size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Weekly Schedule */}
      <div className="space-y-4">
        {days.map(day => {
          const daySchedules = groupedSchedules[day];
          const hasSchedules = daySchedules.length > 0;
          
          return (
            <Card key={day} className="overflow-hidden hover:shadow-md transition-shadow">
              {/* Day Header */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FiClock className="text-blue-600" size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">{day}</h3>
                      <p className="text-sm text-gray-600">
                        {hasSchedules ? `${daySchedules.length} mata kuliah` : 'Tidak ada jadwal'}
                      </p>
                    </div>
                  </div>
                  {hasSchedules && (
                    <div className="text-right">
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-md">
                        {daySchedules.length} kelas
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Schedule Items */}
              <div className="p-4">
                {hasSchedules ? (
                  <div className="space-y-3">
                    {daySchedules.map((schedule, index) => (
                      <div 
                        key={schedule.id} 
                        className="group p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:shadow-md transition-all duration-200 hover:from-blue-100 hover:to-indigo-100"
                      >
                        {/* Mobile Layout */}
                        <div className="block">
                          {/* Header with title and time */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start space-x-3 flex-1 min-w-0">
                              <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                                <FiBookOpen size={20} className="text-blue-700" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-gray-800 text-lg mb-1 pr-2">
                                  {schedule.mata_kuliah}
                                </h4>
                              </div>
                            </div>
                          </div>

                          {/* Time Badge - Full width on mobile */}
                          <div className="mb-3">
                            <div className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow-sm inline-flex items-center space-x-2">
                              <FiClock size={14} />
                              <span>{formatTime(schedule.jam_mulai)} - {formatTime(schedule.jam_selesai)}</span>
                            </div>
                          </div>

                          {/* Description and Creator */}
                          <div className="space-y-2">
                            {schedule.deskripsi && (
                              <p className="text-gray-600 text-sm line-clamp-2">
                                {schedule.deskripsi}
                              </p>
                            )}
                            {schedule.users && (
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <FiUser size={12} />
                                <span>Dibuat oleh {schedule.users.nama_lengkap}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {canManageSchedule && (
                          <div className="flex justify-end space-x-2 mt-3 pt-3 border-t border-blue-200">
                            <button
                              onClick={() => handleEdit(schedule)}
                              className="flex items-center space-x-1 px-3 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-all text-sm font-medium"
                            >
                              <FiEdit size={14} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(schedule.id)}
                              className="flex items-center space-x-1 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-all text-sm font-medium"
                            >
                              <FiTrash2 size={14} />
                              <span>Hapus</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiCalendar className="text-gray-400" size={32} />
                    </div>
                    <p className="text-gray-500 font-medium mb-1">Tidak ada jadwal</p>
                    <p className="text-sm text-gray-400">Hari ini libur kuliah</p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <ScheduleModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        schedule={editingSchedule}
        onSuccess={() => {
          setShowModal(false);
          fetchSchedules();
        }}
      />
    </div>
  );
};

const ScheduleModal = ({ isOpen, onClose, schedule, onSuccess }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    mata_kuliah: '',
    hari: 'Senin',
    jam_mulai: '',
    jam_selesai: '',
    deskripsi: ''
  });
  const [loading, setLoading] = useState(false);

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  useEffect(() => {
    if (schedule) {
      setFormData({
        mata_kuliah: schedule.mata_kuliah || '',
        hari: schedule.hari || 'Senin',
        jam_mulai: schedule.jam_mulai || '',
        jam_selesai: schedule.jam_selesai || '',
        deskripsi: schedule.deskripsi || ''
      });
    } else {
      setFormData({
        mata_kuliah: '',
        hari: 'Senin',
        jam_mulai: '',
        jam_selesai: '',
        deskripsi: ''
      });
    }
  }, [schedule]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (schedule) {
        // Update existing schedule
        const { error } = await supabase
          .from('jadwal')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', schedule.id);

        if (error) throw error;
      } else {
        // Create new schedule
        const { error } = await supabase
          .from('jadwal')
          .insert([{
            ...formData,
            created_by: user.id
          }]);

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Gagal menyimpan jadwal');
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
      title={schedule ? 'Edit Jadwal' : 'Tambah Jadwal Baru'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mata Kuliah */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Mata Kuliah
          </label>
          <div className="relative">
            <FiBookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              name="mata_kuliah"
              value={formData.mata_kuliah}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
              placeholder="Nama mata kuliah"
              required
            />
          </div>
        </div>

        {/* Hari */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Hari
          </label>
          <div className="relative">
            <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <select
              name="hari"
              value={formData.hari}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white appearance-none"
            >
              {days.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Waktu */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Jam Mulai
            </label>
            <div className="relative">
              <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="time"
                name="jam_mulai"
                value={formData.jam_mulai}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Jam Selesai
            </label>
            <div className="relative">
              <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="time"
                name="jam_selesai"
                value={formData.jam_selesai}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                required
              />
            </div>
          </div>
        </div>

        {/* Deskripsi */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Deskripsi
          </label>
          <textarea
            name="deskripsi"
            value={formData.deskripsi}
            onChange={handleChange}
            rows="4"
            className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white resize-none"
            placeholder="Deskripsi mata kuliah (opsional)..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Menyimpan...</span>
              </div>
            ) : (
              schedule ? 'Update Jadwal' : 'Simpan Jadwal'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};