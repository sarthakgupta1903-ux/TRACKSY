/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { Sparkles } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state transitions
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md mb-4 animate-bounce">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500 font-mono tracking-widest uppercase">
            Synchronizing Cloud Gateways...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {user ? (
        <Dashboard onSignOut={() => setUser(null)} />
      ) : (
        <Auth onAuthSuccess={() => setUser(auth.currentUser)} />
      )}
    </>
  );
}
