import React, { useState } from 'react';
import { Sparkles, Bug, Star, Clock, Calendar, Filter, Search } from 'lucide-react';
import { changelog, ChangelogEntry } from '../data/changelog';

export function Changelog() {
  const [filterType, setFilterType] = useState<ChangelogEntry['type'] | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getChangelogIcon = (type: ChangelogEntry['type']) => {
    switch (type) {
      case 'feature':
        return <Sparkles className="h-5 w-5 text-blue-500" />;
      case 'fix':
        return <Bug className="h-5 w-5 text-red-500" />;
      case 'enhancement':
        return <Star className="h-5 w-5 text-purple-500" />;
      case 'update':
        return <Clock className="h-5 w-5 text-orange-500" />;
    }
  };

  const getChangelogTypeLabel = (type: ChangelogEntry['type']) => {
    switch (type) {
      case 'feature':
        return 'New Feature';
      case 'fix':
        return 'Bug Fix';
      case 'enhancement':
        return 'Enhancement';
      case 'update':
        return 'Update';
    }
  };

  const getTypeColor = (type: ChangelogEntry['type']) => {
    switch (type) {
      case 'feature':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'fix':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'enhancement':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case 'update':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
    }
  };

  const getBorderColor = (type: ChangelogEntry['type']) => {
    switch (type) {
      case 'feature':
        return 'border-blue-500';
      case 'fix':
        return 'border-red-500';
      case 'enhancement':
        return 'border-purple-500';
      case 'update':
        return 'border-orange-500';
    }
  };

  const filteredChangelog = changelog.filter(entry => {
    const matchesType = filterType === 'all' || entry.type === filterType;
    const matchesSearch = searchTerm === '' || 
      entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const typeStats = {
    all: changelog.length,
    feature: changelog.filter(e => e.type === 'feature').length,
    fix: changelog.filter(e => e.type === 'fix').length,
    enhancement: changelog.filter(e => e.type === 'enhancement').length,
    update: changelog.filter(e => e.type === 'update').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-[#0F172A] dark:via-[#1E293B] dark:to-[#0F172A] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Changelog
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Track all updates, improvements, and fixes to the system
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <button
              onClick={() => setFilterType('all')}
              className={`p-4 rounded-lg border-2 transition-all ${
                filterType === 'all'
                  ? 'border-gray-400 bg-gray-50 dark:bg-[#0F172A] dark:border-gray-500'
                  : 'border-gray-200 dark:border-[#2D3B4E] hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{typeStats.all}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">All Updates</div>
            </button>
            <button
              onClick={() => setFilterType('feature')}
              className={`p-4 rounded-lg border-2 transition-all ${
                filterType === 'feature'
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                  : 'border-gray-200 dark:border-[#2D3B4E] hover:border-blue-300 dark:hover:border-blue-600'
              }`}
            >
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{typeStats.feature}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Features</div>
            </button>
            <button
              onClick={() => setFilterType('fix')}
              className={`p-4 rounded-lg border-2 transition-all ${
                filterType === 'fix'
                  ? 'border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-500'
                  : 'border-gray-200 dark:border-[#2D3B4E] hover:border-red-300 dark:hover:border-red-600'
              }`}
            >
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{typeStats.fix}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Bug Fixes</div>
            </button>
            <button
              onClick={() => setFilterType('enhancement')}
              className={`p-4 rounded-lg border-2 transition-all ${
                filterType === 'enhancement'
                  ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-500'
                  : 'border-gray-200 dark:border-[#2D3B4E] hover:border-purple-300 dark:hover:border-purple-600'
              }`}
            >
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{typeStats.enhancement}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Enhancements</div>
            </button>
            <button
              onClick={() => setFilterType('update')}
              className={`p-4 rounded-lg border-2 transition-all ${
                filterType === 'update'
                  ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-500'
                  : 'border-gray-200 dark:border-[#2D3B4E] hover:border-orange-300 dark:hover:border-orange-600'
              }`}
            >
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{typeStats.update}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Updates</div>
            </button>
          </div>

          {/* Search */}
          <div className="mt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search updates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Changelog Entries */}
        <div className="space-y-4">
          {filteredChangelog.length === 0 ? (
            <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-lg p-12 text-center">
              <Filter className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No updates found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Try adjusting your filters or search term
              </p>
            </div>
          ) : (
            filteredChangelog.map((entry, index) => (
              <div
                key={index}
                className={`bg-white dark:bg-[#1E293B] rounded-lg shadow-lg overflow-hidden border-l-4 ${getBorderColor(entry.type)} hover:shadow-xl transition-shadow`}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {getChangelogIcon(entry.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(entry.type)}`}>
                          {getChangelogTypeLabel(entry.type)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="h-4 w-4" />
                          {entry.date}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {entry.title}
                      </h3>
                      {entry.description && (
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Stay Updated
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                We're constantly improving the platform. Check back regularly to see what's new, or visit the Support page to submit feedback and feature requests.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
