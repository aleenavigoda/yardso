import React, { useState, useEffect } from 'react';
import { TrendingUp, Clock, Users, ArrowUpDown, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TimeTransaction {
  id: string;
  giver_id: string;
  receiver_id: string;
  hours: number;
  description: string;
  service_type: string;
  status: string;
  created_at: string;
  giver: {
    id: string;
    full_name: string;
    display_name: string;
  };
  receiver: {
    id: string;
    full_name: string;
    display_name: string;
  };
}

interface GroupedTransaction {
  id: string;
  giver: {
    id: string;
    full_name: string;
    display_name: string;
  };
  receivers: Array<{
    id: string;
    full_name: string;
    display_name: string;
  }>;
  hours: number;
  description: string;
  service_type: string;
  created_at: string;
  is_group: boolean;
  is_balanced?: boolean;
}

interface FeedProps {
  onBack: () => void;
}

const Feed = ({ onBack }: FeedProps) => {
  const [transactions, setTransactions] = useState<GroupedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      // Get recent confirmed transactions from regular users
      const { data: userTransactions, error: userError } = await supabase
        .from('time_transactions')
        .select(`
          id,
          giver_id,
          receiver_id,
          hours,
          description,
          service_type,
          status,
          created_at,
          giver:profiles!time_transactions_giver_id_fkey(id, full_name, display_name),
          receiver:profiles!time_transactions_receiver_id_fkey(id, full_name, display_name)
        `)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (userError) {
        console.error('Error loading user transactions:', userError);
      }

      // Get recent transactions from agent profiles
      const { data: agentTransactions, error: agentError } = await supabase
        .from('agent_time_transactions')
        .select(`
          id,
          giver_id,
          receiver_id,
          hours,
          description,
          service_type,
          status,
          created_at,
          giver:agent_profiles!agent_time_transactions_giver_id_fkey(id, full_name, display_name),
          receiver:agent_profiles!agent_time_transactions_receiver_id_fkey(id, full_name, display_name)
        `)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(15);

      if (agentError) {
        console.error('Error loading agent transactions:', agentError);
      }

      // Combine both sets of transactions
      const allTransactions = [
        ...(userTransactions || []),
        ...(agentTransactions || [])
      ];

      // Group transactions by giver, description, and time (within 1 hour)
      const grouped = groupTransactions(allTransactions);
      
      // Check for balanced exchanges
      const withBalanceInfo = await addBalanceInfo(grouped);
      
      setTransactions(withBalanceInfo);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupTransactions = (transactions: TimeTransaction[]): GroupedTransaction[] => {
    const groups: { [key: string]: GroupedTransaction } = {};

    transactions.forEach(transaction => {
      // Create a key for grouping: giver_id + description + time_window
      const timeWindow = Math.floor(new Date(transaction.created_at).getTime() / (1000 * 60 * 60)); // Hour window
      const groupKey = `${transaction.giver_id}_${transaction.description}_${timeWindow}`;

      if (groups[groupKey]) {
        // Add to existing group
        groups[groupKey].receivers.push(transaction.receiver);
        groups[groupKey].is_group = true;
      } else {
        // Create new group
        groups[groupKey] = {
          id: transaction.id,
          giver: transaction.giver,
          receivers: [transaction.receiver],
          hours: transaction.hours,
          description: transaction.description,
          service_type: transaction.service_type,
          created_at: transaction.created_at,
          is_group: false
        };
      }
    });

    return Object.values(groups).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  const addBalanceInfo = async (transactions: GroupedTransaction[]): Promise<GroupedTransaction[]> => {
    // For each transaction, check if there's a reciprocal transaction within 24 hours
    const withBalance = await Promise.all(
      transactions.map(async (transaction) => {
        if (transaction.is_group) {
          return transaction; // Skip balance check for group transactions
        }

        const receiver = transaction.receivers[0];
        
        // Look for reciprocal transaction in both regular and agent transactions
        const timeRange = {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        // Check regular transactions
        const { data: reciprocalUser } = await supabase
          .from('time_transactions')
          .select('hours')
          .eq('giver_id', receiver.id)
          .eq('receiver_id', transaction.giver.id)
          .eq('status', 'confirmed')
          .gte('created_at', timeRange.start)
          .lte('created_at', timeRange.end);

        // Check agent transactions
        const { data: reciprocalAgent } = await supabase
          .from('agent_time_transactions')
          .select('hours')
          .eq('giver_id', receiver.id)
          .eq('receiver_id', transaction.giver.id)
          .eq('status', 'confirmed')
          .gte('created_at', timeRange.start)
          .lte('created_at', timeRange.end);

        const reciprocal = [...(reciprocalUser || []), ...(reciprocalAgent || [])];
        const isBalanced = reciprocal.length > 0 && 
          Math.abs(reciprocal[0].hours - transaction.hours) < 0.5;

        return {
          ...transaction,
          is_balanced: isBalanced
        };
      })
    );

    return withBalance;
  };

  const getServiceTypeColor = (serviceType: string) => {
    const colors = {
      legal: 'text-green-600',
      design: 'text-blue-600',
      analysis: 'text-purple-600',
      strategy: 'text-orange-600',
      general: 'text-gray-600'
    };
    return colors[serviceType as keyof typeof colors] || colors.general;
  };

  const getServiceTypeLabel = (serviceType: string) => {
    const labels = {
      legal: 'legal consultation',
      design: 'UX design',
      analysis: 'data analysis',
      strategy: 'strategy session',
      general: 'consultation'
    };
    return labels[serviceType as keyof typeof labels] || serviceType;
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen w-full bg-amber-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-black hover:bg-white hover:bg-opacity-50 px-3 py-2 rounded-lg transition-all duration-200"
          >
            <ArrowLeft size={16} />
            <span className="text-2xl font-bold italic">yard</span>
          </button>
        </header>

        {/* Feed Content */}
        <div className="bg-white rounded-3xl p-8 shadow-lg border border-amber-100">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-gray-900 text-lg">Recent Time Flows</h2>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 rounded-xl transition-colors duration-200">
                  {/* Avatar(s) */}
                  <div className="flex items-center">
                    {transaction.is_group ? (
                      <div className="flex -space-x-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(transaction.giver.full_name)} border-2 border-white`}>
                          {getInitials(transaction.giver.display_name)}
                        </div>
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 text-xs font-medium border-2 border-white">
                          <Users size={12} />
                        </div>
                        {transaction.receivers.slice(0, 2).map((receiver, index) => (
                          <div key={receiver.id} className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(receiver.full_name)} border-2 border-white`}>
                            {getInitials(receiver.display_name)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(transaction.giver.full_name)}`}>
                          {getInitials(transaction.giver.display_name)}
                        </div>
                        {transaction.is_balanced && (
                          <div className="mx-2">
                            <ArrowUpDown size={16} className="text-green-600" />
                          </div>
                        )}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(transaction.receivers[0].full_name)}`}>
                          {getInitials(transaction.receivers[0].display_name)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-gray-900">
                        {transaction.giver.display_name}
                      </span>
                      <span className="text-gray-600">
                        {transaction.is_group ? 'facilitated' : (transaction.is_balanced ? 'exchanged' : 'provided')}
                      </span>
                      <span className={`font-medium ${getServiceTypeColor(transaction.service_type)}`}>
                        {transaction.hours}h {getServiceTypeLabel(transaction.service_type)}
                      </span>
                      <span className="text-gray-600">
                        {transaction.is_group ? 'with' : (transaction.is_balanced ? 'with' : 'to')}
                      </span>
                      {transaction.is_group ? (
                        <span className="font-medium text-gray-900">
                          {transaction.receivers.map(r => r.display_name).join(', ')}
                          {transaction.receivers.length > 2 && ` and ${transaction.receivers.length - 2} others`}
                        </span>
                      ) : (
                        <span className="font-medium text-gray-900">
                          {transaction.receivers[0].display_name}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>"{transaction.description}"</span>
                      <span>•</span>
                      <span>{formatTimeAgo(transaction.created_at)}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    {transaction.is_balanced && !transaction.is_group ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Balanced
                      </span>
                    ) : transaction.is_group ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Group
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        +{transaction.hours}h
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {transactions.length === 0 && (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No recent time flows to show</p>
                  <p className="text-gray-400 text-sm">Time transactions will appear here as they're confirmed</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Feed;