import React, { useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Send, Sparkles, MessageSquareHeart, CheckCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface FeedbackProps {
  onClose: () => void;
}

export default function Feedback({ onClose }: FeedbackProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError('');

    const user = auth.currentUser;
    if (!user) {
      setError('You must be signed in to submit feedback.');
      setLoading(false);
      return;
    }

    try {
      // Save feedback to Firestore matching Phase 1 model structures
      try {
        await addDoc(collection(db, 'feedback'), {
          userId: user.uid,
          userEmail: user.email || 'anonymous',
          message: message.trim(),
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'feedback');
      }

      setSuccess(true);
      setMessage('');
    } catch (err: any) {
      console.error('Error saving feedback:', err);
      setError('Failed to record feedback. Please inspect connection details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 max-w-md w-full relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-100/50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

      {success ? (
        <div className="text-center py-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle className="h-6 w-6" />
          </motion.div>
          <h3 className="text-lg font-display font-semibold text-slate-900">Feedback Submitted</h3>
          <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto">
            Your valuable insights and bug reports help shape optimized product workflows.
          </p>
          <button
            onClick={onClose}
            className="mt-6 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Dismiss Panel
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 bg-pink-100 text-pink-600 rounded-lg flex items-center justify-center">
              <MessageSquareHeart className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-display font-semibold text-slate-900">Submit Application Feedback</h3>
              <p className="text-[10px] text-slate-400">Suggest elements, report issues, or review features.</p>
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5">
              {error}
            </div>
          )}

          <div>
            <textarea
              required
              rows={4}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., The category filtering works great! I would love an option for task tag groupings next..."
              className="w-full text-slate-950 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none transitionfocus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-450 italic flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" /> Auto-syncs to database
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 hover:bg-slate-100 text-slate-500 rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !message.trim()}
                className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Share Feedback
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
