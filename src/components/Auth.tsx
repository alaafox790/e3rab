import { useState } from 'react';
import { motion } from 'motion/react';

export default function Auth({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (mobile.length === 11 && /^\d+$/.test(mobile)) {
      localStorage.setItem('isRegistered', 'true');
      onLoginSuccess();
    } else {
      setError('يرجى إدخال رقم موبايل صحيح مكون من 11 رقم');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50"
    >
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">تسجيل الدخول</h2>
        <div className="flex flex-col gap-4">
          <input 
            type="tel" 
            placeholder="رقم الموبايل (11 رقم)" 
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="p-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
            maxLength={11}
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button 
            onClick={handleLogin}
            className="bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition-all active:scale-95"
          >
            دخول
          </button>
        </div>
      </div>
    </motion.div>
  );
}
