import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  FileText, 
  Building2, 
  User, 
  Hash,
  Tag,
  Calendar,
  Filter,
  Clock,
  Layers
} from 'lucide-react';

interface TutorialStep {
  title: string;
  content: React.ReactNode;
  image?: string;
}

export function SearchTutorial() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tutorialDismissed, setTutorialDismissed] = useState(false);

  useEffect(() => {
    // Check if the search tutorial has been dismissed before
    const dismissed = localStorage.getItem('searchTutorialDismissed') === 'true';
    setTutorialDismissed(dismissed);
    
    // Show tutorial automatically if it hasn't been dismissed
    if (!dismissed) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissTutorial = () => {
    localStorage.setItem('searchTutorialDismissed', 'true');
    setTutorialDismissed(true);
    setIsOpen(false);
  };

  const tutorialSteps: TutorialStep[] = [
    {
      title: 'Welcome to JG Portal 2.5',
      content: (
        <div>
          <p className="mb-3">
            Welcome to JG Portal 2.5! This tutorial will introduce you to the powerful search capabilities that make finding information quick and easy.
          </p>
          <p>
            Let's explore how you can use search to boost your productivity and find exactly what you need.
          </p>
        </div>
      ),
      image: 'https://images.unsplash.com/photo-1586769852044-692d6e3703f2?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
    },
    {
      title: 'Dashboard Overview',
      content: (
        <div>
          <p className="mb-3">
            The dashboard gives you a complete overview of your painting business at a glance.
          </p>
          <p>
            You can see job requests, work orders, grading, invoicing, and completed jobs all in one place.
          </p>
        </div>
      ),
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
    },
    {
      title: 'Job Management',
      content: (
        <div>
          <p className="mb-3">
            Easily manage all your painting jobs through their entire lifecycle.
          </p>
          <p>
            From initial job requests to work orders, grading, invoicing, and completion - everything is organized and tracked.
          </p>
        </div>
      ),
      image: 'https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
    },
    {
      title: 'Property Management',
      content: (
        <div>
          <p className="mb-3">
            Keep track of all your properties and property management groups.
          </p>
          <p>
            Store important details like paint colors, contact information, and billing rates for each property.
          </p>
        </div>
      ),
      image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
    },
    {
      title: 'Search for Work Orders',
      content: (
        <div>
          <p className="mb-3">
            Quickly find work orders by their number. You can search using any of these formats:
          </p>
          <ul className="list-disc list-inside mb-3 space-y-1">
            <li className="flex items-center"><Hash className="h-3.5 w-3.5 mr-2 text-blue-500" />WO-123456</li>
            <li className="flex items-center"><Hash className="h-3.5 w-3.5 mr-2 text-blue-500" />WO123456</li>
            <li className="flex items-center"><Hash className="h-3.5 w-3.5 mr-2 text-blue-500" />123456</li>
          </ul>
          <p>
            The system will automatically recognize work order numbers and show matching results.
          </p>
        </div>
      )
    },
    {
      title: 'Find Properties and Units',
      content: (
        <div>
          <p className="mb-3">
            Search for properties by name, address, or city. You can also search for specific units.
          </p>
          <p className="mb-3">
            <span className="flex items-center"><Building2 className="h-3.5 w-3.5 mr-2 text-green-500" />Property names</span>
            <span className="flex items-center mt-1"><Building2 className="h-3.5 w-3.5 mr-2 text-green-500" />Addresses</span>
            <span className="flex items-center mt-1"><Building2 className="h-3.5 w-3.5 mr-2 text-green-500" />Unit numbers</span>
          </p>
          <p>
            Results will show property details and link directly to the property page.
          </p>
        </div>
      )
    },
    {
      title: 'Advanced Filtering',
      content: (
        <div>
          <p className="mb-3">
            Refine your search results with powerful filters:
          </p>
          <ul className="list-disc list-inside mb-3 space-y-1">
            <li className="flex items-center"><Filter className="h-3.5 w-3.5 mr-2 text-gray-500" />Filter by content type (jobs, properties, files, users)</li>
            <li className="flex items-center"><Calendar className="h-3.5 w-3.5 mr-2 text-gray-500" />Filter by date range (today, week, month, year)</li>
            <li className="flex items-center"><Tag className="h-3.5 w-3.5 mr-2 text-gray-500" />Filter by tags and status</li>
          </ul>
          <p>
            Combine filters to quickly find exactly what you're looking for.
          </p>
        </div>
      )
    },
    {
      title: 'Real-time Results',
      content: (
        <div>
          <p className="mb-3">
            Search results appear instantly as you type, with no need to press Enter.
          </p>
          <p className="mb-3">
            Results are organized by type (jobs, properties, files, users) for easy navigation.
          </p>
          <p>
            Each result shows relevant details and tags to help you identify the right item quickly.
          </p>
        </div>
      )
    },
    {
      title: 'Powerful Application Search',
      content: (
        <div>
          <p className="mb-3">
            To access the search feature at any time, simply click the search icon <Search className="h-4 w-4 inline-block mx-1" /> in the top left corner of the application.
          </p>
          <p className="mb-3">
            The search overlay will open, allowing you to search across all content in the application instantly.
          </p>
          <p>
            Use keyboard shortcuts for even faster access: press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-800 dark:text-gray-200 font-mono text-xs">/</kbd> to open search from anywhere.
          </p>
        </div>
      ),
      image: 'https://images.unsplash.com/photo-1571721795195-a2b7f7a3a2a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
    }
  ];

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      dismissTutorial();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (tutorialDismissed || !isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#2D3B4E]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Search className="h-5 w-5 mr-2 text-blue-500" />
            {tutorialSteps[currentStep].title}
          </h2>
          <button 
            onClick={dismissTutorial}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Text content */}
            <div className="md:w-1/2">
              <div className="prose dark:prose-invert">
                {tutorialSteps[currentStep].content}
              </div>
            </div>
            
            {/* Image */}
            {tutorialSteps[currentStep].image && (
              <div className="md:w-1/2">
                <img 
                  src={tutorialSteps[currentStep].image} 
                  alt={tutorialSteps[currentStep].title}
                  className="rounded-lg w-full h-auto object-cover shadow-md"
                />
              </div>
            )}
            
            {/* If no image, show a styled search example */}
            {!tutorialSteps[currentStep].image && (
              <div className="md:w-1/2 bg-gray-50 dark:bg-[#0F172A] rounded-lg p-4 border border-gray-200 dark:border-[#2D3B4E]">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <div className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white">
                    {currentStep === 4 ? "WO-123456" : 
                     currentStep === 5 ? "Oakwood Apartments" :
                     currentStep === 6 ? "Paint job" : "Search example"}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {currentStep === 4 && (
                    <>
                      <div className="p-3 bg-white dark:bg-[#1E293B] rounded-lg border border-gray-200 dark:border-[#2D3B4E] flex items-start">
                        <FileText className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">WO-123456 - Unit 304</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Oakwood Apartments</div>
                          <div className="mt-1 flex items-center text-xs text-gray-500">
                            <Clock className="h-3 w-3 mr-1" />
                            Apr 15, 2025
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {currentStep === 5 && (
                    <>
                      <div className="p-3 bg-white dark:bg-[#1E293B] rounded-lg border border-gray-200 dark:border-[#2D3B4E] flex items-start">
                        <Building2 className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Oakwood Apartments</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">123 Main St, Atlanta, GA</div>
                          <div className="mt-1 flex items-center text-xs text-gray-500">
                            <Clock className="h-3 w-3 mr-1" />
                            Mar 10, 2025
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {currentStep === 6 && (
                    <div className="flex items-center space-x-2 mb-3">
                      <button className="px-3 py-1.5 rounded-full text-sm flex items-center bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        <FileText className="h-4 w-4 mr-1.5" />
                        Jobs
                      </button>
                      <button className="px-3 py-1.5 rounded-full text-sm flex items-center bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                        <Calendar className="h-4 w-4 mr-1.5" />
                        Last 7 Days
                      </button>
                    </div>
                  )}
                  
                  {currentStep === 7 && (
                    <>
                      <div className="p-3 bg-white dark:bg-[#1E293B] rounded-lg border border-gray-200 dark:border-[#2D3B4E] flex items-start">
                        <FileText className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">WO-123456 - Unit 304</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Oakwood Apartments</div>
                          <div className="mt-1 flex items-center text-xs text-gray-500">
                            <Tag className="h-3 w-3 mr-1" />
                            <span className="bg-gray-100 dark:bg-gray-800 px-1.5 rounded text-gray-600 dark:text-gray-400 mr-1">Work Order</span>
                            <span className="bg-gray-100 dark:bg-gray-800 px-1.5 rounded text-gray-600 dark:text-gray-400">Paint</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-white dark:bg-[#1E293B] rounded-lg border border-gray-200 dark:border-[#2D3B4E] flex items-start">
                        <Building2 className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Oakwood Apartments</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">123 Main St, Atlanta, GA</div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {currentStep === 8 && (
                    <div className="relative">
                      <div className="absolute -top-16 -left-4 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
                        <Search className="h-5 w-5 text-white" />
                      </div>
                      <div className="p-3 bg-white dark:bg-[#1E293B] rounded-lg border border-gray-200 dark:border-[#2D3B4E]">
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          Click the search icon in the top left corner to open the search overlay:
                        </p>
                        <div className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <Search className="h-5 w-5 text-gray-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Search icon</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-3 mb-2">
                          Or use the keyboard shortcut:
                        </p>
                        <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Open search</span>
                          <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200 font-mono text-xs">/</kbd>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-[#2D3B4E] bg-gray-50 dark:bg-[#0F172A]">
          <div className="flex items-center">
            <Layers className="h-4 w-4 text-gray-400 mr-1" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Step {currentStep + 1} of {tutorialSteps.length}
            </span>
          </div>
          
          <div className="flex space-x-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </button>
            )}
            
            <button
              onClick={handleNext}
              className="px-4 py-2 flex items-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              {currentStep === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
              {currentStep < tutorialSteps.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}