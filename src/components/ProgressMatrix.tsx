import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType, getLocalDateString } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  Calendar, 
  MessageSquare, 
  Award, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  Filter, 
  Check, 
  X, 
  Minus,
  AlertCircle,
  HelpCircle,
  PlusCircle,
  Search,
  BookOpen
} from 'lucide-react';
import { Task, TaskOccurrence } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ProgressMatrixProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
}

export default function ProgressMatrix({ tasks, onEditTask }: ProgressMatrixProps) {
  const user = auth.currentUser;
  const [occurrences, setOccurrences] = useState<TaskOccurrence[]>([]);
  const [loading, setLoading] = useState(true);

  // sliding date range state (showing 7 days)
  const [startDateOffset, setStartDateOffset] = useState<number>(-4); // default center around today
  const [selectedCell, setSelectedCell] = useState<{ taskId: string; dateStr: string } | null>(null);
  const [cellNotes, setCellNotes] = useState('');
  const [cellStatus, setCellStatus] = useState<'completed' | 'missed' | 'pending' | 'skipped'>('pending');

  // row filter states
  const [rowSearchQuery, setRowSearchQuery] = useState('');
  const [rowMarkFilter, setRowMarkFilter] = useState<'all' | 'marked' | 'unmarked'>('all');

  // Listen to task occurrences for active user from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'taskOccurrences'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TaskOccurrence[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TaskOccurrence);
      });
      setOccurrences(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching occurrences: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Generate 7 display days based on the offset
  const getDisplayDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + startDateOffset + i);
      days.push(d);
    }
    return days;
  };

  const displayDays = getDisplayDays();

  const formatDateLabel = (date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      dayName: days[date.getDay()],
      dayNum: date.getDate(),
      monthName: months[date.getMonth()],
      dateStr: getLocalDateString(date)
    };
  };

  // Only consider recurring tasks (isRecurring === true)
  const recurringTasks = tasks.filter(t => t.isRecurring);

  // Filter tasks based on search and marked state
  const filteredTasks = recurringTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(rowSearchQuery.toLowerCase());
    
    if (rowMarkFilter === 'marked') {
      return matchesSearch && !!task.marked;
    }
    if (rowMarkFilter === 'unmarked') {
      return matchesSearch && !task.marked;
    }
    return matchesSearch;
  });

  // Toggle marked status for a row
  const toggleRowMarked = async (task: Task) => {
    if (!task.id) return;
    try {
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        marked: !task.marked,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  // Handle cell edit modal/panel selection
  const handleCellClick = (taskId: string, dateStr: string) => {
    const existing = occurrences.find(o => o.taskId === taskId && o.scheduledDate === dateStr);
    setSelectedCell({ taskId, dateStr });
    setCellStatus(existing ? existing.status : 'pending');
    setCellNotes(existing?.notes || '');
  };

  // Save the occurrence update/create to Firestore
  const handleSaveOccurrence = async () => {
    if (!user || !selectedCell) return;
    const { taskId, dateStr } = selectedCell;
    const existing = occurrences.find(o => o.taskId === taskId && o.scheduledDate === dateStr);

    // Close the edit popup instantly for highly-responsive fast-feedback UX
    setSelectedCell(null);

    try {
      if (existing && existing.id) {
        // update existing doc
        const docRef = doc(db, 'taskOccurrences', existing.id);
        await updateDoc(docRef, {
          status: cellStatus,
          notes: cellNotes,
          completedAt: cellStatus === 'completed' ? new Date().toISOString() : '',
          updatedAt: new Date().toISOString()
        });
      } else {
        // create new doc
        const customId = `${user.uid}_${taskId}_${dateStr}`;
        const docRef = doc(db, 'taskOccurrences', customId);
        await setDoc(docRef, {
          userId: user.uid,
          taskId,
          scheduledDate: dateStr,
          status: cellStatus,
          notes: cellNotes,
          completedAt: cellStatus === 'completed' ? new Date().toISOString() : '',
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      const customId = `${user.uid}_${taskId}_${dateStr}`;
      handleFirestoreError(err, existing && existing.id ? OperationType.UPDATE : OperationType.WRITE, `taskOccurrences/${existing?.id || customId}`);
    }
  };

  // Calculate stats for a specific recurring task
  const calculateTaskStats = (taskId: string) => {
    const taskOccs = occurrences.filter(o => o.taskId === taskId);
    const completedOccs = taskOccs.filter(o => o.status === 'completed');
    const missedOccs = taskOccs.filter(o => o.status === 'missed');
    const skippedOccs = taskOccs.filter(o => o.status === 'skipped');

    // Calculate completion rate based on completed vs tracked (completed + missed)
    const trackedCount = completedOccs.length + missedOccs.length;
    const completionRate = trackedCount > 0 ? Math.round((completedOccs.length / trackedCount) * 100) : 0;

    // Calculate current streak
    // Sort occurrences by date descending
    const sortedCompletions = [...taskOccs]
      .filter(o => o.status === 'completed')
      .map(o => o.scheduledDate)
      .sort((a, b) => b.localeCompare(a));

    let currentStreak = 0;
    if (sortedCompletions.length > 0) {
      const todayStr = getLocalDateString();
      const yesterdayStr = getLocalDateString(new Date(Date.now() - 86400000));
      
      const latestDate = sortedCompletions[0];
      // If the latest completion is today or yesterday, count streak
      if (latestDate === todayStr || latestDate === yesterdayStr) {
        currentStreak = 1;
        let lastDate = new Date(latestDate);
        for (let i = 1; i < sortedCompletions.length; i++) {
          const checkDate = new Date(sortedCompletions[i]);
          const diffTime = Math.abs(lastDate.getTime() - checkDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            currentStreak++;
            lastDate = checkDate;
          } else if (diffDays > 1) {
            // broken streak
            break;
          }
        }
      }
    }

    // Longest streak
    // Sort all completed dates ascending to calculate max consecutive days
    const ascCompletions = [...taskOccs]
      .filter(o => o.status === 'completed')
      .map(o => o.scheduledDate)
      .sort((a, b) => a.localeCompare(b));

    let longestStreak = 0;
    let tempStreak = 0;
    let lastDateObj: Date | null = null;

    ascCompletions.forEach((dateStr) => {
      const currDate = new Date(dateStr);
      if (!lastDateObj) {
        tempStreak = 1;
      } else {
        const diffTime = Math.abs(currDate.getTime() - lastDateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
          tempStreak = 1;
        }
      }
      lastDateObj = currDate;
    });
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }

    return {
      completed: completedOccs.length,
      missed: missedOccs.length,
      skipped: skippedOccs.length,
      completionRate,
      currentStreak,
      longestStreak
    };
  };

  // Helper to calculate totals for visible display columns
  const getRowPeriodTotals = (taskId: string, days: Date[]) => {
    let done = 0;
    let missed = 0;
    let skipped = 0;
    let pending = 0;

    days.forEach(day => {
      const dateStr = getLocalDateString(day);
      const occ = occurrences.find(o => o.taskId === taskId && o.scheduledDate === dateStr);
      if (!occ) {
        pending++;
      } else {
        if (occ.status === 'completed') done++;
        else if (occ.status === 'missed') missed++;
        else if (occ.status === 'skipped') skipped++;
        else pending++;
      }
    });

    return { done, missed, skipped, pending };
  };

  // Helper colors for status badges
  const getStatusDetails = (status: 'completed' | 'missed' | 'pending' | 'skipped') => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-emerald-500 hover:bg-emerald-600',
          textColor: 'text-emerald-700',
          label: 'Done',
          icon: <Check className="h-3 w-3 text-white" />
        };
      case 'missed':
        return {
          bg: 'bg-rose-500 hover:bg-rose-600',
          textColor: 'text-rose-700',
          label: 'Missed',
          icon: <X className="h-3 w-3 text-white" />
        };
      case 'skipped':
        return {
          bg: 'bg-amber-400 hover:bg-amber-500',
          textColor: 'text-amber-700',
          label: 'Skipped',
          icon: <Minus className="h-3 w-3 text-slate-900" />
        };
      default:
        return {
          bg: 'bg-slate-100 hover:bg-slate-200 border border-dashed border-slate-300',
          textColor: 'text-slate-400',
          label: 'Pending',
          icon: <Clock className="h-3 w-3 text-slate-400" />
        };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Intro Banner */}
      <div className="bg-white rounded-3xl p-6 border border-indigo-50 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            Recurring Task Progress Matrix
          </h3>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            Track daily, weekly, and monthly habits over time. Toggle "Marked" states for prioritize displays.
          </p>
        </div>
        
        {/* Navigation & Date slider buttons */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-2xl p-1.5 self-stretch md:self-auto justify-between">
          <button
            onClick={() => setStartDateOffset(prev => prev - 7)}
            className="p-2 bg-white rounded-xl shadow-xs text-slate-600 hover:text-indigo-600 transition"
            title="Previous Week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold text-slate-700 px-3 select-none">
            Slide Date Grid
          </span>
          <button
            onClick={() => setStartDateOffset(prev => prev + 7)}
            className="p-2 bg-white rounded-xl shadow-xs text-slate-600 hover:text-indigo-600 transition"
            title="Next Week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Row filtering controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white border border-indigo-50 p-4.5 rounded-2xl shadow-xs">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search recurring habits..."
            value={rowSearchQuery}
            onChange={(e) => setRowSearchQuery(e.target.value)}
            className="w-full bg-slate-100/60 border border-slate-250/30 rounded-xl py-2 px-10 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Marked Toggle selectors */}
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-200">
          {[
            { value: 'all', label: 'All Rows' },
            { value: 'marked', label: '★ Marked Rows' },
            { value: 'unmarked', label: '☆ Unmarked' }
          ].map((itm) => (
            <button
              key={itm.value}
              onClick={() => setRowMarkFilter(itm.value as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                rowMarkFilter === itm.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-indigo-650'
              }`}
            >
              {itm.label}
            </button>
          ))}
        </div>
      </div>

      {recurringTasks.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-indigo-50 p-16 text-center space-y-4">
          <BookOpen className="h-12 w-12 text-indigo-300 mx-auto" />
          <h4 className="text-base font-bold text-indigo-950 font-display">No Recurring Habits Drafted Yet</h4>
          <p className="text-xs text-slate-450 mt-1 max-w-sm mx-auto">
            You currently have no tasks configured as recurring. Build a new task sheet and activate the <strong>Recurring Task Scheduler</strong> checkbox to begin.
          </p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-indigo-50 p-16 text-center space-y-2">
          <HelpCircle className="h-10 w-10 text-indigo-200 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No habit rows match current filters</h4>
          <p className="text-xs text-slate-450">Try disabling searches or resetting the "Marked Rows" filters above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-indigo-50 shadow-md overflow-hidden">
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-indigo-100">
                  {/* Task Header row info */}
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-450 min-w-[240px] pl-6 border-r border-indigo-50">
                    Habit Row Name
                  </th>

                  {/* Columns generated dynamically */}
                  {displayDays.map((day, idx) => {
                    const info = formatDateLabel(day);
                    const isToday = getLocalDateString() === info.dateStr;
                    return (
                      <th 
                        key={idx} 
                        className={`p-3 text-center min-w-[85px] border-r border-indigo-50 ${
                          isToday ? 'bg-indigo-50/40 relative font-extrabold' : ''
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${isToday ? 'text-indigo-650' : 'text-slate-400'}`}>
                            {info.dayName}
                          </span>
                          <span className={`text-base font-mono mt-0.5 ${isToday ? 'text-indigo-750 font-black' : 'text-slate-800'}`}>
                            {info.dayNum}
                          </span>
                          <span className={`text-[9px] font-semibold font-mono ${isToday ? 'text-indigo-500' : 'text-slate-400'}`}>
                            {info.monthName}
                          </span>
                          {isToday && (
                            <span className="absolute bottom-1 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                          )}
                        </div>
                      </th>
                    );
                  })}

                  {/* Period Totals Headers */}
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-wider text-emerald-650 bg-emerald-50/15 border-r border-indigo-50 min-w-[55px]">
                    Done
                  </th>
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-wider text-rose-650 bg-rose-50/15 border-r border-indigo-50 min-w-[55px]">
                    Missed
                  </th>
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-wider text-amber-650 bg-amber-50/15 border-r border-indigo-50 min-w-[55px]">
                    Skipped
                  </th>
                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-50/30 border-r border-indigo-50 min-w-[55px]">
                    Pending
                  </th>

                  <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-405 min-w-[150px]">
                    Analysis & Streaks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50/50">
                {filteredTasks.map((task) => {
                  const stats = task.id ? calculateTaskStats(task.id) : { completed: 0, missed: 0, skipped: 0, completionRate: 0, currentStreak: 0, longestStreak: 0 };
                  const isMarked = !!task.marked;

                  return (
                    <tr 
                      key={task.id} 
                      className={`hover:bg-indigo-50/20 transition-all ${
                        isMarked ? 'bg-[#FDFEFE] border-l-4 border-l-amber-450' : ''
                      }`}
                    >
                      {/* Name Row with Toggle star/mark option */}
                      <td className="p-4 pl-6 border-r border-indigo-50">
                        <div className="flex items-start gap-2.5">
                          {/* Row marker button - Mark / Unmark habit */}
                          <button
                            onClick={() => toggleRowMarked(task)}
                            className={`p-1 rounded-lg transition-all ${
                              isMarked 
                                ? 'text-amber-500 hover:bg-amber-50 bg-amber-50/50' 
                                : 'text-slate-350 hover:text-slate-500 hover:bg-slate-50'
                            }`}
                            title={isMarked ? "Unmark priority habit row" : "Mark row prioritize"}
                          >
                            <Star className="h-4.5 w-4.5" fill={isMarked ? "currentColor" : "none"} />
                          </button>
                          
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-slate-800 text-sm truncate" title={task.title}>
                              {task.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                                {task.repeatPattern}
                              </span>
                              <span className="text-[10px] text-slate-400 capitalize hidden sm:inline">
                                • {task.category}
                              </span>
                              {isMarked && (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">
                                  ★ MARKED
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Display Days cells */}
                      {displayDays.map((day, dIdx) => {
                        const dateStr = getLocalDateString(day);
                        const existingOcc = occurrences.find(o => o.taskId === task.id && o.scheduledDate === dateStr);
                        const status = existingOcc ? existingOcc.status : 'pending';
                        const details = getStatusDetails(status);

                        return (
                          <td 
                            key={dIdx} 
                            onClick={() => task.id && handleCellClick(task.id, dateStr)}
                            className="p-3 text-center border-r border-indigo-50 cursor-pointer hover:bg-slate-50/65 group pr cell-focus"
                          >
                            <div className="flex justify-center">
                              <div 
                                className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-xs transition-transform duration-250 group-hover:scale-110 relative ${details.bg}`}
                                title={`${task.title} [${dateStr}]: ${details.label}`}
                              >
                                {details.icon}
                                {existingOcc?.notes && (
                                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-600 border-2 border-white rounded-full" title="Contains Occurrence Notes" />
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}

                      {/* Period totals cells */}
                      {(() => {
                        const visibleTotals = task.id ? getRowPeriodTotals(task.id, displayDays) : { done: 0, missed: 0, skipped: 0, pending: 0 };
                        return (
                          <>
                            <td className="p-3 text-center font-mono text-xs font-extrabold text-emerald-600 bg-emerald-55/10 border-r border-indigo-50/70" title={`${task.title} Total Done in current display range`}>
                              {visibleTotals.done}
                            </td>
                            <td className="p-3 text-center font-mono text-xs font-extrabold text-rose-600 bg-rose-55/10 border-r border-indigo-50/70" title={`${task.title} Total Missed in current display range`}>
                              {visibleTotals.missed}
                            </td>
                            <td className="p-3 text-center font-mono text-xs font-extrabold text-amber-650 bg-amber-55/10 border-r border-indigo-50/70" title={`${task.title} Total Skipped in current display range`}>
                              {visibleTotals.skipped}
                            </td>
                            <td className="p-3 text-center font-mono text-xs font-extrabold text-slate-500 bg-slate-55/15 border-r border-indigo-50/70" title={`${task.title} Total Pending/Untracked in current display range`}>
                              {visibleTotals.pending}
                            </td>
                          </>
                        );
                      })()}

                      {/* End metrics analysis columns */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-4">
                          <div className="text-center" title="Current streak completed days">
                            <div className="text-xs font-black font-mono text-indigo-650 flex items-center justify-center gap-0.5">
                              🔥 <span>{stats.currentStreak}d</span>
                            </div>
                            <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest pl-1">Streak</span>
                          </div>

                          <div className="text-center" title="Longest continuous streak recorded">
                            <div className="text-xs font-black font-mono text-slate-700 flex items-center justify-center gap-0.5">
                              🏆 <span>{stats.longestStreak}d</span>
                            </div>
                            <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest">Max</span>
                          </div>

                          <div className="text-center" title="Habit health completion rate">
                            <div className="text-xs font-black font-mono text-emerald-650">
                              {stats.completionRate}%
                            </div>
                            <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest">Rate</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 text-[11px] text-slate-500 font-medium pl-6 border-t border-indigo-50 flex flex-wrap gap-x-6 gap-y-2 items-center">
            <span>💡 <strong>Click any cell</strong> to set states: completed, missed, skipped or append custom memos/notes!</span>
            <div className="flex items-center gap-3 ml-auto">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Done</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> Missed</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400" /> Skipped</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-350" /> Pending</span>
            </div>
          </div>

        </div>
      )}

      {/* Dynamic Popups for Editing Occurrence status/notes */}
      <AnimatePresence>
        {selectedCell && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 font-display flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-indigo-650" />
                  Edit Habit Occurrence
                </h4>
                <span className="text-[10px] font-black text-indigo-650 font-mono bg-indigo-50/70 py-1 px-2 rounded-md">
                  {selectedCell.dateStr}
                </span>
              </div>

              <div className="p-6 space-y-5">
                
                {/* Status Options */}
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Update Health Status
                  </label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { status: 'completed' as const, label: 'Completed (Done)', colorClass: 'border-emerald-250 text-emerald-700 bg-emerald-50/40' },
                      { status: 'missed' as const, label: 'Missed (Failed)', colorClass: 'border-rose-250 text-rose-700 bg-rose-50/40' },
                      { status: 'skipped' as const, label: 'Skipped Habit', colorClass: 'border-amber-250 text-amber-700 bg-amber-50/40' },
                      { status: 'pending' as const, label: 'Pending Status', colorClass: 'border-slate-200 text-slate-500 bg-slate-50/55' }
                    ].map((opt) => {
                      const isActive = cellStatus === opt.status;
                      return (
                        <button
                          key={opt.status}
                          onClick={() => setCellStatus(opt.status)}
                          className={`p-3 text-xs font-bold rounded-xl border transition-all text-left flex flex-col gap-1 ${
                            isActive
                              ? `ring-2 ring-indigo-500 border-indigo-500 ${opt.colorClass}`
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* notes entry */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Notes / Memo Updates
                  </label>
                  <textarea
                    value={cellNotes}
                    onChange={(e) => setCellNotes(e.target.value)}
                    placeholder="e.g. Did 35 minutes today feel very comfortable..."
                    rows={3}
                    maxLength={200}
                    className="w-full text-slate-950 px-3.5 py-2.5 bg-slate-50 text-xs border border-slate-200 rounded-xl outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveOccurrence}
                    className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 font-bold text-white text-xs rounded-xl shadow-md transition"
                  >
                    Save Changes
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
