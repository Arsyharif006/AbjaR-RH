import { useState, useEffect } from 'react';
import { FiHome, FiCalendar, FiCheckSquare, FiClipboard, FiUsers, FiLogOut, FiBell, FiX, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';

export const Layout = ({ children, activeTab, onTabChange }) => {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      setupRealTimeNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      setLoadingNotifications(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const setupRealTimeNotifications = () => {
    if (!user) return;

    // Listen for new notifications
    const notificationChannel = supabase
      .channel('user_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          setNotifications(current => [payload.new, ...current]);
          
          // Show browser notification if permission is granted
          if (Notification.permission === 'granted') {
            new Notification(payload.new.title, {
              body: payload.new.message,
              icon: '/favicon.ico',
              tag: payload.new.id
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Notification updated:', payload);
          setNotifications(current =>
            current.map(notif =>
              notif.id === payload.new.id ? payload.new : notif
            )
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time notifications subscribed');
        }
      });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Cleanup function
    return () => {
      supabase.removeChannel(notificationChannel);
    };
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setNotifications(current =>
        current.map(notif =>
          notif.id === notificationId
            ? { ...notif, is_read: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => !n.is_read)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setNotifications(current =>
        current.map(notif => ({ ...notif, is_read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setNotifications(current =>
        current.filter(notif => notif.id !== notificationId)
      );
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task': return '📝';
      case 'role_change': return '👑';
      case 'attendance': return '✅';
      case 'general': return '📢';
      default: return '🔔';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'task': return 'border-blue-500 bg-blue-50';
      case 'role_change': return 'border-purple-500 bg-purple-50';
      case 'attendance': return 'border-green-500 bg-green-50';
      case 'general': return 'border-gray-500 bg-gray-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: FiHome },
    { id: 'jadwal', label: 'Jadwal', icon: FiCalendar },
    { id: 'tugas', label: 'Tugas', icon: FiCheckSquare },
    { id: 'absensi', label: 'Absensi', icon: FiClipboard },
  ];

  // Add management tab only for super admin
  if (user?.role === 'super_admin') {
    tabs.push({ id: 'manage', label: 'Kelola', icon: FiUsers });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Blue Theme */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white shadow-lg">
        <div className="px-4 py-4">
          <div className="flex justify-between items-center">
            {/* Left - App Title */}
            <div>
              <h1 className="text-xl font-bold text-white">AbjaR RH</h1>
              <p className="text-sm text-blue-100">Absen–Jadwal–Reminder</p>
            </div>

            {/* Right - Notification & Logout */}
            <div className="flex items-center space-x-2">
              {/* Notification Button */}
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiBell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="p-2 text-blue-100 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                title="Logout"
              >
                <FiLogOut size={20} />
              </button>
            </div>
          </div>
        </div>

         {/* User Info Bar */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {user?.nama_lengkap?.charAt(0) || 'U'}
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{user?.nama_lengkap}</p>
                <p className="text-xs text-gray-600 capitalize">
                  • NPM: {user?.npm}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                {new Date().toLocaleDateString('id-ID', { 
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short'
                })}
              </p>
              {unreadCount > 0 && (
                <p className="text-xs text-blue-600 font-medium">
                  {unreadCount} notifikasi baru
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pb-20">
        {children}
      </div>

      {/* Bottom Navigation - Keep Original Design */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200/50 px-2 py-2 shadow-lg">
        <div className="flex justify-around items-center max-w-md mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-col items-center py-2 px-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'text-white' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg"></div>
                )}
                <div className="relative z-10 flex flex-col items-center">
                  <Icon size={20} />
                  <span className="text-xs mt-1 font-medium">{tab.label}</span>
                </div>
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications Modal */}
      {showNotifications && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
            onClick={() => setShowNotifications(false)}
          >
            {/* Modal Container */}
            <div 
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col relative animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Notifikasi</h3>
                    {unreadCount > 0 && (
                      <p className="text-xs text-blue-100">{unreadCount} belum dibaca</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={fetchNotifications}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                      title="Refresh"
                      disabled={loadingNotifications}
                    >
                      <FiRefreshCw size={16} className={`text-white ${loadingNotifications ? 'animate-spin' : ''}`} />
                    </button>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-blue-100 hover:text-white font-medium px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        Tandai Semua
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <FiX size={16} className="text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto">
                {loadingNotifications ? (
                  <div className="p-8 text-center">
                    <FiRefreshCw className="mx-auto text-gray-400 mb-3 animate-spin" size={24} />
                    <p className="text-gray-500 text-sm">Memuat notifikasi...</p>
                  </div>
                ) : notifications.length > 0 ? (
                  <div className="p-3 space-y-2">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`group p-3 rounded-xl transition-all hover:shadow-sm cursor-pointer ${
                          !notif.is_read 
                            ? `${getNotificationColor(notif.type)} border-l-4` 
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => !notif.is_read && markAsRead(notif.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="text-lg flex-shrink-0 mt-0.5">
                              {getNotificationIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <p className="font-medium text-gray-800 text-sm truncate">
                                  {notif.title}
                                </p>
                                {!notif.is_read && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 animate-pulse"></div>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 break-words line-clamp-2">
                                {notif.message}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-xs text-gray-500">
                                  {new Date(notif.created_at).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notif.id);
                                  }}
                                  className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50"
                                  title="Hapus"
                                >
                                  <FiX size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <FiBell className="mx-auto text-gray-400 mb-3" size={32} />
                    <p className="text-gray-500 font-medium">Tidak ada notifikasi</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Notifikasi baru akan muncul di sini
                    </p>
                  </div>
                )}
              </div>

              {/* Footer - Only show if there are notifications */}
              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{notifications.length} notifikasi total</span>
                    <button 
                      onClick={() => {
                        // Could implement "view all" functionality here
                        console.log('View all notifications');
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Lihat Semua
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* Add CSS for animation */}
      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export const Card = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  );
};

export const Modal = ({ isOpen, onClose, title, children, size = 'default' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    default: 'max-w-md',
    large: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div 
        className={`bg-white rounded-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <FiX size={16} />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
      
      {/* Add CSS for animation */}
      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};