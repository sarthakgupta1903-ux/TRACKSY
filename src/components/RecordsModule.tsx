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
  doc,
  setDoc
} from 'firebase/firestore';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Calendar,
  MessageSquare,
  FileText,
  Activity,
  Award,
  TrendingUp,
  Sparkles,
  Clock,
  Filter,
  Check,
  X,
  Minus,
  Plus,
  Trash2,
  ListFilter,
  Search,
  BookOpen,
  Layout,
  PlusCircle,
  Truck,
  UserCheck,
  Wrench,
  HelpCircle,
  TrendingDown,
  Sliders
} from 'lucide-react';
import { RecordTracker, RecordLog, RecordTemplateType } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface RecordsModuleProps {
  onToggleForm?: () => void;
}

export default function RecordsModule({}: RecordsModuleProps) {
  const user = auth.currentUser;
  const [trackers, setTrackers] = useState<RecordTracker[]>([]);
  const [logs, setLogs] = useState<RecordLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state for dynamic tab selection of template templates
  const [selectedTemplateFilter, setSelectedTemplateFilter] = useState<'all' | RecordTemplateType>('all');
  const [trackerSearchQuery, setTrackerSearchQuery] = useState('');
  const [trackerMarkFilter, setTrackerMarkFilter] = useState<'all' | 'marked' | 'unmarked'>('all');

  // Slider controls for the dynamic 7-day display matrix
  const [startDateOffset, setStartDateOffset] = useState<number>(-4); // relative to today

  // Creation State Controls
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTemplateType, setNewTemplateType] = useState<RecordTemplateType>('habit');
  const [newUnit, setNewUnit] = useState('times');
  const [newDefaultValue, setNewDefaultValue] = useState<string>('Done');
  const [newRecurrencePerDay, setNewRecurrencePerDay] = useState<number>(1);
  const [newActiveDays, setNewActiveDays] = useState<string[]>(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

  // Tracker Settings Edit Controls
  const [editingTracker, setEditingTracker] = useState<RecordTracker | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editDefaultValue, setEditDefaultValue] = useState('');
  const [editRecurrencePerDay, setEditRecurrencePerDay] = useState<number>(1);
  const [editActiveDays, setEditActiveDays] = useState<string[]>([]);

  // Occurrence Log Editor state (with recurrence slotIndex)
  const [selectedCell, setSelectedCell] = useState<{ trackerId: string; dateStr: string; slotIndex: number } | null>(null);
  const [cellStatus, setCellStatus] = useState('Done');
  const [cellQuantity, setCellQuantity] = useState(1);
  const [cellNotes, setCellNotes] = useState('');

  // Active service history tracker selection
  const [activeHistoryTrackerId, setActiveHistoryTrackerId] = useState<string | null>(null);

  // Active Report Tab view control
  const [activeReportTrackerId, setActiveReportTrackerId] = useState<string | null>(null);

  // Prepopulate form configuration based on user selected template draft
  const handleTemplatePreselect = (type: RecordTemplateType) => {
    setNewTemplateType(type);
    switch (type) {
      case 'habit':
        setNewTitle('Yoga Progress');
        setNewDescription('Daily dynamic yoga routine log & streak accountability tracker');
        setNewUnit('times');
        setNewDefaultValue('Done');
        break;
      case 'delivery':
        setNewTitle('A2 Cow Milk delivery');
        setNewDescription('Sarthak subscription delivery quantity tracking & accounts checkout');
        setNewUnit('packets');
        setNewDefaultValue('Delivered');
        break;
      case 'attendance':
        setNewTitle('Project Daily Scrum Attendance');
        setNewDescription('Student presence & sprint accountability monitoring template');
        setNewUnit('attendance');
        setNewDefaultValue('Present');
        break;
      case 'maintenance':
        setNewTitle('Server Backups Checkup');
        setNewDescription('Cloud cluster status, periodic inspections & maintenance safety records');
        setNewUnit('checks');
        setNewDefaultValue('Inspected');
        break;
      case 'custom':
        setNewTitle('Custom Log Sheet');
        setNewDescription('Configure and customize your specialized checklist log');
        setNewUnit('logs');
        setNewDefaultValue('Completed');
        break;
    }
  };

  // Hydrate initial data via Firestore Streams
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Stream Trackers
    const trackersQuery = query(
      collection(db, 'recordTrackers'),
      where('userId', '==', user.uid)
    );

    const unsubTrackers = onSnapshot(trackersQuery, (snap) => {
      const list: RecordTracker[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as RecordTracker);
      });
      setTrackers(list);

      // Auto-select first tracker for history & records if none set
      if (list.length > 0) {
        setActiveHistoryTrackerId((prev) => prev || list[0].id || null);
        setActiveReportTrackerId((prev) => prev || list[0].id || null);
      }
    });

    // Stream logs
    const logsQuery = query(
      collection(db, 'recordLogs'),
      where('userId', '==', user.uid)
    );

    const unsubLogs = onSnapshot(logsQuery, (snap) => {
      const list: RecordLog[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as RecordLog);
      });
      setLogs(list);
      setLoading(false);
    });

    return () => {
      unsubTrackers();
      unsubLogs();
    };
  }, [user]);

  // Handle addition of a new Tracker
  const handleAddTracker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;

    // Capture state values before resetting them for responsive closing
    const titleVal = newTitle.trim();
    const descriptionVal = newDescription.trim();
    const templateTypeVal = newTemplateType;
    const unitVal = newUnit;
    const defaultValueVal = newDefaultValue;
    const recurrencePerDayVal = newRecurrencePerDay;
    const activeDaysVal = [...newActiveDays];

    // Instantly close modal and reset fields for optimized optimistic UX
    setIsCreateOpen(false);
    setNewTitle('');
    setNewDescription('');
    setNewRecurrencePerDay(1);
    setNewActiveDays(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

    try {
      const trackersCol = collection(db, 'recordTrackers');
      let docRef;
      try {
        docRef = await addDoc(trackersCol, {
          userId: user.uid,
          title: titleVal,
          description: descriptionVal,
          templateType: templateTypeVal,
          unit: unitVal,
          defaultValue: defaultValueVal,
          marked: false,
          recurrencePerDay: recurrencePerDayVal,
          activeDays: activeDaysVal,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'recordTrackers');
        return;
      }

      // Quick automatic first log generation for today to set start milestone for all slots
      const todayString = getLocalDateString();
      const logsCol = collection(db, 'recordLogs');

      for (let s = 0; s < recurrencePerDayVal; s++) {
        const customLogId = `${user.uid}_${docRef.id}_${todayString}_${s}`;
        try {
          await setDoc(doc(logsCol, customLogId), {
            userId: user.uid,
            trackerId: docRef.id,
            date: todayString,
            status: defaultValueVal,
            quantity: templateTypeVal === 'delivery' ? 1 : 0,
            notes: s === 0 ? 'Logs activated successfully' : `Slot ${s + 1} activated`,
            updatedAt: new Date().toISOString(),
            slotIndex: s
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `recordLogs/${customLogId}`);
        }
      }
    } catch (err) {
      console.error("Error creating tracker entry:", err);
    }
  };

  // Open settings editor for existing tracker
  const handleOpenEditTracker = (tracker: RecordTracker) => {
    setEditingTracker(tracker);
    setEditTitle(tracker.title);
    setEditDescription(tracker.description);
    setEditUnit(tracker.unit || 'packets');
    setEditDefaultValue(String(tracker.defaultValue || 'Delivered'));
    setEditRecurrencePerDay(tracker.recurrencePerDay || 1);
    setEditActiveDays(tracker.activeDays || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  };

  // Save changes to tracker settings
  const handleSaveTrackerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTracker || !editingTracker.id) return;

    const trackerId = editingTracker.id;
    const titleVal = editTitle;
    const descriptionVal = editDescription;
    const unitVal = editUnit;
    const defaultValueVal = editDefaultValue;
    const recurrencePerDayVal = editRecurrencePerDay;
    const activeDaysVal = [...editActiveDays];

    // Instantly close the edit tracker configuration modal
    setEditingTracker(null);

    try {
      const dRef = doc(db, 'recordTrackers', trackerId);
      await updateDoc(dRef, {
        title: titleVal,
        description: descriptionVal,
        unit: unitVal,
        defaultValue: defaultValueVal,
        recurrencePerDay: recurrencePerDayVal,
        activeDays: activeDaysVal,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `recordTrackers/${trackerId}`);
    }
  };

  // Toggle rows prioritization ('marked' state requested by the user!)
  const toggleTrackerMarked = async (tracker: RecordTracker) => {
    if (!tracker.id) return;
    try {
      const dRef = doc(db, 'recordTrackers', tracker.id);
      await updateDoc(dRef, {
        marked: !tracker.marked,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `recordTrackers/${tracker.id}`);
    }
  };

  // Delete tracker
  const handleDeleteTracker = async (trackerId: string) => {
    if (!confirm("Are you sure you want to delete this track sheet? Clean service logs will be permanently deleted too.")) return;
    try {
      await deleteDoc(doc(db, 'recordTrackers', trackerId));
      // reset active displays
      if (activeHistoryTrackerId === trackerId) setActiveHistoryTrackerId(null);
      if (activeReportTrackerId === trackerId) setActiveReportTrackerId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `recordTrackers/${trackerId}`);
    }
  };

  // Date Matrix helpers
  const getDisplayDays = () => {
    const arr = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + startDateOffset + i);
      arr.push(d);
    }
    return arr;
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

  // Filter trackers
  const filteredTrackers = trackers.filter((tr) => {
    const matchesSearch = tr.title.toLowerCase().includes(trackerSearchQuery.toLowerCase()) ||
                          tr.description.toLowerCase().includes(trackerSearchQuery.toLowerCase());
    const matchesTemplate = selectedTemplateFilter === 'all' || tr.templateType === selectedTemplateFilter;
    
    if (trackerMarkFilter === 'marked') {
      return matchesSearch && matchesTemplate && !!tr.marked;
    }
    if (trackerMarkFilter === 'unmarked') {
      return matchesSearch && matchesTemplate && !tr.marked;
    }
    return matchesSearch && matchesTemplate;
  });

  // Handle cell click popup state configuration
  const handleCellClick = (trackerId: string, dateStr: string, slotIndex: number = 0) => {
    const tracker = trackers.find(t => t.id === trackerId);
    if (!tracker) return;

    const existingLog = logs.find(l => 
      l.trackerId === trackerId && 
      l.date === dateStr && 
      (l.slotIndex === slotIndex || (slotIndex === 0 && l.slotIndex === undefined))
    );
    setSelectedCell({ trackerId, dateStr, slotIndex });
    
    setCellStatus(existingLog ? existingLog.status : String(tracker.defaultValue));
    setCellQuantity(existingLog?.quantity || (tracker.templateType === 'delivery' ? 1 : 0));
    setCellNotes(existingLog?.notes || '');
  };

  // Quick increment/decrement of quantities instantly on the table cell!
  const adjustCellQuantityInstant = async (tracker: RecordTracker, dateStr: string, slotIndex: number, delta: number) => {
    if (!user || !tracker.id) return;
    const existingLog = logs.find(l => 
      l.trackerId === tracker.id && 
      l.date === dateStr && 
      (l.slotIndex === slotIndex || (slotIndex === 0 && l.slotIndex === undefined))
    );
    const logsCol = collection(db, 'recordLogs');
    const customLogId = `${user.uid}_${tracker.id}_${dateStr}_${slotIndex}`;

    const oldQty = existingLog?.quantity || 0;
    const newQty = Math.max(0, oldQty + delta);
    const fallbackStatus = existingLog ? existingLog.status : String(tracker.defaultValue);

    try {
      await setDoc(doc(logsCol, customLogId), {
        userId: user.uid,
        trackerId: tracker.id,
        date: dateStr,
        status: newQty > 0 && tracker.templateType === 'delivery' ? 'Delivered' : fallbackStatus,
        quantity: newQty,
        notes: existingLog?.notes || 'Quick quantity updated',
        updatedAt: new Date().toISOString(),
        slotIndex
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `recordLogs/${customLogId}`);
    }
  };

  // Save changes from occurrence editor popup
  const handleSaveOccurrence = async () => {
    if (!user || !selectedCell) return;
    const { trackerId, dateStr, slotIndex } = selectedCell;
    
    // Instantly dismiss modal so interaction feels buttery-smooth first, background async write clears later
    setSelectedCell(null);

    const logsCol = collection(db, 'recordLogs');
    const customLogId = `${user.uid}_${trackerId}_${dateStr}_${slotIndex}`;

    try {
      await setDoc(doc(logsCol, customLogId), {
        userId: user.uid,
        trackerId,
        date: dateStr,
        status: cellStatus,
        quantity: Number(cellQuantity) || 0,
        notes: cellNotes,
        updatedAt: new Date().toISOString(),
        slotIndex
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `recordLogs/${customLogId}`);
    }
  };

  // Compute stats/metrics reports dynamically matching the current selected tracker
  const getReportingDetails = (tracker: RecordTracker) => {
    if (!tracker || !tracker.id) return null;
    const trackerLogs = logs.filter(l => l.trackerId === tracker.id);
    
    const countTotalLogs = trackerLogs.length;
    
    // Status metrics mapping
    const occurrenceMatrix: { [status: string]: number } = {};
    let sumQuantities = 0;

    trackerLogs.forEach((l) => {
      occurrenceMatrix[l.status] = (occurrenceMatrix[l.status] || 0) + 1;
      if (l.quantity) {
        sumQuantities += l.quantity;
      }
    });

    const timelineHistorySorted = [...trackerLogs].sort((a, b) => b.date.localeCompare(a.date));

    return {
      countTotalLogs,
      occurrenceMatrix,
      sumQuantities,
      history: timelineHistorySorted
    };
  };

  // Helper template info mapping
  const getTemplateBadges = (type: RecordTemplateType) => {
    switch (type) {
      case 'habit':
        return {
          label: 'Habit Tracker',
          icon: <Activity className="h-4.5 w-4.5" />,
          colorTheme: 'text-emerald-700 bg-emerald-50 border-emerald-100',
          accentColor: 'text-emerald-500'
        };
      case 'delivery':
        return {
          label: 'Delivery Tracker',
          icon: <Truck className="h-4.5 w-4.5" />,
          colorTheme: 'text-indigo-700 bg-indigo-50 border-indigo-100',
          accentColor: 'text-indigo-500'
        };
      case 'attendance':
        return {
          label: 'Attendance Tracker',
          icon: <UserCheck className="h-4.5 w-4.5" />,
          colorTheme: 'text-sky-700 bg-sky-50 border-sky-100',
          accentColor: 'text-sky-500'
        };
      case 'maintenance':
        return {
          label: 'Maintenance Tracker',
          icon: <Wrench className="h-4.5 w-4.5" />,
          colorTheme: 'text-amber-700 bg-amber-50 border-amber-100',
          accentColor: 'text-amber-500'
        };
      case 'custom':
        return {
          label: 'Custom Tracker',
          icon: <Sliders className="h-4.5 w-4.5" />,
          colorTheme: 'text-purple-700 bg-purple-50 border-purple-100',
          accentColor: 'text-purple-500'
        };
    }
  };

  // Color mappings for logged status badge grids
  const getCellStatusColor = (status: string, templateType: RecordTemplateType) => {
    const clearStatus = status.toLowerCase();

    if (templateType === 'habit') {
      if (['done', 'yes', 'completed'].some(v => clearStatus.includes(v))) return 'bg-emerald-500 text-white';
      if (['missed', 'failed', 'no'].some(v => clearStatus.includes(v))) return 'bg-rose-500 text-white';
      if (['skipped'].some(v => clearStatus.includes(v))) return 'bg-amber-400 text-slate-900';
      return 'bg-slate-100 text-slate-400 border border-dashed border-slate-300';
    }

    if (templateType === 'delivery') {
      if (['delivered', 'received', 'true', 'yes'].some(v => clearStatus.includes(v))) return 'bg-indigo-600 text-white';
      if (['cancelled', 'no delivery', 'missed'].some(v => clearStatus.includes(v))) return 'bg-rose-400 text-white';
      return 'bg-slate-150 text-slate-500 border border-slate-200';
    }

    if (templateType === 'attendance') {
      if (['present', 'attended', 'here'].some(v => clearStatus.includes(v))) return 'bg-sky-500 text-white';
      if (['absent', 'no-show', 'away'].some(v => clearStatus.includes(v))) return 'bg-rose-500 text-white';
      if (['late', 'tardy'].some(v => clearStatus.includes(v))) return 'bg-amber-400 text-slate-900';
      return 'bg-slate-100 text-slate-400';
    }

    // Maintenance
    if (['inspected', 'done', 'repaired', 'healthy'].some(v => clearStatus.includes(v))) return 'bg-emerald-500 text-white';
    if (['needs repair', 'broken', 'issue', 'repair'].some(v => clearStatus.includes(v))) return 'bg-rose-500 text-white';
    if (['pending', 'waiting'].some(v => clearStatus.includes(v))) return 'bg-amber-400 text-slate-900';
    return 'bg-slate-105 border border-slate-250 text-slate-500';
  };

  return (
    <div className="space-y-5 pb-6">
      
      {/* Overview Intro with template trigger */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 rounded-3xl p-5 md:p-6 text-white relative overflow-hidden shadow-lg border border-indigo-500/20 animate-fade-in">
        <div className="absolute right-0 top-0 -mr-6 -mt-8 w-44 h-44 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-5">
          <div className="max-w-xl space-y-1 md:space-y-1.5">
            <span className="text-[9px] bg-indigo-500/30 text-indigo-200 font-extrabold uppercase tracking-widest py-1 px-2.5 rounded-full border border-indigo-400/20">
              RECORDS &amp; LOG ENGINE
            </span>
            <h2 className="text-xl md:text-2xl font-black font-display tracking-tight text-white leading-tight">
              Smart Trackers
            </h2>
            <p className="text-slate-350 text-xs font-medium leading-relaxed">
              Log repeated daily habits, deliveries, attendance, and checklists. Click any template below to customize and launch.
            </p>
          </div>

          {/* Quick Create Templates row */}
          <div className="pt-2">
            <p className="text-[10px] font-extrabold text-indigo-300 tracking-wider uppercase mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-indigo-400" />
              Quick-Launch Templates:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { type: 'habit' as const, label: 'Habit Tracker', desc: 'Yoga, hydration, study', icon: <Activity className="h-4 w-4" />, bgColor: 'bg-emerald-500/20 text-emerald-350 border-emerald-500/30' },
                { type: 'delivery' as const, label: 'Delivery Tracker', desc: 'Milk logs, active supplies', icon: <Truck className="h-4 w-4" />, bgColor: 'bg-indigo-500/20 text-indigo-350 border-indigo-500/30' },
                { type: 'attendance' as const, label: 'Attendance Tracker', desc: 'Scrum status, meetings', icon: <UserCheck className="h-4 w-4" />, bgColor: 'bg-sky-500/20 text-sky-350 border-sky-500/30' },
                { type: 'maintenance' as const, label: 'Maintenance Tracker', desc: 'Backups, checkups, logs', icon: <Wrench className="h-4 w-4" />, bgColor: 'bg-amber-500/20 text-amber-350 border-amber-500/30' },
                { type: 'custom' as const, label: 'Custom Tracker', desc: 'Tailored checklist log', icon: <Sliders className="h-4 w-4" />, bgColor: 'bg-purple-500/20 text-purple-350 border-purple-500/30' }
              ].map((tmpl) => (
                <button
                  key={tmpl.type}
                  onClick={() => {
                    setIsCreateOpen(true);
                    handleTemplatePreselect(tmpl.type);
                  }}
                  className="flex flex-col items-start p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-400/40 hover:shadow-md transition text-left group cursor-pointer"
                >
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center mb-2 group-hover:scale-105 transition ${tmpl.bgColor}`}>
                    {tmpl.icon}
                  </div>
                  <span className="text-[11px] font-black text-white group-hover:text-indigo-200 transition">
                    ○ {tmpl.label}
                  </span>
                  <span className="text-[9.5px] text-slate-400 mt-1 leading-tight group-hover:text-slate-300">
                    {tmpl.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Creation Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="bg-slate-50 border-b border-indigo-50 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-sm font-black font-display text-slate-900 uppercase tracking-tight">
                    Prepopulate Tracker Template
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1 rounded-xl hover:bg-slate-150 transition"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              {/* Grid selectors for standard structured templates */}
              <div className="p-6 space-y-6 flex-1 overflow-y-auto pr-3 mr-1 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase">
                    1. Choose Template Preset
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { type: 'habit' as const, title: 'Habit Tracker', desc: 'Yoga, hydration, study hours tracking', icon: <Activity className="h-5 w-5 text-emerald-500" /> },
                      { type: 'delivery' as const, title: 'Delivery Tracker', desc: 'Milk logs, water supply refills', icon: <Truck className="h-5 w-5 text-indigo-500" /> },
                      { type: 'attendance' as const, title: 'Attendance Tracker', desc: 'Scrum status, class checking', icon: <UserCheck className="h-5 w-5 text-sky-500" /> },
                      { type: 'maintenance' as const, title: 'Maintenance Tracker', desc: 'Server backups, gym checkups', icon: <Wrench className="h-5 w-5 text-amber-500" /> },
                      { type: 'custom' as const, title: 'Custom Tracker', desc: 'Configure from scratch', icon: <Sliders className="h-5 w-5 text-purple-500" /> }
                    ].map((tpl) => (
                      <button
                        key={tpl.type}
                        type="button"
                        onClick={() => handleTemplatePreselect(tpl.type)}
                        className={`p-3.5 rounded-2xl border transition-all text-left flex items-start gap-3 select-none ${
                          newTemplateType === tpl.type
                            ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                            : 'border-slate-205 hover:bg-slate-50 hover:border-slate-350'
                        }`}
                      >
                        <div className="mt-1 shrink-0">{tpl.icon}</div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{tpl.title}</p>
                          <p className="text-[10px] text-slate-450 mt-0.5 leading-tight">{tpl.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleAddTracker} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase">
                      2. Tracker Details
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Daily Milk Delivery"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-3"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <textarea
                      placeholder="Tracker description / notes..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      rows={2}
                      className="w-full text-xs font-semibold text-slate-650 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase">
                        Unit Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="packets / attendance / checked"
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)}
                        className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase">
                        Default Active Status
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Delivered / Present / Inspected"
                        value={newDefaultValue}
                        onChange={(e) => setNewDefaultValue(e.target.value)}
                        className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5"
                      />
                    </div>
                  </div>

                  {/* Expected Recurrence Daily Slots Limit */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase block">
                      Daily Recurrence (Schedules Per Day)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={newRecurrencePerDay}
                        onChange={(e) => setNewRecurrencePerDay(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-20 text-xs font-bold font-mono text-slate-900 bg-slate-100 border border-slate-205 focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded-xl px-4 py-2 text-center"
                      />
                      <span className="text-[11px] text-slate-450 font-semibold leading-tight">times a day (e.g., support morning and evening deliveries)</span>
                    </div>
                    <div className="flex gap-2 pt-1.5">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setNewRecurrencePerDay(num)}
                          className={`text-[10px] px-3.5 py-1.5 rounded-lg border font-black transition-all ${
                            newRecurrencePerDay === num
                              ? 'bg-indigo-650 text-white border-indigo-700 shadow-xs'
                              : 'bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-105'
                          }`}
                        >
                          {num === 1 ? 'Once' : num === 2 ? 'Twice' : `${num} Times`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scheduled days of the week */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase block">
                      Scheduled Delivery Days
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => {
                        const isActive = newActiveDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (isActive) {
                                if (newActiveDays.length > 1) {
                                  setNewActiveDays(prev => prev.filter(d => d !== day));
                                }
                              } else {
                                setNewActiveDays(prev => [...prev, day]);
                              }
                            }}
                            className={`w-9 h-9 text-xs font-black rounded-xl border transition-all ${
                              isActive
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                : 'bg-slate-50 text-slate-400 border-slate-205 hover:bg-slate-100'
                            }`}
                          >
                            {day[0]}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[9px] text-slate-450 font-medium italic">Unchecked days will render as a dimmed, non-scheduled column in the table sheet grid.</p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-indigo-50">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="px-4.5 py-2.5 text-xs font-extrabold text-slate-500 hover:text-slate-800 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 font-black text-white text-xs rounded-xl shadow-md transition"
                    >
                      Draft Tracker
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Date Filtering Controls & Search */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white border border-indigo-50/60 p-3.5 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Trackers' },
            { id: 'habit', label: 'Habits Only' },
            { id: 'delivery', label: 'Deliveries Log' },
            { id: 'attendance', label: 'Attendance' },
            { id: 'maintenance', label: 'Maintenance' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedTemplateFilter(item.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                selectedTemplateFilter === item.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-150'
                  : 'text-slate-500 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Marked Filtering & Search */}
        <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
            <input
              type="text"
              placeholder="Search sheets..."
              value={trackerSearchQuery}
              onChange={(e) => setTrackerSearchQuery(e.target.value)}
              className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-205 rounded-lg p-0.5">
            {[
              { id: 'all', label: 'All Rows' },
              { id: 'marked', label: '★ Starred' },
              { id: 'unmarked', label: '☆ Regular' }
            ].map((itm) => (
              <button
                key={itm.id}
                onClick={() => setTrackerMarkFilter(itm.id as any)}
                className={`px-2 py-1 rounded-md text-[10px] font-extrabold transition ${
                  trackerMarkFilter === itm.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-indigo-900'
                }`}
              >
                {itm.label}
              </button>
            ))}
          </div>

          {/* Date Sliders slider */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setStartDateOffset(prev => prev - 7)}
              className="p-1 bg-white rounded text-slate-600 shadow-xs hover:text-indigo-600"
              title="Prior Week Slider"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="text-[9px] font-extrabold text-slate-600 px-1 select-none">Slide Grid</span>
            <button
              onClick={() => setStartDateOffset(prev => prev + 7)}
              className="p-1 bg-white rounded text-slate-600 shadow-xs hover:text-indigo-600"
              title="Next Week Slider"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {trackers.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-indigo-50/70 p-16 text-center space-y-4 shadow-sm">
          <BookOpen className="h-14 w-14 text-indigo-300 mx-auto" />
          <h4 className="text-lg font-black text-slate-900 font-display">No Log Trackers Bootstrapped Yet</h4>
          <p className="text-xs text-slate-450 mt-1 max-w-sm mx-auto">
            Create repeated tracking sheets matching your daily workspace workflows first. Switch templates seamlessly to support custom milk supplies, newspaper checkmarks, student attendance logs or maintenance routines.
          </p>
          <button
            onClick={() => {
              setIsCreateOpen(true);
              handleTemplatePreselect('habit');
            }}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 font-black text-white text-xs rounded-xl inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Build First Tracker
          </button>
        </div>
      ) : filteredTrackers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-indigo-50/70 p-12 text-center text-slate-450 shadow-xs">
          <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold">No track sheets found matching selected selectors or star filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-indigo-50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/60 border-b border-indigo-100">
                  <th className="p-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 min-w-[250px] pl-4 border-r border-indigo-50">
                    Tracker Name / Purpose
                  </th>

                  {/* Dates slider columns */}
                  {displayDays.map((day, idx) => {
                    const info = formatDateLabel(day);
                    const isToday = getLocalDateString() === info.dateStr;
                    return (
                      <th
                        key={idx}
                        className={`p-2 text-center min-w-[90px] border-r border-indigo-50 ${
                          isToday ? 'bg-indigo-50/30 font-black' : ''
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span className={`text-[9px] font-black uppercase tracking-wider ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {info.dayName}
                          </span>
                          <span className={`text-xs font-mono mt-0.5 ${isToday ? 'text-indigo-700 font-black' : 'text-slate-805'}`}>
                            {info.dayNum}
                          </span>
                          <span className={`text-[9px] font-semibold text-slate-400 font-mono`}>
                            {info.monthName}
                          </span>
                        </div>
                      </th>
                    );
                  })}

                  <th className="p-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-400 min-w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50/40">
                {filteredTrackers.map((tracker) => {
                  const badge = getTemplateBadges(tracker.templateType);
                  const isMarked = !!tracker.marked;

                  return (
                    <tr 
                      key={tracker.id}
                      className={`hover:bg-indigo-100/10 transition-all ${
                        isMarked ? 'bg-amber-50/5 border-l-4 border-l-amber-450' : ''
                      }`}
                    >
                      <td className="p-3 pl-4 border-r border-indigo-50">
                        <div className="flex items-start gap-2">
                          {/* Row Star selector ('marked' or 'unmarked' state!) */}
                          <button
                            onClick={() => toggleTrackerMarked(tracker)}
                            className={`p-1.5 rounded-xl transition-all ${
                              isMarked
                                ? 'text-amber-500 bg-amber-50/60 hover:bg-amber-100/50'
                                : 'text-slate-350 hover:text-slate-500 hover:bg-slate-50'
                            }`}
                            title={isMarked ? "Unstar row track priority" : "Star priority tracker row"}
                          >
                            <Star className="h-4.5 w-4.5" fill={isMarked ? "currentColor" : "none"} />
                          </button>

                          <div className="min-w-0 pr-1.5">
                            <p className="font-bold text-slate-900 text-xs sm:text-sm truncate" title={tracker.title}>
                              {tracker.title}
                            </p>
                            <p className="text-[10px] text-slate-450 truncate max-w-xs mt-0.5" title={tracker.description}>
                              {tracker.description}
                            </p>
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className={`text-[8.5px] font-black uppercase border px-2 py-0.5 rounded-md flex items-center gap-1 ${badge.colorTheme}`}>
                                {badge.icon}
                                <span>{badge.label}</span>
                              </span>
                              <span className="text-[9px] font-mono text-slate-400">
                                Unit: {tracker.unit}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Display cells matching the dates slider */}
                      {displayDays.map((day, dIdx) => {
                        const dateStr = getLocalDateString(day);
                        const dayInfo = formatDateLabel(day);
                        const isDayActive = !tracker.activeDays || tracker.activeDays.length === 0 || tracker.activeDays.includes(dayInfo.dayName);

                        const log = logs.find(l => l.trackerId === tracker.id && l.date === dateStr && (l.slotIndex === 0 || l.slotIndex === undefined));
                        const status = log ? log.status : String(tracker.defaultValue);
                        const qty = log?.quantity || 0;
                        const hasNotes = !!log?.notes;

                        const colorClass = getCellStatusColor(status, tracker.templateType);
                        const recurrencePerDayCount = tracker.recurrencePerDay || 1;

                        return (
                          <td
                            key={dIdx}
                            className={`p-2 border-r border-indigo-50 hover:bg-slate-55/30 text-center select-none ${
                              !isDayActive ? 'bg-slate-50/40 opacity-75' : ''
                            }`}
                          >
                            {!isDayActive && !logs.some(l => l.trackerId === tracker.id && l.date === dateStr) ? (
                              <div 
                                onClick={() => tracker.id && handleCellClick(tracker.id, dateStr, 0)}
                                className="py-2.5 flex flex-col items-center justify-center cursor-pointer group"
                              >
                                <span className="text-[9px] font-black text-slate-400 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-250 px-2 py-1 rounded-lg border border-dashed border-slate-205 transition duration-150">
                                  Off Day
                                </span>
                                <span className="text-[7.5px] text-slate-450 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 font-semibold uppercase tracking-wider">
                                  Click to Log
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1">
                                {recurrencePerDayCount > 1 ? (
                                  <div className="flex flex-col gap-1.5 w-full max-w-[100px]">
                                    {Array.from({ length: recurrencePerDayCount }).map((_, slotIdx) => {
                                      const slotLog = logs.find(l => 
                                        l.trackerId === tracker.id && 
                                        l.date === dateStr && 
                                        (l.slotIndex === slotIdx || (slotIdx === 0 && l.slotIndex === undefined))
                                      );
                                      const slotStatus = slotLog ? slotLog.status : String(tracker.defaultValue);
                                      const slotQty = slotLog?.quantity || 0;
                                      const slotHasNotes = !!slotLog?.notes;
                                      const slotColorClass = getCellStatusColor(slotStatus, tracker.templateType);

                                      return (
                                        <div key={slotIdx} className="flex flex-col items-center justify-center border-b border-indigo-50/15 pb-1 last:border-0 last:pb-0">
                                          <span className="text-[7.5px] font-black uppercase text-indigo-400 select-none tracking-tight">Slot #{slotIdx + 1}</span>
                                          <div className="flex items-center gap-1 justify-center w-full mt-0.5">
                                            <div
                                              onClick={() => tracker.id && handleCellClick(tracker.id, dateStr, slotIdx)}
                                              className={`px-1.5 py-1 rounded-lg text-[8.5px] font-black cursor-pointer truncate max-w-[70px] shadow-3xs hover:scale-103 active:scale-97 transition text-center relative ${slotColorClass}`}
                                              title={`Log status: ${slotStatus}. Click to edit notes.`}
                                            >
                                              {slotStatus}
                                              {slotHasNotes && (
                                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-600 border border-white rounded-full" />
                                              )}
                                            </div>
                                          </div>

                                          {tracker.templateType === 'delivery' && (
                                            <div className="flex items-center gap-1 bg-white/90 border border-slate-205 rounded-md p-0.5 mt-1 scale-90 shadow-3xs">
                                              <button
                                                onClick={() => adjustCellQuantityInstant(tracker, dateStr, slotIdx, -1)}
                                                className="p-0.5 text-slate-450 hover:bg-slate-50 rounded hover:text-rose-500 transition"
                                                title="Decrement slot quantity"
                                              >
                                                <Minus className="h-2 w-2" />
                                              </button>
                                              <span className="text-[9px] font-black font-mono text-slate-750 px-0.5">
                                                {slotQty}
                                              </span>
                                              <button
                                                onClick={() => adjustCellQuantityInstant(tracker, dateStr, slotIdx, 1)}
                                                className="p-0.5 text-slate-450 hover:bg-slate-50 rounded hover:text-indigo-650 transition"
                                                title="Increment slot quantity"
                                              >
                                                <Plus className="h-2 w-2" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <>
                                    <div
                                      onClick={() => tracker.id && handleCellClick(tracker.id, dateStr, 0)}
                                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black cursor-pointer truncate max-w-[85px] shadow-2xs hover:scale-105 active:scale-95 transition-transform duration-200 text-center relative ${colorClass}`}
                                      title={`${tracker.title} Log status: ${status}. Click to edit notes.`}
                                    >
                                      {status}
                                      {hasNotes && (
                                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-600 border border-white rounded-full" />
                                      )}
                                    </div>

                                    {/* QUANTITY MANAGER: Increment option for Delivery Trackers */}
                                    {tracker.templateType === 'delivery' && (
                                      <div className="flex items-center gap-1 bg-slate-50/80 border border-slate-200 rounded-lg p-0.5 mt-0.5">
                                        <button
                                          onClick={() => adjustCellQuantityInstant(tracker, dateStr, 0, -1)}
                                          className="p-0.5 text-slate-450 hover:bg-white rounded hover:text-rose-500 transition"
                                          title="Decrement quantity"
                                        >
                                          <Minus className="h-2.5 w-2.5" />
                                        </button>
                                        <span className="text-[10px] font-bold font-mono text-slate-705 px-1">
                                          {qty}
                                        </span>
                                        <button
                                          onClick={() => adjustCellQuantityInstant(tracker, dateStr, 0, 1)}
                                          className="p-0.5 text-slate-450 hover:bg-white rounded hover:text-indigo-650 transition"
                                          title="Increment quantity"
                                        >
                                          <Plus className="h-2.5 w-2.5" />
                                        </button>
                                      </div>
                                    )}

                                    {tracker.templateType !== 'delivery' && qty > 0 && (
                                      <span className="text-[8.5px] font-mono text-indigo-600 font-bold bg-indigo-50/50 px-1 rounded">
                                        qty: {qty}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Side quick actions (Edit settings, Delete or click for Service Log report) */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              if (tracker.id) {
                                setActiveHistoryTrackerId(tracker.id);
                                setActiveReportTrackerId(tracker.id);
                                // Scroll to details elegantly
                                document.getElementById('tracker-reports-section')?.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 rounded-lg hover:text-indigo-850"
                            title="View Track Service History & Reports"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEditTracker(tracker)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg hover:text-amber-800"
                            title="Edit tracker configuration settings"
                          >
                            <Wrench className="h-3.5 w-3.5" />
                          </button>
                          
                          <button
                            onClick={() => tracker.id && handleDeleteTracker(tracker.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg hover:text-rose-700"
                            title="Delete track sheet"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 bg-slate-50 text-[11px] text-slate-500 font-medium pl-6 border-t border-indigo-50 flex flex-wrap gap-x-6 gap-y-2 items-center">
            <span>💡 <strong>Double Action Setup</strong>: Click the status pills to update occurrence status checklist. For <strong>Deliveries</strong>, click the mini +/- selectors to instantly adjust counts!</span>
          </div>
        </div>
      )}

      {/* Track Occurrence dialog editor popup */}
      <AnimatePresence>
        {selectedCell && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="px-6 py-4 bg-slate-50 border-b border-indigo-50 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-indigo-950 font-display uppercase tracking-wider">
                    Log Custom Status
                  </h4>
                  <p className="text-[10px] text-slate-450 font-semibold mt-0.5">
                    For date: {selectedCell.dateStr}
                  </p>
                </div>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50/80 px-2 py-1 rounded">
                  {trackers.find(t => t.id === selectedCell.trackerId)?.unit}
                </span>
              </div>

              <div className="p-6 space-y-4">
                
                {/* Custom status field log */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">
                    Current Status Text Name
                  </label>
                  <input
                    type="text"
                    required
                    value={cellStatus}
                    onChange={(e) => setCellStatus(e.target.value)}
                    placeholder="e.g. Delivered, Present, Absent, Up-Late, Inspected"
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Done', 'Delivered', 'Present', 'Absent', 'Inspected', 'Missed'].map((fav) => (
                      <button
                        key={fav}
                        type="button"
                        onClick={() => setCellStatus(fav)}
                        className="text-[9px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded"
                      >
                        {fav}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity Tracker */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">
                    Total Quantity / Volatile count
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1, 2, 3"
                    value={cellQuantity}
                    onChange={(e) => setCellQuantity(Number(e.target.value) || 0)}
                    className="w-full text-xs font-bold text-slate-850 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-100 font-mono"
                  />
                </div>

                {/* Notes log details */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">
                    Service History Remarks & Notes
                  </label>
                  <textarea
                    placeholder="Add brief details about this occurrence..."
                    value={cellNotes}
                    onChange={(e) => setCellNotes(e.target.value)}
                    rows={3}
                    maxLength={200}
                    className="w-full text-xs text-slate-850 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                 <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="px-4.5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSaveOccurrence}
                    className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 font-black text-white text-xs rounded-xl shadow-md transition"
                  >
                    Save Changes
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Tracker Settings Modal */}
      <AnimatePresence>
        {editingTracker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="bg-slate-50 border-b border-indigo-50 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-sm font-black font-display text-slate-900 uppercase tracking-tight">
                    Edit Tracker Configuration
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTracker(null)}
                  className="p-1 rounded-xl hover:bg-slate-150 transition"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSaveTrackerEdit} className="p-6 space-y-4 flex-1 overflow-y-auto pr-3 mr-1 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase">
                    Tracker Name / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase">
                    Description Notes
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full text-xs font-semibold text-slate-650 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase">
                      Unit Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase">
                      Default Status Label
                    </label>
                    <input
                      type="text"
                      required
                      value={editDefaultValue}
                      onChange={(e) => setEditDefaultValue(e.target.value)}
                      className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2"
                    />
                  </div>
                </div>

                {/* Recurrence Per Day */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase block">
                    Daily Recurrence Count
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={editRecurrencePerDay}
                      onChange={(e) => setEditRecurrencePerDay(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-20 text-xs font-bold font-mono text-slate-900 bg-slate-100 border border-slate-250 focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded-xl px-4 py-1.5 text-center"
                    />
                    <span className="text-[10px] text-slate-450 font-bold leading-tight">times expected per day</span>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    {[1, 2, 3, 4].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setEditRecurrencePerDay(num)}
                        className={`text-[9px] px-2.5 py-1 rounded-lg border font-black transition-all ${
                          editRecurrencePerDay === num
                            ? 'bg-indigo-650 text-white border-indigo-700 shadow-3xs'
                            : 'bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-105'
                        }`}
                      >
                        {num}x per day
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scheduled days */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-450 uppercase block">
                    Scheduled delivery days of week
                  </label>
                  <div className="flex gap-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => {
                      const isActive = editActiveDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            if (isActive) {
                              if (editActiveDays.length > 1) {
                                setEditActiveDays(prev => prev.filter(d => d !== day));
                              }
                            } else {
                              setEditActiveDays(prev => [...prev, day]);
                            }
                          }}
                          className={`w-8 h-8 text-[10px] font-black rounded-lg border transition-all ${
                            isActive
                              ? 'bg-indigo-600 text-white border-indigo-700'
                              : 'bg-slate-50 text-slate-450 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {day[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-indigo-50">
                  <button
                    type="button"
                    onClick={() => setEditingTracker(null)}
                    className="px-4.5 py-2.5 text-xs font-extrabold text-slate-450 hover:text-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 font-black text-white text-xs rounded-xl shadow-md transition"
                  >
                    Save Tracker Settings
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TRACK SERVICE HISTORY & REPORTS GENERATOR SECTION */}
      <div id="tracker-reports-section" className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-3">
        
        {/* Service Logs section */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-indigo-50 p-4 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-indigo-50">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase font-display tracking-tight flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-indigo-500" />
                Track Service History log
              </h3>
              <p className="text-[10px] text-slate-450 italic">Chronological list of all logged items</p>
            </div>

            <select
              value={activeHistoryTrackerId || ''}
              onChange={(e) => setActiveHistoryTrackerId(e.target.value || null)}
              className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            >
              <option value="">-- Choose Sheet --</option>
              {trackers.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          {(() => {
            const currentTracker = trackers.find(t => t.id === activeHistoryTrackerId);
            if (!currentTracker) {
              return (
                <p className="text-xs text-slate-400 italic text-center py-5">Select a tracker above to inspect full service log histories.</p>
              );
            }

            const stats = getReportingDetails(currentTracker);
            if (!stats || stats.history.length === 0) {
              return (
                <p className="text-xs text-slate-400 italic text-center py-5">No occurrences logged yet for this sheet.</p>
              );
            }

            return (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {stats.history.map((h, hIdx) => {
                  const statusColors = getCellStatusColor(h.status, currentTracker.templateType);
                  return (
                    <div key={hIdx} className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200/60 p-3 rounded-2xl flex justify-between items-start gap-4 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 font-mono">
                            📅 {h.date}
                          </span>
                          {h.quantity > 0 && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-black font-mono px-2 py-0.5 rounded">
                              Qty: {h.quantity} {currentTracker.unit}
                            </span>
                          )}
                        </div>
                        {h.notes ? (
                          <p className="text-xs text-slate-600 bg-white/70 border border-slate-100 p-2 rounded-xl mt-1 pr">
                            {h.notes}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic mt-0.5 pl-5">No logged details added</p>
                        )}
                      </div>

                      <div className={`px-2.5 py-1 rounded-xl text-[10px] font-black text-center uppercase shrink-0 ${statusColors}`}>
                        {h.status}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Dynamic Service reporting section */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-indigo-50 p-4 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-2 border-b border-indigo-50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase font-display tracking-tight flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
                  Generate Service Reports
                </h3>
                <p className="text-[10px] text-slate-450 italic">Calculated analytical totals &amp; quantities</p>
              </div>

              <select
                value={activeReportTrackerId || ''}
                onChange={(e) => setActiveReportTrackerId(e.target.value || null)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="">-- Choose Sheet --</option>
                {trackers.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            {(() => {
              const currentTracker = trackers.find(t => t.id === activeReportTrackerId);
              if (!currentTracker) {
                return (
                  <p className="text-xs text-slate-400 italic text-center py-5">Select a tracker to compile reporting details.</p>
                );
              }

              const stats = getReportingDetails(currentTracker);
              if (!stats) return null;

              return (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2.5 bg-indigo-50/40 border border-indigo-100/40 p-3 rounded-xl">
                    <Award className="h-7 w-7 text-indigo-650 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-indigo-900">Sheet: {currentTracker.title}</p>
                      <p className="text-[10px] text-indigo-600 font-extrabold font-mono mt-0.5">
                        {stats.countTotalLogs} entries logged overall
                      </p>
                    </div>
                  </div>

                  {/* Quantitative totals display (Useful for milk / deliveries checking) */}
                  {currentTracker.templateType === 'delivery' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg text-center">
                        <span className="text-[11px] font-extrabold text-emerald-700 block">Total Volume Count</span>
                        <span className="text-lg font-bold font-mono text-emerald-800 tracking-tight mt-0.5 inline-block">
                          {stats.sumQuantities} {currentTracker.unit}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-205 p-3 rounded-lg text-center">
                        <span className="text-[11px] font-extrabold text-slate-650 block">Registered Delivered days</span>
                        <span className="text-lg font-bold font-mono text-slate-800 tracking-tight mt-0.5 inline-block">
                          {stats.occurrenceMatrix['Delivered'] || 0} days
                        </span>
                      </div>
                    </div>
                  )}

                  {currentTracker.templateType !== 'delivery' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg text-center">
                        <span className="text-[11px] font-extrabold text-emerald-700 block">Default Metric High</span>
                        <span className="text-sm font-black font-mono text-emerald-800 mt-0.5 inline-block uppercase">
                          {currentTracker.defaultValue} Setup
                        </span>
                      </div>
                      <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg text-center font-mono">
                        <span className="text-[11px] font-extrabold text-indigo-700 block">Logged Entries</span>
                        <span className="text-lg font-black text-indigo-850 tracking-tight mt-0.5 inline-block">
                          {stats.countTotalLogs} days
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Specific Status Distributions summary */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-450 uppercase tracking-widest pl-1">
                      Occurrence status distribution
                    </h4>
                    
                    <div className="space-y-1.5 bg-slate-50/40 border border-slate-150 p-3 rounded-2xl">
                      {Object.keys(stats.occurrenceMatrix).length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic text-center py-2">No occurrences categorized</p>
                      ) : (
                        Object.entries(stats.occurrenceMatrix).map(([status, count]) => {
                          const percent = stats.countTotalLogs > 0 ? Math.round((count / stats.countTotalLogs) * 100) : 0;
                          return (
                            <div key={status} className="space-y-1">
                              <div className="flex justify-between items-center text-[11px] font-bold">
                                <span className="text-slate-700">{status}</span>
                                <span className="text-slate-900 font-mono">{count} ({percent}%)</span>
                              </div>
                              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-indigo-650 h-full rounded-full transition-all"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>

          <div className="text-[10px] text-indigo-600 bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/40 leading-relaxed font-semibold italic">
             Reports compile instantly as entries status and quantity logs get added. Export sheets, filter calendars or analyze overall timelines dynamically.
          </div>
        </div>

      </div>

    </div>
  );
}
