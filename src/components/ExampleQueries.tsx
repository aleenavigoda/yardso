import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ExampleQueriesProps {
  setSearchValue: (value: string) => void;
}

const ExampleQueries = ({ setSearchValue }: ExampleQueriesProps) => {
  const queries = [
    'I need a legal review of my Series A term sheet',
    'I want UX critique on my social app interface',
    'Need help doing due diligence for an early stage biotech venture',
    'Help me understand how LLMs work for my startup',
  ];

  return (
    <div className="space-y-4 mb-12">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-800 mb-2">Popular requests</h3>
        <p className="text-sm text-gray-600">Click any example to get started</p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {queries.map((query, index) => (
          <button
            key={index}
            onClick={() => setSearchValue(query)}
            className="group bg-white hover:bg-amber-50 rounded-full px-6 py-3 text-sm border border-amber-200 hover:border-amber-300 transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <span>{query}</span>
            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExampleQueries;