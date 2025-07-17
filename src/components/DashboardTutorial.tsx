import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  LayoutGrid, 
  ClipboardList, 
  Calendar, 
  FileText, 
  Building2, 
  FolderOpen, 
  Settings,
  Users,
  Activity,
  HelpCircle,
  Search,
  DollarSign,
  CheckCircle,
  Bell,
  Layers
} from 'lucide-react';
import { useUserRole } from '../hooks/useUserRole';
import { useLocation } from 'react-router-dom';

interface TutorialStep {
  title: string;
  content: React.ReactNode;
  target: string;
  position: 'top' | 'right' | 'bottom' | 'left' | 'center';
  image?: string;
}

// Create context for tutorial state
const TutorialContext = createContext<{
  showTutorial: boolean;
  setShowTutorial: (show: boolean) => void;
}>({
  showTutorial: false,
  setShowTutorial: () => {},
});

export const useTutorial = () => useContext(TutorialContext);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showTutorial, setShowTutorial] = useState(false);
  
  return (
    <TutorialContext.Provider value={{ showTutorial, setShowTutorial }}>
      {children}
    </TutorialContext.Provider>
  );
};

export function DashboardTutorial() {
  const { isAdmin, isJGManagement } = useUserRole();
  const { showTutorial, setShowTutorial } = useTutorial();
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [tooltipSize, setTooltipSize] = useState({ width: 320, height: 200 });
  const [tooltipRef, setTooltipRef] = useState<HTMLDivElement | null>(null);
  const location = useLocation();

  const tutorialSteps: TutorialStep[] = [
    {
      title: 'Welcome to JG Portal 2.5',
      content: (
        <div>
          <p className="mb-3">
            Welcome to JG Portal 2.5! This tutorial will guide you through the main features of the dashboard.
          </p>
          <p>
            Let's explore the powerful tools that will help you manage your painting business efficiently.
          </p>
        </div>
      ),
      target: 'body',
      position: 'center',
      image: 'https://images.unsplash.com/photo-1586769852044-692d6e3703f2?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
    },
    {
      title: 'Dashboard Overview',
      content: (
        <div>
          <p className="mb-3">
            The dashboard provides a quick overview of all your jobs, including job requests, work orders, and completed jobs.
          </p>
          <p>
            Key metrics are displayed at the top, with detailed sections below for different job types and statuses.
          </p>
        </div>
      ),
      target: '[data-tutorial="dashboard"]',
      position: 'right'
    },
    {
      title: 'Job Management',
      content: (
        <div>
          <p className="mb-3">
            Manage all your jobs from here. You can view job requests, work orders, and track jobs through different phases.
          </p>
          <p>
            The system automatically organizes jobs by their current phase, making it easy to see what needs attention.
          </p>
        </div>
      ),
      target: '[data-tutorial="jobs"]',
      position: 'right'
    },
    {
      title: 'Properties Management',
      content: (
        <div>
          <p className="mb-3">
            Manage all your properties and property groups. You can add new properties, edit existing ones, and view property details.
          </p>
          <p>
            Each property stores important information like contact details, paint colors, and billing information.
          </p>
        </div>
      ),
      target: '[data-tutorial="properties"]',
      position: 'right'
    },
    {
      title: 'File Management',
      content: (
        <div>
          <p className="mb-3">
            Upload, organize, and manage all your files. Files can be associated with properties or jobs.
          </p>
          <p>
            Store important documents like contracts, photos, and invoices in an organized folder structure.
          </p>
        </div>
      ),
      target: '[data-tutorial="files"]',
      position: 'right'
    },
    {
      title: 'Calendar View',
      content: (
        <div>
          <p className="mb-3">
            View and manage your scheduled jobs in a calendar view. This helps you plan your work efficiently.
          </p>
          <p>
            The calendar shows all scheduled jobs, color-coded by their current phase, making it easy to see your workload at a glance.
          </p>
        </div>
      ),
      target: '[data-tutorial="calendar"]',
      position: 'right'
    },
    {
      title: 'Activity Tracking',
      content: (
        <div>
          <p className="mb-3">
            Track all activities in the system, including job phase changes, updates, and more.
          </p>
          <p>
            The activity log provides a complete history of all actions taken in the system, helping you maintain accountability.
          </p>
        </div>
      ),
      target: '[data-tutorial="activity"]',
      position: 'right'
    },
    {
      title: 'User Management',
      content: (
        <div>
          <p className="mb-3">
            As an admin, you can manage users, assign roles, and control access to different parts of the system.
          </p>
          <p>
            Add new team members, set their permissions, and ensure everyone has the right level of access.
          </p>
        </div>
      ),
      target: '[data-tutorial="users"]',
      position: 'right'
    },
    {
      title: 'Settings & Preferences',
      content: (
        <div>
          <p className="mb-3">
            Configure your profile, application settings, and preferences.
          </p>
          <p>
            Customize the application to work the way you do, including theme preferences and notification settings.
          </p>
        </div>
      ),
      target: '[data-tutorial="settings"]',
      position: 'right'
    },
    {
      title: 'Powerful Search',
      content: (
        <div>
          <p className="mb-3">
            The search feature allows you to quickly find anything in the system - jobs, properties, files, and users.
          </p>
          <p className="mb-3">
            Click the search icon <Search className="h-4 w-4 inline-block mx-1" /> in the top left corner to access the search overlay.
          </p>
          <p>
            You can search by work order number, property name, address, or any other relevant information.
          </p>
        </div>
      ),
      target: 'button[aria-label="Search"]',
      position: 'bottom',
      image: 'https://images.unsplash.com/photo-1571721795195-a2b7f7a3a2a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
    },
    {
      title: 'You\'re All Set!',
      content: (
        <div>
          <p className="mb-3">
            You've completed the tutorial and are ready to use JG Portal 2.5!
          </p>
          <p>
            You can access this tutorial again anytime by clicking on your profile and selecting "Show Tutorial".
          </p>
        </div>
      ),
      target: 'body',
      position: 'center',
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'
    }
  ];

  useEffect(() => {
    // Check for query parameter
    const params = new URLSearchParams(location.search);
    const showTutorialParam = params.get('showTutorial');
    
    if (showTutorialParam === 'true') {
      setShowTutorial(true);
      // Clean up the URL
      const newUrl = location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }
    
    // Only show tutorial for admin and JG Management users if not dismissed
    if (shouldShowTutorial()) {
      setShowTutorial(true);
    }
  }, [isAdmin, isJGManagement, location]);

  useEffect(() => {
    if (!showTutorial) return;

    const step = tutorialSteps[currentStep];
    let element: HTMLElement | null = null;

    if (step.target === 'body') {
      element = document.body;
    } else {
      element = document.querySelector(step.target) as HTMLElement;
    }

    setTargetElement(element);

    if (element && step.position !== 'center') {
      const rect = element.getBoundingClientRect();
      const tooltipWidth = tooltipSize.width;
      const tooltipHeight = tooltipSize.height;
      
      let top = 0;
      let left = 0;

      switch (step.position) {
        case 'top':
          top = rect.top - tooltipHeight - 10;
          left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
          break;
        case 'right':
          top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
          left = rect.right + 10;
          break;
        case 'bottom':
          top = rect.bottom + 10;
          left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
          break;
        case 'left':
          top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
          left = rect.left - tooltipWidth - 10;
          break;
      }

      // Adjust if tooltip goes off screen
      if (left < 0) left = 10;
      if (top < 0) top = 10;
      if (left + tooltipWidth > window.innerWidth) left = window.innerWidth - tooltipWidth - 10;
      if (top + tooltipHeight > window.innerHeight) top = window.innerHeight - tooltipHeight - 10;

      setTooltipPosition({ top, left });
    } else {
      // Center in viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      setTooltipPosition({
        top: (viewportHeight - tooltipSize.height) / 2,
        left: (viewportWidth - tooltipSize.width) / 2
      });
    }
  }, [currentStep, showTutorial, tooltipSize]);

  useEffect(() => {
    if (tooltipRef) {
      const { width, height } = tooltipRef.getBoundingClientRect();
      setTooltipSize({ width, height });
    }
  }, [tooltipRef, currentStep]);

  const shouldShowTutorial = () => {
    const tutorialDismissed = localStorage.getItem('dashboardTutorialDismissed') === 'true';
    return !tutorialDismissed;
  };

  const dismissTutorial = () => {
    localStorage.setItem('dashboardTutorialDismissed', 'true');
    setShowTutorial(false);
  };

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

  if (!showTutorial) return null;

  const currentTutorialStep = tutorialSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isCentered = currentTutorialStep.position === 'center';

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={() => dismissTutorial()}
      />

      {/* Highlight target element */}
      {targetElement && !isCentered && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.getBoundingClientRect().width + 8,
            height: targetElement.getBoundingClientRect().height + 8,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
            border: '2px solid #3B82F6'
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={setTooltipRef}
        className="fixed z-50 bg-white dark:bg-[#1E293B] rounded-lg shadow-xl p-6 max-w-md"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          width: isCentered ? 'auto' : tooltipSize.width
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <HelpCircle className="h-5 w-5 mr-2 text-blue-500" />
            {currentTutorialStep.title}
          </h3>
          <button 
            onClick={dismissTutorial}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mb-6">
          <div className="text-gray-700 dark:text-gray-300">
            {currentTutorialStep.content}
          </div>
          
          {currentTutorialStep.image && (
            <div className="mt-4">
              <img 
                src={currentTutorialStep.image} 
                alt={currentTutorialStep.title}
                className="rounded-lg w-full h-auto object-cover shadow-md"
              />
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={dismissTutorial}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Skip & Don't Show Again
            </button>
          </div>
          
          <div className="flex space-x-3">
            {!isFirstStep && (
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
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
            </button>
          </div>
        </div>
        
        <div className="mt-4 flex justify-center">
          <div className="flex space-x-1">
            {tutorialSteps.map((_, index) => (
              <div 
                key={index}
                className={`h-1.5 rounded-full ${
                  index === currentStep 
                    ? 'w-4 bg-blue-600' 
                    : 'w-1.5 bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}