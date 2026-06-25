import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType, getLocalDateString } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { 
  LogOut, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  Circle, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  PiggyBank,
  MessageSquare, 
  Clock, 
  Sparkles, 
  BellRing, 
  HelpCircle,
  Calendar,
  Layers,
  Inbox,
  CheckSquare,
  BarChart2,
  Bookmark,
  ChevronRight,
  Activity,
  ClipboardList,
  Menu,
  X
} from 'lucide-react';
import { Task, TaskCategory, TaskPriority, TaskStatus } from '../types';
import TaskForm from './TaskForm';
import Feedback from './Feedback';
import Analytics from './Analytics';
import ProgressMatrix from './ProgressMatrix';
import RecordsModule from './RecordsModule';
import FinanceTracker from './FinanceTracker';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  onSignOut: () => void;
}

export default function Dashboard({ onSignOut }: DashboardProps) {
  // Authentication currentUser
  const user = auth.currentUser;

  // Real-time task syncing
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Display views states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  
  // Tab/Selection scopes: 'all' (Inbox), 'today' (Today's due date), 'important' (High Priority), 'completed', 'progress', 'analytics', 'records', 'finance'
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'important' | 'completed' | 'progress' | 'analytics' | 'records' | 'finance'>('all');

  // Search & Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | 'All'>('All');
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | 'All'>('All');

  // Interactive local notification triggers
  const [notifications, setNotifications] = useState<{ id: string; message: string }[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch / Sync tasks from Firestore in real-time
  useEffect(() => {
    if (!user) return;

    // Secure Firestore query constrained by owner userId
    const q = query(
      collection(db, 'tasks'), 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList: Task[] = [];
      snapshot.forEach((docSnap) => {
        taskList.push({ id: docSnap.id, ...docSnap.data() } as Task);
      });
      // Sort tasks primarily by due date, then newest first
      taskList.sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
      setTasks(taskList);
      setLoading(false);
    }, (error) => {
      console.error("Firestore sync error: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Hook to simulate local reminder triggers
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHours}:${currentMinutes}`;

      tasks.forEach((task) => {
        if (task.status === 'pending' && task.reminderTime === currentTime) {
          // Check if this notification is already triggered
          const notKey = `${task.id}-${currentTime}`;
          if (!notifications.some((n) => n.id === notKey)) {
            setNotifications((prev) => [
              ...prev,
              { 
                id: notKey, 
                message: `⏰ Reminder Constraint: "${task.title}" is scheduled for alert action now!` 
              }
            ]);
            // Clear message after 10 seconds
            setTimeout(() => {
              setNotifications((prev) => prev.filter((n) => n.id !== notKey));
            }, 10000);
          }
        }
      });
    };

    // Run review check every 15 seconds
    const interval = setInterval(checkReminders, 15000);
    return () => clearInterval(interval);
  }, [tasks, notifications]);

  // Log Out request
  const handleLogout = async () => {
    try {
      await auth.signOut();
      onSignOut();
    } catch (error) {
      console.error("Logout execution fault:", error);
    }
  };

  // Add or Edit Task Firestore Submission
  const handleFormSubmit = async (taskData: Omit<Task, 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;

    // Fast-feedback UX: close the modal window instantly so it doesn't hang in offline sandboxed environments
    setIsFormOpen(false);
    setEditingTask(null);

    try {
      if (editingTask && editingTask.id) {
        // Edit Operation
        const taskRef = doc(db, 'tasks', editingTask.id);
        try {
          await updateDoc(taskRef, {
            ...taskData,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `tasks/${editingTask.id}`);
        }
      } else {
        // Create Operation
        try {
          await addDoc(collection(db, 'tasks'), {
            ...taskData,
            userId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'tasks');
        }
      }
    } catch (e) {
      console.error("Task manipulation failed: ", e);
      const notKey = `error-manipulate-${Date.now()}`;
      setNotifications((prev) => [
        ...prev,
        { id: notKey, message: '❌ Sync issue: Changes queued in local background cache.' }
      ]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notKey));
      }, 5000);
    }
  };

  // Toggle Task Status (Pending / Completed)
  const handleToggleStatus = async (task: Task) => {
    if (!task.id) return;
    try {
      const taskRef = doc(db, 'tasks', task.id);
      const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
      
      try {
        await updateDoc(taskRef, {
          status: nextStatus,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
      }
    } catch (e) {
      console.error("Error updating status:", e);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!taskId) return;
    try {
      // Execute the delete instantly without blocking native confirm popups which error/fail in cross-origin preview iframes
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
      }
      const notKey = `${taskId}-deleted-${Date.now()}`;
      setNotifications((prev) => [
        ...prev,
        { id: notKey, message: '🗑️ Task deleted from your TRACKSY synchronizer.' }
      ]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notKey));
      }, 5000);
    } catch (e) {
      console.error("Error deleting document:", e);
      const notKey = `error-delete-${Date.now()}`;
      setNotifications((prev) => [
        ...prev,
        { id: notKey, message: '❌ Error: Failed to delete your selected task.' }
      ]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notKey));
      }, 5000);
    }
  };

  // Calculations for Widgets
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
  const pendingTasksCount = totalTasksCount - completedTasksCount;
  const dailyGoalPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Up Next calculations
  const todayStr = getLocalDateString();
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  // Find upNext: prioritize high-priority, or closest due date, or first pending
  const upNextTask = pendingTasks.find(t => t.priority === 'high') || pendingTasks[0] || null;

  // Activity Stats counts by Categories representation for Live Visualization (no mock data!)
  const categoriesList: { name: TaskCategory; color: string; hoverColor: string }[] = [
    { name: 'Personal', color: 'bg-rose-400', hoverColor: 'hover:text-rose-500' },
    { name: 'Work', color: 'bg-amber-400', hoverColor: 'hover:text-amber-500' },
    { name: 'Health', color: 'bg-emerald-400', hoverColor: 'hover:text-emerald-500' },
    { name: 'Shopping', color: 'bg-sky-450', hoverColor: 'hover:text-sky-500' },
    { name: 'Fitness', color: 'bg-indigo-400', hoverColor: 'hover:text-indigo-500' },
    { name: 'Ideas', color: 'bg-violet-400', hoverColor: 'hover:text-violet-500' },
    { name: 'Other', color: 'bg-slate-400', hoverColor: 'hover:text-slate-500' }
  ];

  const categoryCounts = categoriesList.map((cat) => {
    const totalCount = tasks.filter(t => t.category === cat.name).length;
    const completedCount = tasks.filter(t => t.category === cat.name && t.status === 'completed').length;
    return {
      name: cat.name,
      total: totalCount,
      completed: completedCount,
      percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    };
  });

  const maxTotalCount = Math.max(...categoryCounts.map(c => c.total), 1);

  // Client-side filtering logic
  const filteredTasks = tasks.filter((task) => {
    // 1. Sidebar tab scopes selection
    if (activeTab === 'today') {
      if (task.dueDate && task.dueDate !== todayStr) return false;
      if (task.status === 'completed') return false; // today's pending tasks primarily
    }
    if (activeTab === 'important') {
      if (task.priority !== 'high' || task.status === 'completed') return false;
    }
    if (activeTab === 'completed') {
      if (task.status !== 'completed') return false;
    }
    if (activeTab === 'all') {
      // Show all on inbox
    }

    // 2. Search parameters
    const searchMatch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        task.description.toLowerCase().includes(searchQuery.toLowerCase());

    // 3. Dropdown tag filter
    const categoryMatch = selectedCategory === 'All' || task.category === selectedCategory;

    // 4. Dropdown alerts prioritization filter
    const priorityMatch = selectedPriority === 'All' || task.priority === selectedPriority;

    return searchMatch && categoryMatch && priorityMatch;
  });

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden bg-[#F0F2FA] text-slate-800 flex flex-col md:flex-row font-sans antialiased">
      
      {/* Dynamic Toast Alerts Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none max-w-sm w-[90%]">
        <AnimatePresence>
          {notifications.map((not) => (
            <motion.div
              key={not.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="bg-slate-950 text-white font-mono text-[11px] font-semibold py-3.5 px-4.5 rounded-2xl border border-indigo-500/20 shadow-2xl pointer-events-auto flex items-center gap-2.5"
            >
              <BellRing className="h-4.5 w-4.5 text-rose-400 shrink-0 animate-bounce" />
              <span>{not.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Mobile sidebar slide-over menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
            />
            {/* Sidebar Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative flex flex-col w-4/5 max-w-xs h-full bg-white border-r border-indigo-100 p-5 shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <div className="w-4 h-1 border border-white rounded-full bg-white/20"></div>
                  </div>
                  <h1 className="text-xl font-black text-indigo-950 tracking-tight font-display">TRACKSY</h1>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
                >
                  <X className="h-4.5 w-4.5 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  {/* Tasks Module */}
                  <p className="px-4 text-[10px] font-black text-indigo-400/80 tracking-widest uppercase mb-2">
                    Tasks Module
                  </p>
                  <div className="space-y-1 mb-5">
                    {[
                      { id: 'all', label: 'Inbox', icon: <Inbox className="h-5 w-5" />, count: pendingTasksCount },
                      { id: 'today', label: 'Today', icon: <Calendar className="h-5 w-5" />, count: tasks.filter(t => t.dueDate === todayStr && t.status === 'pending').length },
                      { id: 'important', label: 'Important', icon: <Bookmark className="h-5 w-5" />, count: tasks.filter(t => t.priority === 'high' && t.status === 'pending').length },
                      { id: 'completed', label: 'Completed', icon: <CheckSquare className="h-5 w-5" />, count: completedTasksCount },
                      { id: 'analytics', label: 'Analytics Dashboard', icon: <BarChart2 className="h-5 w-5" />, count: null }
                    ].map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            setSelectedCategory('All');
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all focus:outline-none ${
                            isActive 
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-150 scale-102 font-extrabold' 
                              : 'text-indigo-400/90 hover:bg-indigo-50/60 hover:text-indigo-750'
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                          {item.count !== null && (
                            <span className={`ml-auto text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isActive ? 'bg-indigo-400 text-white' : 'bg-indigo-50 text-indigo-600'
                            }`}>
                              {item.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Records Module */}
                  <p className="px-4 text-[10px] font-black text-indigo-400/80 tracking-widest uppercase mb-2">
                    Records &amp; Trackers
                  </p>
                  <div className="space-y-1 mb-5">
                    {[
                      { id: 'progress', label: 'Habits Matrix', icon: <Activity className="h-5 w-5" />, count: tasks.filter(t => t.isRecurring).length },
                      { id: 'records', label: 'Smart Trackers', icon: <ClipboardList className="h-5 w-5" />, count: null },
                      { id: 'finance', label: 'Finance Tracker', icon: <PiggyBank className="h-5 w-5" />, count: null }
                    ].map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            setSelectedCategory('All');
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all focus:outline-none ${
                            isActive 
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-150 scale-102 font-extrabold' 
                              : 'text-indigo-400/90 hover:bg-indigo-50/60 hover:text-indigo-750'
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                          {item.count !== null && item.count > 0 && (
                            <span className={`ml-auto text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isActive ? 'bg-indigo-400 text-white' : 'bg-indigo-50 text-indigo-600'
                            }`}>
                              {item.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Categories */}
                  <p className="px-4 text-[10px] font-black text-indigo-400/80 tracking-widest uppercase mb-2">Categories</p>
                  <div className="space-y-1 col-span-1">
                    <div 
                      onClick={() => {
                        setSelectedCategory('All');
                        if (activeTab === 'analytics') setActiveTab('all');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl font-semibold text-xs cursor-pointer transition ${
                        selectedCategory === 'All' 
                          ? 'bg-indigo-50 text-indigo-850 font-bold' 
                          : 'text-slate-600 hover:text-indigo-650 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
                      <span>All Categories</span>
                    </div>
                    {categoriesList.map((cat) => {
                      const isCatActive = selectedCategory === cat.name;
                      return (
                        <div 
                          key={cat.name}
                          onClick={() => {
                            setSelectedCategory(cat.name);
                            if (activeTab === 'analytics') setActiveTab('all');
                            setIsMobileMenuOpen(false);
                          }}
                          className={`flex items-center gap-3 px-4 py-2 rounded-xl font-semibold text-xs cursor-pointer transition ${
                            isCatActive 
                              ? 'bg-indigo-50 text-indigo-850 font-bold' 
                              : 'text-slate-600 hover:text-indigo-650 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`}></div>
                          <span>{cat.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Stats & Logout */}
                <div className="mt-8 pt-4 border-t border-slate-100">
                  <div className="bg-indigo-50/70 rounded-2xl p-4 border border-indigo-100/40 mb-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-bold text-indigo-400 tracking-wider">DAILY PROGRESS</span>
                      <span className="text-[10px] font-black text-indigo-600 font-mono">{dailyGoalPercent}%</span>
                    </div>
                    <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-indigo-100/20">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${dailyGoalPercent}%` }}
                      ></div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full py-2 px-4 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-500 font-bold text-xs text-center border border-slate-100 transition"
                  >
                    Disconnect Sync
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar Navigation (Desktop Only) */}
      <nav className="hidden md:flex md:w-64 bg-white flex-col border-r border-indigo-100 shadow-xl shadow-slate-100/50 shrink-0 h-screen overflow-y-auto animate-fade-in">
        <div className="p-5 md:p-6 flex flex-col h-full min-h-0 justify-between gap-6">
          <div>
            {/* Brand Header */}
            <div className="flex items-center gap-3.5 mb-8 md:mb-10 justify-between md:justify-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                  <div className="w-5 h-1.5 border-2 border-white rounded-full bg-white/20"></div>
                </div>
                <h1 className="text-2xl font-black text-indigo-950 tracking-tight font-display">TRACKSY</h1>
              </div>
              <p className="text-[9px] text-[#A3B2E0] font-bold tracking-widest font-mono uppercase bg-indigo-50 px-2 py-1 rounded-md">
                Sync v1
              </p>
            </div>

            {/* Tasks Module Group Header */}
            <div className="px-4.5 mb-2 mt-2 flex items-center justify-between animate-fade-in">
              <p className="text-[10px] font-black text-indigo-400/80 tracking-widest uppercase">
                Tasks Module
              </p>
            </div>
            <div className="space-y-1.5 mb-5">
              {[
                { id: 'all', label: 'Inbox', icon: <Inbox className="h-5 w-5" />, count: pendingTasksCount },
                { id: 'today', label: 'Today', icon: <Calendar className="h-5 w-5" />, count: tasks.filter(t => t.dueDate === todayStr && t.status === 'pending').length },
                { id: 'important', label: 'Important', icon: <Bookmark className="h-5 w-5" />, count: tasks.filter(t => t.priority === 'high' && t.status === 'pending').length },
                { id: 'completed', label: 'Completed', icon: <CheckSquare className="h-5 w-5" />, count: completedTasksCount },
                { id: 'analytics', label: 'Analytics Dashboard', icon: <BarChart2 className="h-5 w-5" />, count: null }
              ].map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      // Clear general category filter to display correctly
                      setSelectedCategory('All');
                    }}
                    className={`w-full flex items-center gap-4 px-4.5 py-2.5 rounded-2xl font-bold text-sm transition-all focus:outline-none ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-150 scale-102 font-extrabold' 
                        : 'text-indigo-400/90 hover:bg-indigo-50/60 hover:text-indigo-750'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    {item.count !== null && (
                      <span className={`ml-auto text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-indigo-400 text-white' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Records Module Group Header */}
            <div className="px-4.5 mb-2 mt-4 flex items-center justify-between">
              <p className="text-[10px] font-black text-indigo-400/80 tracking-widest uppercase">
                Records &amp; Trackers
              </p>
            </div>
            <div className="space-y-1.5 mb-2">
              {[
                { id: 'progress', label: 'Habits Matrix', icon: <Activity className="h-5 w-5" />, count: tasks.filter(t => t.isRecurring).length },
                { id: 'records', label: 'Smart Trackers', icon: <ClipboardList className="h-5 w-5" />, count: null },
                { id: 'finance', label: 'Finance Tracker', icon: <PiggyBank className="h-5 w-5" />, count: null }
              ].map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      // Clear general category filter to display correctly
                      setSelectedCategory('All');
                    }}
                    className={`w-full flex items-center gap-4 px-4.5 py-2.5 rounded-2xl font-bold text-sm transition-all focus:outline-none ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-150 scale-102 font-extrabold' 
                        : 'text-indigo-400/90 hover:bg-indigo-50/60 hover:text-indigo-750'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    {item.count !== null && item.count > 0 && (
                      <span className={`ml-auto text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-indigo-400 text-white' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Interactive Categories filtering directly from sidebar design */}
            <div className="mt-8 md:mt-10 hidden md:block">
              <p className="px-4.5 text-xs font-bold text-indigo-300 uppercase tracking-widest mb-4">Categories</p>
              <div className="space-y-1">
                <div 
                  onClick={() => {
                    setSelectedCategory('All');
                    if (activeTab === 'analytics') setActiveTab('all');
                  }}
                  className={`flex items-center gap-3 px-4.5 py-2.5 rounded-xl font-semibold text-xs cursor-pointer transition ${
                    selectedCategory === 'All' 
                      ? 'bg-indigo-50 text-indigo-850 font-bold' 
                      : 'text-slate-600 hover:text-indigo-650 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
                  <span>All Categories</span>
                </div>
                {categoriesList.map((cat) => {
                  const isCatActive = selectedCategory === cat.name;
                  return (
                    <div 
                      key={cat.name}
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        if (activeTab === 'analytics') setActiveTab('all');
                      }}
                      className={`flex items-center gap-3 px-4.5 py-2.5 rounded-xl font-semibold text-xs cursor-pointer transition ${
                        isCatActive 
                          ? 'bg-indigo-50 text-indigo-850 font-bold' 
                          : 'text-slate-600 hover:text-indigo-650 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`}></div>
                      <span>{cat.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Daily Goal Progress Matcher */}
          <div className="mt-8 md:mt-auto pt-6 border-t border-slate-100">
            <div className="bg-indigo-50/70 rounded-3xl p-5 border border-indigo-100/40">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-xs font-bold text-indigo-400 tracking-wider">DAILY COMPLETED</span>
                <span className="text-xs font-black text-indigo-600 font-mono">{dailyGoalPercent}%</span>
              </div>
              <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-indigo-100/20">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${dailyGoalPercent}%` }}
                ></div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between text-[11px] text-[#A0AEC0] px-1 font-semibold">
              <span>Verified session</span>
              <button
                onClick={handleLogout}
                className="text-indigo-500 hover:text-indigo-700 font-bold hover:underline transition"
              >
                Disconnect Sync
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        
        {/* Main Content Header */}
        <header className="h-auto md:h-20 px-5 md:px-8 py-4 md:py-0 flex flex-col md:flex-row md:items-center justify-between border-b border-indigo-50/50 bg-white/45 backdrop-blur-md shrink-0">
          <div className="mb-4 md:mb-0 flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-750 border border-indigo-100 transition shrink-0"
              aria-label="Toggle Navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight font-display leading-tight">
                Good day, {user?.displayName?.split(' ')[0] || 'User Profile'}!
              </h2>
              <p className="text-slate-500 font-medium text-xs md:text-sm mt-0.5">
                You have <span className="text-indigo-600 font-bold">{pendingTasksCount} tasks</span> pending in your manager schema.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-between md:justify-end">
            {/* Quick Submit Feedback Button */}
            <button
              onClick={() => setIsFeedbackOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-indigo-150 text-indigo-600 rounded-xl text-xs font-bold transition hover:bg-indigo-50 hover:shadow-xs active:scale-98"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Feedback Console</span>
            </button>

            {/* Notification and avatar element */}
            <div className="flex items-center gap-3">
              <div className="relative cursor-pointer" onClick={() => {
                if (pendingTasksCount > 0) {
                  alert(`Pending alerts: You have ${pendingTasksCount} tasks marked pending.`);
                } else {
                  alert('All clear! Beautiful layout has no outstanding task due.');
                }
              }}>
                {pendingTasksCount > 0 && (
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-rose-500 border-2 border-white rounded-full animate-ping"></div>
                )}
                <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center border border-indigo-50 shadow-xs hover:border-indigo-300 transition">
                  <span className="text-lg">🔔</span>
                </div>
              </div>

              {/* Dynamic colorful initials avatar block */}
              <div className="w-11 h-11 bg-gradient-to-tr from-indigo-500 to-rose-450 rounded-2xl flex items-center justify-center border border-white shadow-md text-white font-black text-sm">
                {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : user?.email?.slice(0, 2).toUpperCase() || 'TD'}
              </div>
            </div>
          </div>
        </header>

        {/* Content Container Body */}
        <div className="flex-1 p-4 md:p-6 md:p-8 overflow-y-auto w-full max-w-full">
          
          {/* Modal Overlay Components */}
          {isFeedbackOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
              <Feedback onClose={() => setIsFeedbackOpen(false)} />
            </div>
          )}

          {isFormOpen && (
            <TaskForm 
              task={editingTask}
              onClose={() => {
                setIsFormOpen(false);
                setEditingTask(null);
              }}
              onSubmit={handleFormSubmit}
            />
          )}

          {activeTab === 'analytics' ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Analytics tasks={tasks} />
            </motion.div>
          ) : activeTab === 'progress' ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <ProgressMatrix tasks={tasks} onEditTask={(t) => { setEditingTask(t); setIsFormOpen(true); }} />
            </motion.div>
          ) : activeTab === 'records' ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <RecordsModule />
            </motion.div>
          ) : activeTab === 'finance' ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <FinanceTracker />
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 items-start">
              
              {/* Left Column: Task Creator & List Sheet (Col span 8) */}
              <div className="col-span-1 lg:col-span-8 flex flex-col gap-4 md:gap-5">

                {/* Main Task Creator Box matching the top rounded input box of Design template */}
                <div className="bg-white rounded-3xl shadow-sm border border-indigo-50/60 p-5 md:p-6">
                  <div className="flex flex-col sm:flex-row gap-4 mb-3">
                    <input 
                      type="text" 
                      placeholder="Write your next task title here..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-800 font-semibold placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-100/70"
                    />
                    <button 
                      onClick={() => {
                        setEditingTask(null);
                        setIsFormOpen(true);
                      }}
                      className="bg-indigo-600 text-white px-8 py-4 sm:py-0 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:scale-102 hover:bg-indigo-700 active:scale-95 transition-all text-xs"
                    >
                      Compose Task Sheet
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-2">
                    💡 <span className="font-semibold text-slate-500">Quick tip:</span> Typing in the bar filters your tasks list below in real-time. Click <strong>Compose Task Sheet</strong> to access descriptions, alerts, due dates, and recurrence rules.
                  </p>
                </div>

                {/* Filter and control sub-selectors list */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white/60 p-4 rounded-2xl border border-indigo-50/50">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span className="text-[10px] font-bold text-indigo-650 uppercase">Filter tag</span>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value as any)}
                      className="bg-white text-xs px-2.5 py-1.5 border border-indigo-100 rounded-xl outline-none text-slate-700 font-bold"
                    >
                      <option value="All">All Categories</option>
                      <option value="Work">Work</option>
                      <option value="Personal">Personal</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Health">Health</option>
                      <option value="Fitness">Fitness</option>
                      <option value="Ideas">Ideas</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Filter className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span className="text-[10px] font-bold text-indigo-650 uppercase">Alert urgency</span>
                    <select
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value as any)}
                      className="bg-white text-xs px-2.5 py-1.5 border border-indigo-100 rounded-xl outline-none text-slate-700 font-bold"
                    >
                      <option value="All">All Priorities</option>
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>
                </div>

                {/* Active and filtered tasks schedule */}
                {loading ? (
                  <div className="flex flex-col justify-center items-center py-20 bg-white rounded-3xl border border-indigo-50">
                    <Clock className="h-8 w-8 animate-spin text-indigo-650 mb-3" />
                    <p className="text-xs font-semibold text-slate-450">Synchronizing database indices...</p>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="bg-white border border-indigo-100/50 rounded-3xl py-12 px-6 text-center shadow-xs">
                    <HelpCircle className="h-12 w-12 text-indigo-300 mx-auto mb-4" />
                    <h4 className="text-base font-bold text-indigo-950 font-display">No tasks matching queries</h4>
                    <p className="text-xs text-slate-450 mt-1 max-w-sm mx-auto">
                      {searchQuery || selectedCategory !== 'All' || selectedPriority !== 'All'
                        ? "We couldn't locate any task matches for those filter parameters. Try expanding your search queries."
                        : "Welcome to your synchronized dashboard! Tap Compose above to map out your tasks."}
                    </p>
                    {(searchQuery || selectedCategory !== 'All' || selectedPriority !== 'All') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory('All');
                          setSelectedPriority('All');
                        }}
                        className="mt-5 px-4 py-2 text-xs font-extrabold text-white bg-indigo-600 rounded-xl transition shadow-md shadow-indigo-100"
                      >
                        Reset Search Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {filteredTasks.map((task) => {
                      const isCompleted = task.status === 'completed';
                      const badgeDetails = {
                        low: { color: 'bg-emerald-50 text-emerald-800 border-emerald-100', dot: 'bg-emerald-400' },
                        medium: { color: 'bg-amber-50 text-amber-800 border-amber-100', dot: 'bg-amber-400' },
                        high: { color: 'bg-rose-50 text-rose-800 border-rose-100', dot: 'bg-rose-500' }
                      }[task.priority];

                      return (
                        <div
                          key={task.id}
                          className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border rounded-2xl hover:border-indigo-200 hover:shadow-lg transition-all duration-300 gap-4 ${
                            isCompleted ? 'border-indigo-50/50 opacity-60 bg-slate-50/30' : 'border-indigo-100/70'
                          }`}
                        >
                          {/* Inner task profile */}
                          <div className="flex items-start flex-1 min-w-0">
                            {/* Toggle checkbox custom */}
                            <button
                              onClick={() => handleToggleStatus(task)}
                              className="mt-1 mr-4 text-slate-300 hover:text-indigo-600 transition"
                            >
                              {isCompleted ? (
                                <div className="w-6 h-6 bg-emerald-500 hover:bg-emerald-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md shadow-emerald-100">
                                  ✓
                                </div>
                              ) : (
                                <div className={`w-6 h-6 border-2 rounded-lg flex items-center justify-center hover:border-indigo-500 transition ${
                                  task.priority === 'high' ? 'border-rose-300' : 'border-indigo-200'
                                }`}>
                                  {task.priority === 'high' && <div className="w-2.5 h-2.5 bg-rose-500 rounded-full" />}
                                </div>
                              )}
                            </button>

                            <div className="min-w-0">
                              <p className={`font-bold text-slate-800 text-sm ${isCompleted ? 'line-through text-slate-450' : ''}`}>
                                {task.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                {/* Category tag */}
                                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100/30">
                                  {task.category}
                                </span>

                                {/* Priority Badge details */}
                                {task.priority && (
                                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 ${badgeDetails?.color}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${badgeDetails?.dot}`} />
                                    {task.priority}
                                  </span>
                                )}

                                {/* Due Date Alert info */}
                                {task.dueDate && (
                                  <span className="text-[10px] font-medium text-slate-400 font-mono flex items-center gap-1">
                                    📅 Due: {task.dueDate}
                                  </span>
                                )}

                                {/* Recurrence pattern check */}
                                {task.isRecurring && (
                                  <span className="text-[9px] font-extrabold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-md">
                                    ♻ {task.repeatPattern === 'custom' && task.customActiveDays && task.customActiveDays.length > 0 
                                        ? `Custom: ${task.customActiveDays.join(', ')}`
                                        : task.repeatPattern}
                                  </span>
                                )}

                                {/* Reminder spec */}
                                {task.reminderTime && (
                                  <span className="text-[10px] font-bold text-indigo-600 font-mono bg-indigo-50/50 px-1.5 py-0.5 rounded-md">
                                    ⏰ {task.reminderTime}
                                  </span>
                                )}
                              </div>

                              {task.description && (
                                <p className="text-xs text-slate-500 mt-2 line-clamp-2 max-w-xl leading-relaxed">
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action Options */}
                          <div className="flex items-center gap-1 justify-end shrink-0 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingTask(task);
                                setIsFormOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                              title="Edit parameters"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => task.id && handleDeleteTask(task.id)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                              title="Delete task from database"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* Right Column: Up Next Banner & Activity Stats (Col span 4) */}
              <div className="col-span-1 lg:col-span-4 flex flex-col gap-4 md:gap-5 w-full">
                
                {/* Up Next Widget Card from design theme */}
                <div className="bg-gradient-to-br from-indigo-650 to-indigo-800 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200/40 relative overflow-hidden shrink-0">
                  <div className="relative z-10">
                    <p className="text-indigo-200 font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-rose-300 animate-pulse" /> UP NEXT FOR REVIEW
                    </p>
                    
                    {upNextTask ? (
                      <div>
                        <h3 className="text-2xl font-black font-display tracking-tight leading-tight mb-4">
                          {upNextTask.title}
                        </h3>
                        
                        <div className="space-y-2 mb-6">
                          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl py-2 px-4 w-max text-xs font-semibold font-mono">
                            <span>🕒 {upNextTask.reminderTime || 'No alarm set'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-indigo-100 font-semibold pl-1">
                            <span>Category: {upNextTask.category}</span>
                            {upNextTask.dueDate && (
                              <>
                                <span>•</span>
                                <span>Due: {upNextTask.dueDate}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <button 
                          onClick={() => handleToggleStatus(upNextTask)}
                          className="w-full bg-white text-indigo-600 hover:bg-indigo-50 font-black py-3.5 rounded-2xl text-xs transition duration-300 shadow-md active:scale-95 text-center"
                        >
                          Mark Task Done
                        </button>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-2xl font-black font-display tracking-tight mb-4">
                          All tasks cleared!
                        </h3>
                        <p className="text-xs text-indigo-200 leading-relaxed mb-6">
                          You have no pending tasks. Great job on managing your time database dynamically!
                        </p>
                        <button 
                          onClick={() => {
                            setEditingTask(null);
                            setIsFormOpen(true);
                          }}
                          className="w-full bg-white text-indigo-600 hover:bg-indigo-50 font-black py-3.5 rounded-2xl text-xs transition duration-300 shadow-md active:scale-95 text-center"
                        >
                          Draft New Task
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Visual gradient graphic circles */}
                  <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-500 rounded-full blur-3xl opacity-40"></div>
                  <div className="absolute top-0 right-0 p-4 text-5xl opacity-15 select-none pointer-events-none">⚡</div>
                </div>

                {/* Live Activity Category distribution graph widget */}
                <div className="bg-white rounded-3xl p-5 border border-indigo-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="font-black text-slate-800 text-sm tracking-tight mb-1 font-display">Activity Distributions</h4>
                    <p className="text-[10px] text-slate-400 mb-4 font-medium uppercase tracking-wider">Indexed sheets representation</p>
                    
                    <div className="flex items-end gap-3 h-32 px-1.5 pt-2">
                      {categoryCounts.map((cat, idx) => {
                        // Calculate relative height out of maxTotalCount (minimum baseline 12%)
                        const barHeightPercentage = Math.max((cat.total / maxTotalCount) * 100, 12);
                        const isPrimary = cat.total === Math.max(...categoryCounts.map(c => c.total)) && cat.total > 0;
                        return (
                          <div key={cat.name} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group/bar relative">
                            {/* Hover Tooltip counts */}
                            <div className="absolute -top-10 bg-slate-900 text-white text-[10px] font-mono font-bold py-1 px-2 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all pointer-events-none shadow-md z-20 whitespace-nowrap">
                              {cat.completed}/{cat.total} done ({cat.percentage}%)
                            </div>

                            <div 
                              className={`w-full rounded-t-xl transition-all duration-500 cursor-help ${
                                isPrimary 
                                  ? 'bg-indigo-600 shadow-lg shadow-indigo-100' 
                                  : 'bg-indigo-100 hover:bg-indigo-200'
                              }`}
                              style={{ height: `${barHeightPercentage}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between mt-3 px-1 text-[8.5px] font-black text-slate-400 tracking-wider font-mono">
                      {categoryCounts.map(c => (
                        <span key={c.name} className="w-1/7 text-center truncate px-0.5" title={c.name}>
                          {c.name.slice(0, 3).toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 mt-5 pt-3.5 border-t border-slate-100 italic">
                    Calculated over real-time synchronized cloud data.
                  </p>
                </div>

              </div>
              
            </div>
          )}

        </div>

      </main>
    </div>
  );
}
