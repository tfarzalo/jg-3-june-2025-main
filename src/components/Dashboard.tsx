import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { DashboardHome } from './DashboardHome';

// Lazy load components
const Jobs = lazy(() => import('./Jobs').then(module => ({ default: module.Jobs })));
const JobRequests = lazy(() => import('./JobRequests').then(module => ({ default: module.JobRequests })));
const WorkOrders = lazy(() => import('./WorkOrders').then(module => ({ default: module.WorkOrders })));
const Invoicing = lazy(() => import('./Invoicing').then(module => ({ default: module.Invoicing })));
const Completed = lazy(() => import('./Completed').then(module => ({ default: module.Completed })));
const CancelledJobs = lazy(() => import('./CancelledJobs').then(module => ({ default: module.CancelledJobs })));
const Archives = lazy(() => import('./Archives').then(module => ({ default: module.Archives })));
const JobDetails = lazy(() => import('./JobDetails').then(module => ({ default: module.JobDetails })));
const Properties = lazy(() => import('./Properties').then(module => ({ default: module.Properties })));
const PropertyDetails = lazy(() => import('./PropertyDetails').then(module => ({ default: module.PropertyDetails })));
const PropertyForm = lazy(() => import('./PropertyForm').then(module => ({ default: module.PropertyForm })));
const PropertyEditForm = lazy(() => import('./PropertyEditForm').then(module => ({ default: module.PropertyEditForm })));
const PropertyGroups = lazy(() => import('./PropertyGroups').then(module => ({ default: module.PropertyGroups })));
const PropertyGroupDetails = lazy(() => import('./PropertyGroupDetails').then(module => ({ default: module.PropertyGroupDetails })));
const PropertyGroupForm = lazy(() => import('./PropertyGroupForm').then(module => ({ default: module.PropertyGroupForm })));
const PropertyArchives = lazy(() => import('./PropertyArchives').then(module => ({ default: module.PropertyArchives })));
const FileManager = lazy(() => import('./FileManager').then(module => ({ default: module.FileManager })));
const FileUpload = lazy(() => import('./FileUpload').then(module => ({ default: module.FileUpload })));
const Calendar = lazy(() => import('./Calendar').then(module => ({ default: module.Calendar })));
const Activity = lazy(() => import('./Activity').then(module => ({ default: module.Activity })));
const Users = lazy(() => import('./Users').then(module => ({ default: module.Users })));
const AppSettings = lazy(() => import('./AppSettings').then(module => ({ default: module.AppSettings })));
const UserProfile = lazy(() => import('./UserProfile').then(module => ({ default: module.UserProfile })));
const SubScheduler = lazy(() => import('./SubScheduler'));
const JobRequestForm = lazy(() => import('./JobRequestForm').then(module => ({ default: module.JobRequestForm })));
const JobEditForm = lazy(() => import('./JobEditForm').then(module => ({ default: module.JobEditForm })));
const WorkOrderForm = lazy(() => import('./WorkOrderForm').then(module => ({ default: module.WorkOrderForm })));
const WorkOrderEditForm = lazy(() => import('./WorkOrderEditForm').then(module => ({ default: module.WorkOrderEditForm })));
const BillingDetailsForm = lazy(() => import('./BillingDetailsForm').then(module => ({ default: module.BillingDetailsForm })));
const NewWorkOrder = lazy(() => import('./NewWorkOrder'));
const TempWorkOrderForm = lazy(() => import('./TempWorkOrderForm'));
const WorkingOrdersBilling = lazy(() => import('./WorkingOrdersBilling').then(module => ({ default: module.WorkingOrdersBilling })));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

export function Dashboard() {
  return (
    <main className="flex-1 overflow-auto">
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route index element={<DashboardHome />} />
          
          {/* Jobs Routes */}
          <Route path="jobs">
            <Route index element={<Jobs />} />
            <Route path="requests" element={<JobRequests />} />
            <Route path="work-orders" element={<WorkOrders />} />
            <Route path="invoicing" element={<Invoicing />} />
            <Route path="completed" element={<Completed />} />
            <Route path="cancelled" element={<CancelledJobs />} />
            <Route path="archives" element={<Archives />} />
            <Route path=":jobId" element={<JobDetails />} />
            <Route path=":jobId/edit" element={<JobEditForm />} />
            <Route path=":jobId/work-order" element={<WorkOrderForm />} />
            <Route path=":jobId/work-order/edit" element={<WorkOrderEditForm />} />
            <Route path=":jobId/billing" element={<WorkingOrdersBilling />} />
            <Route path=":jobId/new-work-order" element={<NewWorkOrder />} />
            <Route path="new" element={<JobRequestForm />} />
          </Route>
          
          {/* Properties Routes */}
          <Route path="properties">
            <Route index element={<Properties />} />
            <Route path="new" element={<PropertyForm />} />
            <Route path="archives" element={<PropertyArchives />} />
            <Route path=":propertyId">
              <Route index element={<PropertyDetails />} />
              <Route path="edit" element={<PropertyEditForm />} />
              <Route path="billing" element={<BillingDetailsForm />} />
            </Route>
          </Route>
          
          {/* Property Groups Routes */}
          <Route path="property-groups">
            <Route index element={<PropertyGroups />} />
            <Route path="new" element={<PropertyGroupForm />} />
            <Route path=":groupId" element={<PropertyGroupDetails />} />
          </Route>
          
          {/* Files Routes */}
          <Route path="files">
            <Route index element={<FileManager />} />
            <Route path="upload" element={<FileUpload />} />
          </Route>
          
          {/* Other Routes */}
          <Route path="calendar" element={<Calendar />} />
          <Route path="activity" element={<Activity />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<AppSettings />} />
          <Route path="profile" element={<UserProfile />} />
          <Route path="sub-scheduler" element={<SubScheduler />} />
          <Route path="job-request" element={<JobRequestForm />} />
        </Routes>
      </Suspense>
    </main>
  );
}

export default Dashboard;