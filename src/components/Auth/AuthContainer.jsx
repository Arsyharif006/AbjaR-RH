import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw, Check, AlertCircle, User, Lock, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext'; // Import the real useAuth hook

export const AuthContainer = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { login, register } = useAuth(); // Use the real auth functions

  // Login states
  const [npm, setNpm] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState('');
  const [success, setSuccess] = useState('');

  // Register states
  const [formData, setFormData] = useState({
    namaLengkap: '',
    npm: '',
    password: '',
    code: ''
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  // Form validation for register
  const [formErrors, setFormErrors] = useState({
    namaLengkap: '',
    npm: '',
    password: '',
    code: ''
  });

  // Validate form fields
  const validateForm = () => {
    const errors = {
      namaLengkap: '',
      npm: '',
      password: '',
      code: ''
    };

    // Validate nama lengkap
    if (!formData.namaLengkap.trim()) {
      errors.namaLengkap = 'Nama lengkap harus diisi';
    } else if (formData.namaLengkap.trim().length < 3) {
      errors.namaLengkap = 'Nama lengkap minimal 3 karakter';
    } else if (!/^[a-zA-Z\s]+$/.test(formData.namaLengkap.trim())) {
      errors.namaLengkap = 'Nama lengkap hanya boleh mengandung huruf dan spasi';
    }

    // Validate NPM
    if (!formData.npm.trim()) {
      errors.npm = 'NPM harus diisi';
    } else if (!/^\d+$/.test(formData.npm)) {
      errors.npm = 'NPM harus berupa angka';
    } else if (formData.npm.length < 8 || formData.npm.length > 15) {
      errors.npm = 'NPM harus 8-15 digit';
    }

    // Validate password
    if (!formData.password) {
      errors.password = 'Password harus diisi';
    } else if (formData.password.length < 8) {
      errors.password = 'Password minimal 8 karakter';
    } else if (passwordStrength.score < 3) {
      errors.password = 'Password terlalu lemah';
    }

    // Validate code
    if (!formData.code.trim()) {
      errors.code = 'Kode registrasi harus diisi';
    }

    setFormErrors(errors);
    return Object.values(errors).every(error => error === '');
  };

  // Password strength checker
  const checkPasswordStrength = (pwd) => {
    if (!pwd || pwd.length === 0) {
      return { score: 0, text: '', color: '', feedback: [] };
    }

    let score = 0;
    let feedback = [];

    if (pwd.length >= 8) score += 1;
    else feedback.push('minimal 8 karakter');

    if (/[a-z]/.test(pwd)) score += 1;
    else feedback.push('huruf kecil');

    if (/[A-Z]/.test(pwd)) score += 1;
    else feedback.push('huruf besar');

    if (/\d/.test(pwd)) score += 1;
    else feedback.push('angka');

    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score += 1;
    else feedback.push('simbol');

    const strength = {
      0: { text: 'Sangat Lemah', color: 'text-red-500' },
      1: { text: 'Lemah', color: 'text-red-400' },
      2: { text: 'Sedang', color: 'text-yellow-500' },
      3: { text: 'Baik', color: 'text-blue-500' },
      4: { text: 'Kuat', color: 'text-green-500' },
      5: { text: 'Sangat Kuat', color: 'text-green-600' }
    };

    return { ...strength[score], score, feedback };
  };

  // Password generator
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Only for register password generation
  const handleGeneratePasswordRegister = () => {
    const newPassword = generatePassword();
    setFormData({ ...formData, password: newPassword });
    setPasswordStrength(checkPasswordStrength(newPassword));
  };

  useEffect(() => {
    if (!isLogin && formData.password) {
      setPasswordStrength(checkPasswordStrength(formData.password));
    }
  }, [formData.password, isLogin]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Basic validation
    if (!npm.trim()) {
      setError('NPM harus diisi');
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError('Password harus diisi');
      setLoading(false);
      return;
    }

    if (!/^\d+$/.test(npm)) {
      setError('NPM harus berupa angka');
      setLoading(false);
      return;
    }

    try {
      const result = await login(npm, password);
      if (result.success) {
        setSuccess('Login berhasil! Selamat datang 🎉');
        // Reset form
        setNpm('');
        setPassword('');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Terjadi kesalahan saat login');
    }
    
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validate form
    if (!validateForm()) {
      setLoading(false);
      return;
    }

    // Check registration code
    if (formData.code !== 'RH25UN1NDR406') {
      setError('Kode registrasi salah');
      setLoading(false);
      return;
    }

    try {
      const result = await register(formData);
      if (result.success) {
        setSuccess('Registrasi berhasil! Silakan login dengan akun Anda 🎉');
        setTimeout(() => {
          setIsLogin(true);
          setFormData({ namaLengkap: '', npm: '', password: '', code: '' });
          setPasswordStrength({ score: 0, text: '', color: '' });
          setFormErrors({ namaLengkap: '', npm: '', password: '', code: '' });
        }, 2000);
      } else {
        // Handle specific errors
        if (result.error.includes('duplicate key value')) {
          setError('NPM sudah terdaftar');
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('Terjadi kesalahan saat registrasi');
    }
    
    setLoading(false);
  };

  const handleChangeRegister = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    
    // Clear specific field error when user starts typing
    if (formErrors[e.target.name]) {
      setFormErrors({
        ...formErrors,
        [e.target.name]: ''
      });
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setNpm('');
    setPassword('');
    setFormData({ namaLengkap: '', npm: '', password: '', code: '' });
    setPasswordStrength({ score: 0, text: '', color: '', feedback: [] });
    setFormErrors({ namaLengkap: '', npm: '', password: '', code: '' });
    setShowPassword(false);
    setShowRegPassword(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
        <div className="absolute top-1/2 right-1/4 w-4 h-4 bg-white/20 rounded-full"></div>
        <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-white/30 rounded-full"></div>
        <div className="absolute bottom-1/3 left-1/4 w-3 h-3 bg-white/15 rounded-full"></div>
        <div className="absolute top-3/4 left-1/2 w-1 h-1 bg-white/40 rounded-full"></div>
      </div>

      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md p-8 border border-white/20 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              AbjaR RH
            </h1>
            <p className="text-gray-500 text-sm">
              Absen–Jadwal–Reminder
            </p>
            <p className="text-xs text-gray-400 mt-1">v1.0.0</p>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-3">
            {isLogin ? <User className="text-blue-600" size={20} /> : <UserPlus className="text-indigo-600" size={20} />}
            <h2 className="text-xl font-semibold text-gray-800">
              {isLogin ? 'Masuk' : 'Daftar Akun'}
            </h2>
          </div>
          <p className="text-gray-600 text-sm">
            {isLogin ? 'Selamat datang kembali!' : 'Bergabung dengan kami'}
          </p>
        </div>

        {/* Success/Error Notifications */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Check className="text-green-600" size={18} />
              <span className="text-green-700 text-sm font-medium">{success}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-600" size={18} />
              <span className="text-red-700 text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {isLogin ? (
          // LOGIN FORM
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <User size={14} />
                NPM
              </label>
              <input
                type="text"
                value={npm}
                onChange={(e) => setNpm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Masukkan NPM Anda"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Lock size={14} />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Masukkan password Anda"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Memproses...
                </div>
              ) : (
                'Masuk'
              )}
            </button>
          </div>
        ) : (
          // REGISTER FORM
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="namaLengkap"
                value={formData.namaLengkap}
                onChange={handleChangeRegister}
                className={`w-full p-3 border rounded-lg transition-colors ${
                  formErrors.namaLengkap 
                    ? 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
                placeholder="Masukkan nama lengkap"
                required
              />
              {formErrors.namaLengkap && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {formErrors.namaLengkap}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NPM <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="npm"
                value={formData.npm}
                onChange={handleChangeRegister}
                className={`w-full p-3 border rounded-lg transition-colors ${
                  formErrors.npm 
                    ? 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
                placeholder="Masukkan NPM (8-15 digit)"
                maxLength="15"
                required
              />
              {formErrors.npm && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {formErrors.npm}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChangeRegister}
                  className={`w-full p-3 pr-20 border rounded-lg transition-colors ${
                    formErrors.password 
                      ? 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                  placeholder="Buat password yang kuat (min. 8 karakter)"
                  required
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    onClick={handleGeneratePasswordRegister}
                    className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Generate Password"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showRegPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              
              {formErrors.password && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {formErrors.password}
                </p>
              )}
              
              {formData.password && !formErrors.password && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          passwordStrength.score <= 1 ? 'bg-red-500' :
                          passwordStrength.score <= 2 ? 'bg-yellow-500' :
                          passwordStrength.score <= 3 ? 'bg-blue-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-medium ${passwordStrength.color}`}>
                      {passwordStrength.text}
                    </span>
                  </div>
                  {passwordStrength.feedback && passwordStrength.feedback.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Perlu: {passwordStrength.feedback.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kode Registrasi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChangeRegister}
                className={`w-full p-3 border rounded-lg transition-colors ${
                  formErrors.code 
                    ? 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
                placeholder="Masukkan kode registrasi"
                required
              />
              {formErrors.code && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {formErrors.code}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Hubungi admin untuk mendapatkan kode registrasi
              </p>
            </div>

            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Mendaftar...
                </div>
              ) : (
                'Daftar Sekarang'
              )}
            </button>
          </div>
        )}

        {/* Toggle Link */}
        <div className="text-center mt-6 pt-4 border-t border-gray-200">
          <p className="text-gray-600 text-sm mb-2">
            {isLogin ? 'Belum memiliki akun?' : 'Sudah memiliki akun?'}
          </p>
          <button
            onClick={toggleAuthMode}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
          >
            {isLogin ? 'Daftar di sini' : 'Masuk di sini'}
          </button>
        </div>
      </div>
    </div>
  );
};