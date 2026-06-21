import React from 'react';
import { Task, TaskCategory, TaskPriority } from '../types';
import { Target, AlertCircle, CheckCircle2, TrendingUp, Presentation, CalendarDays, PieChart } from 'lucide-react';

interface AnalyticsProps {
  tasks: Task[];
}

export default function Analytics({ tasks }: AnalyticsProps) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const pending = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Overdue calculation (due date in past and status is pending)
  const todayStr = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.status === 'pending' && t.dueDate && t.dueDate < todayStr).length;

  // Priority calculations
  const priorityCounts = {
    high: tasks.filter(t => t.priority === 'high').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    low: tasks.filter(t => t.priority === 'low').length
  };

  const priorityCompleted = {
    high: tasks.filter(t => t.priority === 'high' && t.status === 'completed').length,
    medium: tasks.filter(t => t.priority === 'medium' && t.status === 'completed').length,
    low: tasks.filter(t => t.priority === 'low' && t.status === 'completed').length
  };

  // Category counts
  const categories: TaskCategory[] = ['Work', 'Personal', 'Shopping', 'Health', 'Fitness', 'Ideas', 'Other'];
  const categoryStats = categories.map(cat => {
    const catTasks = tasks.filter(t => t.category === cat);
    const catTotal = catTasks.length;
    const catCompleted = catTasks.filter(t => t.status === 'completed').length;
    const catRate = catTotal > 0 ? Math.round((catCompleted / catTotal) * 100) : 0;
    return { name: cat, total: catTotal, completed: catCompleted, rate: catRate };
  }).filter(stat => stat.total > 0);

  return (
    <div className="space-y-6">
      {/* Overview Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Presentation className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Total Logged</p>
            <p className="text-2xl font-semibold font-display text-slate-950 mt-0.5">{total}</p>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Completion Rate</p>
            <p className="text-2xl font-semibold font-display text-slate-950 mt-0.5">{completionRate}%</p>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-semibold font-display text-slate-950 mt-0.5">{pending}</p>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${overdue > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-450 uppercase tracking-wide">Overdue</p>
            <p className={`text-2xl font-semibold font-display mt-0.5 ${overdue > 0 ? 'text-rose-600 font-bold' : 'text-slate-950'}`}>{overdue}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Productivity Trends & Priority Meter */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-900 font-display">Task Priority Performance Breakdown</h3>
          </div>

          <div className="space-y-4">
            {/* High Priority */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> High Priority Tasks
                </span>
                <span className="text-slate-500 font-mono">
                  {priorityCompleted.high}/{priorityCounts.high} completed
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${priorityCounts.high > 0 ? (priorityCompleted.high / priorityCounts.high) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Medium Priority */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Medium Priority Tasks
                </span>
                <span className="text-slate-500 font-mono">
                  {priorityCompleted.medium}/{priorityCounts.medium} completed
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${priorityCounts.medium > 0 ? (priorityCompleted.medium / priorityCounts.medium) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Low Priority */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Low Priority Tasks
                </span>
                <span className="text-slate-500 font-mono">
                  {priorityCompleted.low}/{priorityCounts.low} completed
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-50 h-full rounded-full transition-all duration-500 bg-emerald-500" 
                  style={{ width: `${priorityCounts.low > 0 ? (priorityCompleted.low / priorityCounts.low) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-150 flex justify-between items-center text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" /> Real-time database synchronizations
            </span>
          </div>
        </div>

        {/* Category Performance */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="h-5 w-5 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-900 font-display">Performance by category</h3>
            </div>

            {categoryStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                <p className="text-xs">No categorised task distribution found.</p>
                <p className="text-[10px] mt-1 text-slate-350">Add tasks and categories to view statistics here.</p>
              </div>
            ) : (
              <div className="space-y-4.5 max-h-[190px] overflow-y-auto pr-1">
                {categoryStats.map((stat) => (
                  <div key={stat.name} className="flex flex-col">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-semibold text-slate-700">{stat.name}</span>
                      <span className="text-slate-500 font-mono">{stat.rate}% ({stat.completed}/{stat.total})</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${stat.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
            Calculated over active user task sheets. Overdue tasks limit completion speeds.
          </p>
        </div>

      </div>
    </div>
  );
}
