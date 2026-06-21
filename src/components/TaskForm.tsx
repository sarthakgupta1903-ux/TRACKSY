import React, { useState, useEffect } from 'react';
import { Task, TaskCategory, TaskPriority, RepeatPattern } from '../types';
import { X, Calendar, AlertTriangle, Tag, Clock, Repeat, AlignLeft, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface TaskFormProps {
  task?: Task | null; // If editing
  onClose: () => void;
  onSubmit: (taskData: Omit<Task, 'userId' | 'createdAt' | 'updatedAt'>) => void;
}

const CATEGORIES: TaskCategory[] = ['Work', 'Personal', 'Shopping', 'Health', 'Fitness', 'Ideas', 'Other'];
const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
const REPEAT_PATTERNS: { value: RepeatPattern; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'custom', label: 'Custom days' }
];

const WEEK_DAYS = [
  { key: 'Mon', label: 'M' },
  { key: 'Tue', label: 'T' },
  { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'T' },
  { key: 'Fri', label: 'F' },
  { key: 'Sat', label: 'S' },
  { key: 'Sun', label: 'S' }
];

export default function TaskForm({ task, onClose, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Work');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatPattern, setRepeatPattern] = useState<RepeatPattern>('none');
  const [customActiveDays, setCustomActiveDays] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Hydrate fields if editing
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setCategory(task.category);
      setPriority(task.priority);
      setStartDate(task.startDate || '');
      setDueDate(task.dueDate || '');
      setReminderTime(task.reminderTime || '');
      setIsRecurring(task.isRecurring || false);
      setRepeatPattern(task.repeatPattern || 'none');
      setCustomActiveDays(task.customActiveDays || []);
    } else {
      // Defaults
      const todayString = new Date().toISOString().split('T')[0];
      setStartDate(todayString);
      setDueDate(todayString);
    }
  }, [task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    if (isRecurring && repeatPattern === 'custom' && customActiveDays.length === 0) {
      setError('Please select at least one day of the week for custom recurrence.');
      return;
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      status: task ? task.status : 'pending',
      startDate,
      dueDate,
      reminderTime,
      isRecurring,
      repeatPattern: isRecurring ? repeatPattern : 'none',
      customActiveDays: (isRecurring && repeatPattern === 'custom') ? customActiveDays : []
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.3, cubicBezier: [0.16, 1, 0.3, 1] }}
        className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
          <h3 className="text-lg font-display font-semibold text-slate-950">
            {task ? 'Modify Task Details' : 'Design Private Task'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-rose-50 text-rose-600 text-xs py-2.5 px-4 rounded-xl border border-rose-100 font-medium">
              {error}
            </div>
          )}

          {/* Title input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Structure team sprint retrospective schedule"
              maxLength={150}
              className="w-full text-slate-950 px-4 py-3 bg-slate-50 text-sm border border-slate-200 rounded-xl outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {/* Description input */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <AlignLeft className="h-3.5 w-3.5 text-slate-400" />
              <span>Description / Notes</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add optional task sub-items, bullet points, links, or checklists..."
              rows={3}
              maxLength={1000}
              className="w-full text-slate-950 px-4 py-3 bg-slate-50 text-sm border border-slate-200 rounded-xl outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 resize-none"
            />
          </div>

          {/* Grid Layout properties */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category selection */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                <span>Category</span>
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-sm border border-slate-200 rounded-xl outline-none transition-all focus:border-blue-500 focus:bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority option */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                <span>Priority</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
                {PRIORITIES.map((pr) => {
                  const isActive = priority === pr;
                  const colorMap = {
                    low: 'text-emerald-650 bg-emerald-50 hover:bg-emerald-100',
                    medium: 'text-amber-750 bg-amber-50 hover:bg-amber-100',
                    high: 'text-rose-650 bg-rose-50 hover:bg-rose-100'
                  };
                  return (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => setPriority(pr)}
                      className={`flex-1 py-1 px-2 text-xs font-semibold capitalize rounded-lg transition-all ${
                        isActive 
                          ? `${colorMap[pr]} shadow-sm border border-slate-200/50` 
                          : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                      }`}
                    >
                      {pr}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Date Picker Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Start Date</span>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-sm border border-slate-200 rounded-xl outline-none"
              />
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Due Date</span>
              </div>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-500 text-sm border border-slate-200 rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Reminder Trigger Time */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Reminder Notification Alert</span>
            </div>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-500 text-sm border border-slate-200 rounded-xl outline-none transition-all focus:border-blue-500 focus:bg-white"
            />
            <p className="text-[10px] text-slate-450 italic">
              Sends local visual notification alert at specified system hour.
            </p>
          </div>

          {/* Scheduler / Recurrence trigger */}
          <div className="bg-slate-50 p-4 border border-slate-200/60 rounded-xl space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-bold text-slate-800">Recurring Task Scheduler</span>
              </div>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => {
                  setIsRecurring(e.target.checked);
                  if (e.target.checked && repeatPattern === 'none') {
                    setRepeatPattern('daily');
                  }
                }}
                className="rounded text-blue-600 focus:ring-blue-100 h-4 w-4"
              />
            </label>

            {isRecurring && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-3 border-t border-slate-200/50 space-y-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-slate-500">Repeat Frequency</span>
                  <select
                    value={repeatPattern}
                    onChange={(e) => setRepeatPattern(e.target.value as RepeatPattern)}
                    className="bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    {REPEAT_PATTERNS.filter(p => p.value !== 'none').map((pat) => (
                      <option key={pat.value} value={pat.value}>
                        {pat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {repeatPattern === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 bg-white p-3.5 rounded-xl border border-indigo-50/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Weekdays</span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50/70 px-1.5 py-0.5 rounded">
                        {customActiveDays.length} day(s) selected
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      {WEEK_DAYS.map((day) => {
                        const isSelected = customActiveDays.includes(day.key);
                        return (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setCustomActiveDays((prev) => prev.filter((d) => d !== day.key));
                              } else {
                                setCustomActiveDays((prev) => [...prev, day.key]);
                              }
                            }}
                            className={`w-8 h-8 rounded-xl text-xs font-black transition-all flex items-center justify-center ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100/80 hover:text-slate-800'
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Presets Button Bank */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                        Quick Day Presets
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCustomActiveDays(['Mon', 'Wed', 'Fri'])}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[9px] font-bold rounded-lg transition"
                        >
                          MWF (Alternate)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomActiveDays(['Tue', 'Thu', 'Sat'])}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[9px] font-bold rounded-lg transition"
                        >
                          TTS (Alternate)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomActiveDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-bold rounded-lg transition"
                        >
                          Weekdays
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomActiveDays(['Sat', 'Sun'])}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-bold rounded-lg transition"
                        >
                          Weekends
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomActiveDays([])}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-bold rounded-lg transition ml-auto"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all active:scale-98 shadow-blue-100"
            >
              <Check className="h-3.5 w-3.5" />
              {task ? 'Save Changes' : 'Publish Task'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
