import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { RouteGuard, SubcontractorRouteGuard, AdminRouteGuard } from './RouteGuard';

// Lazy load components - using correct pattern for each export type
const DashboardHome = lazy(() => import('./DashboardHome').then(module => ({ default: module.DashboardHome })));
const Jobs = lazy(() => import('./Jobs').then(module => ({ default: module.Jobs })));
const JobRequests = lazy(() => import('./JobRequests').then(module => ({ default: module.JobRequests })));
const WorkOrders = lazy(() => import('./WorkOrders').then(module => ({ default: module.WorkOrders })));
const Invoicing = lazy(() => import('./Invoicing').then(module => ({ default: module.Invoicing })));
const Completed = lazy(() => import('./Completed').then(module => ({ default: module.Completed })));
const CancelledJobs = lazy(() => import('./CancelledJobs').then(module => ({ default: module.CancelledJobs })));
const Archives = lazy(() => import('./Archives').then(module => ({ default: module.Archives })));
const JobDetails = lazy(() => import('./JobDetails').then(module => ({ default: module.JobDetails })));
const JobEditForm = lazy(() => import('./JobEditForm').then(module => ({ default: module.JobEditForm })));
const WorkOrderForm = lazy(() => import('./WorkOrderForm').then(module => ({ default: module.WorkOrderForm })));
const WorkOrderEditForm = lazy(() => import('./WorkOrderEditForm').then(module => ({ default: module.WorkOrderEditForm })));
const WorkingOrdersBilling = lazy(() => import('./WorkingOrdersBilling').then(module => ({ default: module.WorkingOrdersBilling })));
const NewWorkOrder = lazy(() => import('./NewWorkOrder'));
const JobRequestForm = lazy(() => import('./JobRequestForm').then(module => ({ default: module.JobRequestForm })));
const Properties = lazy(() => import('./Properties').then(module => ({ default: module.Properties })));
const PropertyForm = lazy(() => import('./PropertyForm').then(module => ({ default: module.PropertyForm })));
const PropertyDetails = lazy(() => import('./PropertyDetails').then(module => ({ default: module.PropertyDetails })));
const PropertyEditForm = lazy(() => import('./PropertyEditForm').then(module => ({ default: module.PropertyEditForm })));
const BillingDetailsForm = lazy(() => import('./BillingDetailsForm').then(module => ({ default: module.BillingDetailsForm })));
const PropertyGroups = lazy(() => import('./PropertyGroups').then(module => ({ default: module.PropertyGroups })));
const PropertyGroupDetails = lazy(() => import('./PropertyGroupDetails').then(module => ({ default: module.PropertyGroupDetails })));
const PropertyGroupForm = lazy(() => import('./PropertyGroupForm').then(module => ({ default: module.PropertyGroupForm })));
const PropertyGroupArchives = lazy(() => import('./PropertyGroupArchives').then(module => ({ default: module.PropertyGroupArchives })));
const PropertyArchives = lazy(() => import('./PropertyArchives').then(module => ({ default: module.PropertyArchives })));
const FileManager = lazy(() => import('./FileManager').then(module => ({ default: module.FileManager })));
const FileUpload = lazy(() => import('./FileUpload').then(module => ({ default: module.FileUpload })));
const Calendar = lazy(() => import('./Calendar').then(module => ({ default: module.Calendar })));
const Activity = lazy(() => import('./Activity').then(module => ({ default: module.Activity })));
const Users = lazy(() => import('./Users').then(module => ({ default: module.Users })));
const AppSettings = lazy(() => import('./AppSettings').then(module => ({ default: module.AppSettings })));
const UserProfile = lazy(() => import('./UserProfile').then(module => ({ default: module.UserProfile })));
const SubScheduler = lazy(() => import('./SubScheduler'));
const SubcontractorDashboard = lazy(() => import('./SubcontractorDashboard').then(module => ({ default: module.SubcontractorDashboard })));
const SupportTickets = lazy(() => import('../pages/SupportTickets').then(module => ({ default: module.SupportTickets })));
const Contacts = lazy(() => import('./Contacts').then(module => ({ default: module.Contacts })));
const ContactDetail = lazy(() => import('./ContactDetail').then(module => ({ default: module.ContactDetail })));

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
          
          {/* Subcontractor Dashboard Route - Only accessible by subcontractors */}
          <Route path="subcontractor" element={
            <SubcontractorRouteGuard>
              <SubcontractorDashboard />
            </SubcontractorRouteGuard>
          } />
          
          {/* Jobs Routes - Protected for admin/management only */}
          <Route path="jobs/*" element={
            <RouteGuard>
              <Routes>
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
                <Route path="new" element={<JobRequestForm />} />
              </Routes>
            </RouteGuard>
          } />
          
          {/* Work Order Route - Accessible by subcontractors for their assigned jobs */}
          <Route path="jobs/:jobId/new-work-order" element={<NewWorkOrder />} />
          
          {/* Properties Routes - Protected for admin/management only */}
          <Route path="properties/*" element={
            <RouteGuard>
              <Routes>
                <Route index element={<Properties />} />
                <Route path="new" element={<PropertyForm />} />
                <Route path="archives" element={<PropertyArchives />} />
                <Route path=":propertyId">
                  <Route index element={<PropertyDetails />} />
                  <Route path="edit" element={<PropertyEditForm />} />
                  <Route path="billing" element={<BillingDetailsForm />} />
                </Route>
              </Routes>
            </RouteGuard>
          } />
          
          {/* Property Groups Routes - Protected for admin/management only */}
          <Route path="property-groups/*" element={
            <RouteGuard>
              <Routes>
                <Route index element={<PropertyGroups />} />
                <Route path="new" element={<PropertyGroupForm />} />
                <Route path=":groupId/edit" element={<PropertyGroupForm />} />
                <Route path="archives" element={<PropertyGroupArchives />} />
                <Route path=":groupId" element={<PropertyGroupDetails />} />
              </Routes>
            </RouteGuard>
          } />
          
          {/* Files Routes - Protected for admin/management only */}
          <Route path="files/*" element={
            <RouteGuard>
              <Routes>
                <Route index element={<FileManager />} />
                <Route path="upload" element={<FileUpload />} />
              </Routes>
            </RouteGuard>
          } />
          
          {/* Other Routes - Protected for admin/management only */}
          <Route path="calendar" element={
            <RouteGuard>
              <Calendar />
            </RouteGuard>
          } />
          <Route path="activity" element={
            <RouteGuard>
              <Activity />
            </RouteGuard>
          } />
          <Route path="users" element={
            <RouteGuard>
              <Users />
            </RouteGuard>
          } />
          <Route path="settings" element={
            <AdminRouteGuard>
              <AppSettings />
            </AdminRouteGuard>
          } />
          <Route path="profile" element={
            <RouteGuard>
              <UserProfile />
            </RouteGuard>
          } />
          <Route path="sub-scheduler" element={
            <RouteGuard>
              <SubScheduler />
            </RouteGuard>
          } />
          <Route path="job-request" element={
            <RouteGuard>
              <JobRequestForm />
            </RouteGuard>
          } />
          <Route path="contacts" element={
            <RouteGuard>
              <Contacts />
            </RouteGuard>
          } />
          <Route path="contacts/:contactId" element={
            <RouteGuard>
              <ContactDetail />
            </RouteGuard>
          } />
          <Route path="support" element={
            <RouteGuard>
              <SupportTickets />
            </RouteGuard>
          } />
        </Routes>
      </Suspense>
    </main>
  );
}

export default Dashboard;