import { useState, useEffect } from 'react';
import { FiUsers, FiUserCheck, FiUserX, FiShield, FiSearch, FiChevronLeft, FiChevronRight, FiUser } from 'react-icons/fi';
import { Card, Modal } from '../Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const Manage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 6;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.nama_lengkap?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.npm?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleRoleChange = (targetUser, role) => {
    setSelectedUser(targetUser);
    setNewRole(role);
    setShowModal(true);
  };

  const confirmRoleChange = async () => {
    if (!selectedUser || !newRole) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', selectedUser.id);

      if (error) throw error;

      // Send notification to the user
      await supabase
        .from('notifications')
        .insert([{
          user_id: selectedUser.id,
          title: 'Perubahan Role',
          message: `Role Anda telah diubah menjadi ${newRole}`,
          type: 'role_change'
        }]);

      setShowModal(false);
      fetchUsers();
      alert(`Role ${selectedUser.nama_lengkap} berhasil diubah menjadi ${newRole}`);
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Gagal mengubah role user');
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      anggota: { label: 'Anggota', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
      admin: { label: 'Admin', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
      super_admin: { label: 'Super Admin', className: 'bg-red-100 text-red-700 border border-red-200' }
    };
    return badges[role] || badges.anggota;
  };

  const canPromoteToAdmin = (targetUser) => {
    if (user?.role !== 'super_admin') return false;
    if (targetUser.role === 'super_admin') return false;
    if (targetUser.id === user.id) return false;
    
    const currentAdminCount = users.filter(u => u.role === 'admin').length;
    return targetUser.role === 'anggota' && currentAdminCount < 2;
  };

  const canDemoteFromAdmin = (targetUser) => {
    if (user?.role !== 'super_admin') return false;
    if (targetUser.id === user.id) return false;
    return targetUser.role === 'admin';
  };

  const getRoleStats = () => {
    return {
      total: filteredUsers.length,
      totalAll: users.length,
      anggota: users.filter(u => u.role === 'anggota').length,
      admin: users.filter(u => u.role === 'admin').length,
      super_admin: users.filter(u => u.role === 'super_admin').length
    };
  };

  const stats = getRoleStats();

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-2xl mb-6"></div>
          <div className="h-12 bg-gray-200 rounded-xl mb-4"></div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
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

        <div className="relative z-10">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
              <FiShield size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Kelola Pengguna</h2>
              <p className="text-blue-100 text-sm">
                Kelola role dan akses pengguna dalam sistem
              </p>
            </div>
          </div>

          {/* Total users display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FiUsers className="text-blue-100" size={18} />
              <span className="text-blue-100 text-sm">
                {searchQuery ? `${stats.total} dari ${stats.totalAll}` : `${stats.totalAll} Total Pengguna`}
              </span>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-blue-100 text-sm hover:text-white underline"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4 text-center hover:shadow-md transition-shadow">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiUsers className="text-blue-600" size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 mb-1">{stats.anggota}</p>
          <span className="font-semibold text-gray-800 text-xs sm:text-sm">Anggota</span>
        </Card>

        <Card className="p-3 sm:p-4 text-center hover:shadow-md transition-shadow">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiUserCheck className="text-blue-600" size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 mb-1">{stats.admin}</p>
          <span className="font-semibold text-gray-800 text-xs sm:text-sm">Admin</span>
          <p className="text-xs text-gray-500 mt-1">Max: 2</p>
        </Card>

        <Card className="p-3 sm:p-4 text-center hover:shadow-md transition-shadow">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <FiShield className="text-red-600" size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-red-600 mb-1">{stats.super_admin}</p>
          <span className="font-semibold text-gray-800 text-xs sm:text-sm">Super Admin</span>
          <p className="text-xs text-gray-500 mt-1">Max: 1</p>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Cari nama pengguna atau NPM..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
          />
        </div>
        {searchQuery && (
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <span>Menampilkan {stats.total} hasil dari {stats.totalAll} pengguna</span>
          </div>
        )}
      </Card>

      {/* Users List */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg flex items-center space-x-2">
            <FiUsers className="text-blue-600" size={20} />
            <span>Daftar Pengguna</span>
          </h3>
          {currentUsers.length > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              Halaman {currentPage} dari {totalPages} - Menampilkan {indexOfFirstUser + 1}-{Math.min(indexOfLastUser, filteredUsers.length)} dari {filteredUsers.length} pengguna
            </p>
          )}
        </div>
        
        <div className="p-4">
          {currentUsers.length > 0 ? (
            <div className="space-y-3">
              {currentUsers.map((targetUser) => {
                const roleBadge = getRoleBadge(targetUser.role);
                const canPromote = canPromoteToAdmin(targetUser);
                const canDemote = canDemoteFromAdmin(targetUser);
                
                return (
                  <div key={targetUser.id} className="group p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:shadow-md transition-all duration-200 hover:from-blue-100 hover:to-indigo-100">
                    {/* Mobile Layout */}
                    <div className="block">
                      {/* Header with avatar and name */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                            <FiUser size={20} className="text-blue-700" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2 mb-1 flex-wrap">
                              <h4 className="font-bold text-gray-800 text-lg">
                                {targetUser.nama_lengkap}
                              </h4>
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${roleBadge.className}`}>
                                {roleBadge.label}
                              </span>
                            </div>
                            {targetUser.id === user?.id && (
                              <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded-full font-medium">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* User Details */}
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">NPM:</span>
                            <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                              {targetUser.npm}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">Bergabung:</span>
                            <span>{new Date(targetUser.created_at).toLocaleDateString('id-ID')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {user?.role === 'super_admin' && targetUser.id !== user?.id && (canPromote || canDemote) && (
                      <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-blue-200">
                        {canPromote && (
                          <button
                            onClick={() => handleRoleChange(targetUser, 'admin')}
                            className="flex items-center space-x-1 px-3 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-all text-sm font-medium"
                            title="Jadikan Admin"
                          >
                            <FiUserCheck size={14} />
                            <span className="hidden sm:inline">Jadikan Admin</span>
                            <span className="sm:hidden">Admin</span>
                          </button>
                        )}
                        
                        {canDemote && (
                          <button
                            onClick={() => handleRoleChange(targetUser, 'anggota')}
                            className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all text-sm font-medium"
                            title="Turunkan ke Anggota"
                          >
                            <FiUserX size={14} />
                            <span className="hidden sm:inline">Turunkan</span>
                            <span className="sm:hidden">Demote</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {searchQuery ? <FiSearch className="text-gray-400" size={32} /> : <FiUsers className="text-gray-400" size={32} />}
              </div>
              <p className="text-gray-500 font-medium mb-1">
                {searchQuery ? 'Pengguna tidak ditemukan' : 'Tidak ada pengguna'}
              </p>
              <p className="text-sm text-gray-400">
                {searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : 'Belum ada pengguna terdaftar'}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <FiChevronLeft size={18} />
                </button>
                
                <div className="hidden sm:flex space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        page === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <div className="sm:hidden">
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <FiChevronRight size={18} />
                </button>
              </div>

              <div className="text-sm text-gray-600">
                <span className="hidden sm:inline">
                  Menampilkan {indexOfFirstUser + 1}-{Math.min(indexOfLastUser, filteredUsers.length)} dari {filteredUsers.length}
                </span>
                <span className="sm:hidden">
                  {indexOfFirstUser + 1}-{Math.min(indexOfLastUser, filteredUsers.length)} / {filteredUsers.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Role Change Confirmation Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Konfirmasi Perubahan Role"
      >
        {selectedUser && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiUser className="text-blue-600" size={24} />
              </div>
              
              <p className="text-gray-700 mb-2">
                Anda akan mengubah role <strong>{selectedUser.nama_lengkap}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                NPM: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{selectedUser.npm}</span>
              </p>
              
              <div className="flex items-center justify-center space-x-4 mb-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Role Saat Ini</p>
                  <span className={`px-3 py-1 text-sm rounded-full font-medium ${getRoleBadge(selectedUser.role).className}`}>
                    {getRoleBadge(selectedUser.role).label}
                  </span>
                </div>
                
                <div className="text-gray-400">→</div>
                
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Role Baru</p>
                  <span className={`px-3 py-1 text-sm rounded-full font-medium ${getRoleBadge(newRole).className}`}>
                    {getRoleBadge(newRole).label}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>Perhatian:</strong> Perubahan role akan berlaku segera dan pengguna akan menerima notifikasi.
              </p>
            </div>
            
            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Batal
              </button>
              <button
                onClick={confirmRoleChange}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Manage;