import React, { useState, useEffect, useMemo } from 'react';
import { db, auth, handleFirestoreError, OperationType, getLocalDateString } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  Sparkles, 
  Filter, 
  Tag, 
  PiggyBank, 
  AlertCircle, 
  CalendarRange, 
  X, 
  DollarSign as WalletIcon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface FinancialRecord {
  id: string;
  userId: string;
  title: string;
  type: 'earning' | 'expenditure';
  amount: number;
  category: 'rent' | 'water' | 'electricity' | 'grocery' | 'gym' | 'salary' | 'freelance' | 'investment' | 'other';
  date: string;
  earningBasis: 'daily' | 'monthly' | 'custom' | 'none';
  isBillPayment: boolean;
  billStatus: 'paid' | 'pending' | 'none';
  createdAt: string;
  updatedAt: string;
}

export default function FinanceTracker() {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'earning' | 'expenditure'>('expenditure');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<FinancialRecord['category']>('grocery');
  const [date, setDate] = useState(getLocalDateString());
  const [earningBasis, setEarningBasis] = useState<FinancialRecord['earningBasis']>('none');
  const [isBillPayment, setIsBillPayment] = useState(false);
  const [billStatus, setBillStatus] = useState<FinancialRecord['billStatus']>('none');
  const [notes, setNotes] = useState('');

  // Filter States
  const [filterType, setFilterType] = useState<'all' | 'earning' | 'expenditure'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [earningBasisFilter, setEarningBasisFilter] = useState<'all' | 'daily' | 'monthly' | 'custom'>('all');

  const user = auth.currentUser;

  // Sync real-time records from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'financialRecords'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData: FinancialRecord[] = [];
      snapshot.forEach((doc) => {
        recordsData.push({ id: doc.id, ...doc.data() } as FinancialRecord);
      });
      // Sort in memory to avoid needing separate firestore index setup
      recordsData.sort((a, b) => b.date.localeCompare(a.date));
      setRecords(recordsData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching financial records:", err);
      try {
        handleFirestoreError(err, OperationType.GET, 'financialRecords');
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Categories configurations
  const categoryConfig = {
    rent: { label: 'Rent & Housing', color: '#6366f1', bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    water: { label: 'Water Utility', color: '#3b82f6', bg: 'bg-blue-50 text-blue-600 border-blue-100' },
    electricity: { label: 'Electricity Bill', color: '#eab308', bg: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
    grocery: { label: 'Grocery & Food', color: '#10b981', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    gym: { label: 'Gym & Fitness', color: '#ec4899', bg: 'bg-pink-50 text-pink-600 border-pink-100' },
    salary: { label: 'Salary/Earning', color: '#8b5cf6', bg: 'bg-purple-50 text-purple-600 border-purple-100' },
    freelance: { label: 'Freelance Work', color: '#14b8a6', bg: 'bg-teal-50 text-teal-600 border-teal-100' },
    investment: { label: 'Investment Gain', color: '#f97316', bg: 'bg-orange-50 text-orange-600 border-orange-100' },
    other: { label: 'Other/Misc', color: '#64748b', bg: 'bg-slate-50 text-slate-600 border-slate-100' }
  };

  const categories = Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>;

  // Submits the form to save a record
  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !amount || parseFloat(amount) <= 0) {
      alert("Please fill in a valid title and positive amount.");
      return;
    }

    const payload = {
      userId: user.uid,
      title: title.trim(),
      type,
      amount: parseFloat(amount),
      category,
      date,
      earningBasis: type === 'earning' ? earningBasis : 'none',
      isBillPayment: type === 'expenditure' ? isBillPayment : false,
      billStatus: type === 'expenditure' && isBillPayment ? billStatus : 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'financialRecords'), payload);
      // Reset form
      setTitle('');
      setAmount('');
      setIsAdding(false);
      setEarningBasis('none');
      setIsBillPayment(false);
      setBillStatus('none');
    } catch (err) {
      console.error("Failed to write financial record:", err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'financialRecords');
      } catch (e: any) {
        setError("Write failed: " + e.message);
      }
    }
  };

  // Toggle bill status paid/pending
  const toggleBillStatus = async (record: FinancialRecord) => {
    try {
      const nextStatus = record.billStatus === 'paid' ? 'pending' : 'paid';
      const docRef = doc(db, 'financialRecords', record.id);
      await updateDoc(docRef, {
        billStatus: nextStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error updating bill status:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `financialRecords/${record.id}`);
      } catch (e: any) {
        setError(e.message);
      }
    }
  };

  // Delete a record
  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'financialRecords', id));
    } catch (err) {
      console.error("Error deleting financial record:", err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `financialRecords/${id}`);
      } catch (e: any) {
        setError(e.message);
      }
    }
  };

  // Calculated metrics
  const stats = useMemo(() => {
    let totalEarning = 0;
    let totalExpenditure = 0;
    let dailyEarnings = 0;
    let monthlyEarnings = 0;
    let customEarnings = 0;

    let pendingBillsTotal = 0;
    let paidBillsTotal = 0;

    records.forEach((rec) => {
      if (rec.type === 'earning') {
        totalEarning += rec.amount;
        if (rec.earningBasis === 'daily') dailyEarnings += rec.amount;
        if (rec.earningBasis === 'monthly') monthlyEarnings += rec.amount;
        if (rec.earningBasis === 'custom') customEarnings += rec.amount;
      } else {
        totalExpenditure += rec.amount;
        if (rec.isBillPayment) {
          if (rec.billStatus === 'paid') paidBillsTotal += rec.amount;
          if (rec.billStatus === 'pending') pendingBillsTotal += rec.amount;
        }
      }
    });

    const netBalance = totalEarning - totalExpenditure;

    return {
      totalEarning,
      totalExpenditure,
      netBalance,
      dailyEarnings,
      monthlyEarnings,
      customEarnings,
      pendingBillsTotal,
      paidBillsTotal
    };
  }, [records]);

  // Filtered record list
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const matchesType = filterType === 'all' || rec.type === filterType;
      const matchesCategory = filterCategory === 'all' || rec.category === filterCategory;
      const matchesBasis = earningBasisFilter === 'all' || (rec.type === 'earning' && rec.earningBasis === earningBasisFilter);
      return matchesType && matchesCategory && matchesBasis;
    });
  }, [records, filterType, filterCategory, earningBasisFilter]);

  // Generate chart data for recent transactions
  const chartData = useMemo(() => {
    // Group earnings vs expenditures by date (last 7 entry dates)
    const grouped: { [key: string]: { date: string; earnings: number; expenditures: number } } = {};
    
    // Process in chronologically sorted order
    const chronRecords = [...records].reverse();
    
    chronRecords.forEach((rec) => {
      const d = rec.date;
      if (!grouped[d]) {
        grouped[d] = { date: d, earnings: 0, expenditures: 0 };
      }
      if (rec.type === 'earning') {
        grouped[d].earnings += rec.amount;
      } else {
        grouped[d].expenditures += rec.amount;
      }
    });

    return Object.values(grouped).slice(-7); // take last 7 unique days of active transactions
  }, [records]);

  // Pie chart data for expenditure breakdown
  const pieChartData = useMemo(() => {
    const categoryTotals: { [key: string]: number } = {};
    records.forEach((rec) => {
      if (rec.type === 'expenditure') {
        categoryTotals[rec.category] = (categoryTotals[rec.category] || 0) + rec.amount;
      }
    });

    return Object.keys(categoryTotals).map((cat) => ({
      name: categoryConfig[cat as keyof typeof categoryConfig]?.label || cat,
      value: categoryTotals[cat],
      color: categoryConfig[cat as keyof typeof categoryConfig]?.color || '#cbd5e1'
    }));
  }, [records]);

  return (
    <div className="space-y-6 max-h-full" id="finance-tracker-module">
      {/* Upper overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Net Wealth Balance Card */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl border border-indigo-500/20">
          <div className="absolute right-0 bottom-0 opacity-10">
            <PiggyBank className="w-40 h-40 transform translate-x-10 translate-y-10" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black tracking-widest uppercase text-indigo-300">
              Net Financial Balance
            </span>
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <CreditCard className="h-4.5 w-4.5 text-indigo-400" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight font-display text-white">
              ${stats.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className="text-xs text-indigo-200/80 font-medium">
              Accumulated wealth across all logs
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-indigo-900/40 flex items-center justify-between text-xs">
            <span className="text-indigo-300 font-semibold">Status Rating:</span>
            <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ${
              stats.netBalance >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {stats.netBalance >= 1000 ? 'Excellent' : stats.netBalance >= 0 ? 'Surplus' : 'Deficit Alert'}
            </span>
          </div>
        </div>

        {/* Earning Tracker Card with Earning Basis breakdowns */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
              Earnings Portfolio
            </span>
            <div className="p-2 bg-emerald-50 rounded-xl">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-600" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight font-display text-slate-900">
              ${stats.totalEarning.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Consolidated earnings streams
            </p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 pt-3.5 border-t border-slate-50">
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Daily Wage</span>
              <p className="text-xs font-black text-slate-800">${stats.dailyEarnings.toFixed(0)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Monthly Base</span>
              <p className="text-xs font-black text-slate-800">${stats.monthlyEarnings.toFixed(0)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Custom/Other</span>
              <p className="text-xs font-black text-slate-800">${stats.customEarnings.toFixed(0)}</p>
            </div>
          </div>
        </div>

        {/* Expenditures Card & Bills Quick Tracker */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
              Expenditures &amp; Bills
            </span>
            <div className="p-2 bg-rose-50 rounded-xl">
              <TrendingDown className="h-4.5 w-4.5 text-rose-600" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight font-display text-slate-900">
              ${stats.totalExpenditure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Sum of daily spending &amp; obligations
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between pt-3.5 border-t border-slate-50">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Pending Bills:</span>
            </div>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
              stats.pendingBillsTotal > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'
            }`}>
              ${stats.pendingBillsTotal.toFixed(2)}
            </span>
          </div>
        </div>

      </div>

      {/* Main grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Charts & Records list */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Chart Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <h3 className="font-display font-semibold text-slate-900">Financial Activity Analytics</h3>
              </div>
              <p className="text-[10px] font-mono text-slate-400">Last 7 Active Days</p>
            </div>

            {chartData.length === 0 ? (
              <div className="h-56 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <CalendarRange className="h-8 w-8 text-slate-300" />
                <p className="text-xs font-medium">No activity log trends to graph yet</p>
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEarning" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpenditure" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="earnings" name="Earnings" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEarning)" />
                    <Area type="monotone" dataKey="expenditures" name="Expenditures" stroke="#ec4899" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpenditure)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* List of Financial Records */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Filter Header bar */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight font-display">
                  Transaction Logs Ledger
                </h4>
              </div>

              {/* Filtering Selectors */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Earning / Expense filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="bg-white text-slate-600 text-xs px-3 py-1.5 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">All Types</option>
                  <option value="earning">Earnings Only</option>
                  <option value="expenditure">Expenditure Only</option>
                </select>

                {/* Categories selector */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-white text-slate-600 text-xs px-3 py-1.5 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{categoryConfig[cat].label}</option>
                  ))}
                </select>

                {/* Earning basis filters (visible only when checking earnings) */}
                {filterType === 'earning' && (
                  <select
                    value={earningBasisFilter}
                    onChange={(e) => setEarningBasisFilter(e.target.value as any)}
                    className="bg-white text-slate-600 text-xs px-3 py-1.5 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="all">All Bases</option>
                    <option value="daily">Daily Wages</option>
                    <option value="monthly">Monthly Salary</option>
                    <option value="custom">Custom Earnings</option>
                  </select>
                )}
              </div>
            </div>

            {/* Content Table / List */}
            <div className="divide-y divide-slate-150">
              {filteredRecords.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <WalletIcon className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-slate-500">No matching financial records found</p>
                  <p className="text-xs text-slate-400">Click &quot;Log New Record&quot; to build your ledger.</p>
                </div>
              ) : (
                filteredRecords.map((rec) => {
                  const catInfo = categoryConfig[rec.category] || categoryConfig.other;
                  return (
                    <div key={rec.id} className="p-4 md:p-5 flex items-center justify-between hover:bg-slate-50/40 transition-colors">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Status Type Indicator */}
                        <div className={`p-2.5 rounded-2xl flex-shrink-0 ${
                          rec.type === 'earning' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {rec.type === 'earning' ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : (
                            <TrendingDown className="w-5 h-5" />
                          )}
                        </div>

                        {/* Title, Category Badge, Date */}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm truncate">
                              {rec.title}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider border ${catInfo.bg}`}>
                              {catInfo.label}
                            </span>
                            {rec.type === 'earning' && rec.earningBasis !== 'none' && (
                              <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider">
                                {rec.earningBasis} basis
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2.5 mt-1 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-300" />
                              {rec.date}
                            </span>
                            {rec.isBillPayment && (
                              <span className="flex items-center gap-1 text-amber-500 font-bold">
                                <AlertCircle className="w-3 h-3" />
                                Bill payment
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Amount, Status toggle, Actions */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className={`text-base font-black ${
                            rec.type === 'earning' ? 'text-emerald-600' : 'text-slate-900'
                          }`}>
                            {rec.type === 'earning' ? '+' : '-'}${rec.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>

                          {/* Quick Toggle paid/pending status for bills */}
                          {rec.isBillPayment && (
                            <button
                              onClick={() => toggleBillStatus(rec)}
                              className={`block ml-auto mt-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                rec.billStatus === 'paid'
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                  : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100/50'
                              }`}
                            >
                              {rec.billStatus}
                            </button>
                          )}
                        </div>

                        {/* Delete action button */}
                        <button
                          onClick={() => handleDeleteRecord(rec.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Right 1 Col: Quick Bill payments, Category Pie Chart, Add form trigger */}
        <div className="space-y-6">
          
          {/* Action trigger & Add form */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider">
                Financial Operations
              </h3>
              {!isAdding && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1 bg-indigo-600 text-white text-xs px-3.5 py-1.5 rounded-xl font-black shadow-lg shadow-indigo-150 hover:bg-indigo-700 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Log Record
                </button>
              )}
            </div>

            {isAdding && (
              <form onSubmit={handleAddRecord} className="space-y-4">
                {/* Transaction Type Choice */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setType('earning');
                      setCategory('salary');
                      setEarningBasis('monthly');
                    }}
                    className={`text-xs font-black py-2 rounded-xl transition-all ${
                      type === 'earning'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Earning / Income
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('expenditure');
                      setCategory('grocery');
                      setEarningBasis('none');
                    }}
                    className={`text-xs font-black py-2 rounded-xl transition-all ${
                      type === 'expenditure'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Expenditure
                  </button>
                </div>

                {/* Form fields */}
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Title/Description</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Monthly Salary, Grocery, Rent"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-150 rounded-2xl px-4 py-2.5 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Amount ($)</label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="e.g. 150.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-150 rounded-2xl px-4 py-2.5 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-150 rounded-2xl px-4 py-2.5 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-150 rounded-2xl px-4 py-2.5 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white"
                    >
                      {type === 'earning' ? (
                        <>
                          <option value="salary">Salary / Wages</option>
                          <option value="freelance">Freelance Income</option>
                          <option value="investment">Investment Gain</option>
                          <option value="other">Other Income</option>
                        </>
                      ) : (
                        <>
                          <option value="rent">Rent &amp; Housing</option>
                          <option value="water">Water Utility</option>
                          <option value="electricity">Electricity Bill</option>
                          <option value="grocery">Grocery &amp; Food</option>
                          <option value="gym">Gym &amp; Fitness</option>
                          <option value="other">Other / Miscellaneous</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Earning Basis parameters */}
                  {type === 'earning' && (
                    <div className="space-y-1 animate-fade-in">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Earning Basis</label>
                      <select
                        value={earningBasis}
                        onChange={(e) => setEarningBasis(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-150 rounded-2xl px-4 py-2.5 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:bg-white"
                      >
                        <option value="daily">Daily / Regular Wages</option>
                        <option value="monthly">Monthly Recurring Salary</option>
                        <option value="custom">Custom / Milestone Basis</option>
                      </select>
                    </div>
                  )}

                  {/* Expenditure flags: Bill payments */}
                  {type === 'expenditure' && (
                    <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600">Is this a Bill Payment?</span>
                        <input
                          type="checkbox"
                          checked={isBillPayment}
                          onChange={(e) => {
                            setIsBillPayment(e.target.checked);
                            setBillStatus(e.target.checked ? 'pending' : 'none');
                          }}
                          className="h-4.5 w-4.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                      </div>

                      {isBillPayment && (
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Initial Bill Status</label>
                          <select
                            value={billStatus}
                            onChange={(e) => setBillStatus(e.target.value as any)}
                            className="w-full bg-white border border-slate-150 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold"
                          >
                            <option value="pending">Unpaid / Pending</option>
                            <option value="paid">Paid</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Submits and cancels */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white text-xs py-2.5 rounded-xl font-black shadow-lg shadow-indigo-150 hover:bg-indigo-700 transition-all"
                  >
                    Confirm &amp; Log
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="bg-slate-100 text-slate-500 text-xs px-4 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Expenditure Categories Distribution Chart */}
          {pieChartData.length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3.5">
              <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider">
                Expenses Share
              </h3>
              <div className="h-44 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => `$${val.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Expense</span>
                  <span className="text-lg font-black text-slate-900 font-display">${stats.totalExpenditure.toFixed(0)}</span>
                </div>
              </div>

              {/* Legends */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {pieChartData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-500 font-medium">{item.name}</span>
                    </div>
                    <span className="font-black text-slate-800">${item.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bill payments reminder checklist */}
          <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-3xl p-5 border border-indigo-100/40 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black text-slate-800 text-xs uppercase tracking-wider">
                Monthly Utility Bills checklist
              </h3>
              <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md uppercase">
                Obligations
              </span>
            </div>

            {/* Default system bills to help user align rent, electricity, water, grocery, gym */}
            <div className="space-y-2.5">
              {[
                { category: 'rent', label: 'Rent/Housing Payment', defaultAmount: '800' },
                { category: 'water', label: 'Water utility bill', defaultAmount: '45' },
                { category: 'electricity', label: 'Electricity Grid obligation', defaultAmount: '90' },
                { category: 'grocery', label: 'Groceries supply', defaultAmount: '200' },
                { category: 'gym', label: 'Gym & Fitness Membership', defaultAmount: '60' }
              ].map((b) => {
                // Check if this exists in the bill list
                const matchingBill = records.find(r => r.category === b.category && r.isBillPayment);
                const isPaid = matchingBill ? matchingBill.billStatus === 'paid' : false;

                return (
                  <div key={b.category} className="bg-white rounded-2xl p-3.5 border border-slate-100 flex items-center justify-between shadow-xs">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">{b.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {matchingBill ? `Amount: $${matchingBill.amount}` : `Est: $${b.defaultAmount}`}
                        </span>
                        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                          matchingBill
                            ? isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {matchingBill ? matchingBill.billStatus : 'untracked'}
                        </span>
                      </div>
                    </div>

                    {matchingBill ? (
                      <button
                        onClick={() => toggleBillStatus(matchingBill)}
                        className={`p-1.5 rounded-xl transition-all ${
                          isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-150 text-slate-400 hover:bg-slate-200'
                        }`}
                        title={isPaid ? "Mark unpaid" : "Mark paid"}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setTitle(b.label);
                          setAmount(b.defaultAmount);
                          setCategory(b.category as any);
                          setType('expenditure');
                          setIsBillPayment(true);
                          setBillStatus('pending');
                          setIsAdding(true);
                        }}
                        className="text-[9px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 px-2.5 py-1 rounded-xl transition-all"
                      >
                        Track Bill
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
