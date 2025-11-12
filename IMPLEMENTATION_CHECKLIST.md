# ✅ Subcontractor Upload & Project Implementation Checklist

**Date Created:** November 11, 2025  
**Last Updated:** November 11, 2025  
**Status:** Ready for Execution

---

## 🎯 PHASE 1: SUBCONTRACTOR VERIFICATION (Week 1)

### Day 1-2: Permission Verification

- [ ] **Run Permission Check Script**
  - [ ] Execute `verify_subcontractor_permissions.sql` in Supabase SQL Editor
  - [ ] Save output to `permission_check_results.txt`
  - [ ] Review for any `✗` or `⚠` symbols
  - [ ] Document all findings

- [ ] **Analyze Results**
  - [ ] Check if `is_subcontractor()` function exists
  - [ ] Verify RLS policies on `files` table
  - [ ] Verify storage policies on `storage.objects`
  - [ ] Check function execution grants
  - [ ] Verify storage buckets are properly configured

- [ ] **Apply Fixes (if needed)**
  - [ ] Run `fix_subcontractor_file_permissions.sql` (if RLS issues found)
  - [ ] Run `manual_storage_policies.sql` (if storage issues found)
  - [ ] Re-run verification script to confirm fixes
  - [ ] Document what was fixed and why

### Day 3-4: End-to-End Testing

- [ ] **Test Subcontractor Account Setup**
  - [ ] Verify test subcontractor account exists
  - [ ] Confirm account has `role = 'subcontractor'` in profiles
  - [ ] Confirm account is assigned to at least one test job
  - [ ] Test login and authentication

- [ ] **Test Work Order Form Access**
  - [ ] Login as subcontractor
  - [ ] Navigate to assigned job
  - [ ] Access "Add/Edit Work Order" form
  - [ ] Verify all fields are visible and accessible
  - [ ] Verify form is not in read-only mode

- [ ] **Test File Upload - Before Images**
  - [ ] Click "Upload Before Images" section
  - [ ] Select 2-3 test images (JPG/PNG)
  - [ ] Verify upload progress shows
  - [ ] Verify thumbnails appear after upload
  - [ ] Verify no console errors
  - [ ] Verify files exist in database: `SELECT * FROM files WHERE category='before' AND job_id='TEST_JOB_ID'`
  - [ ] Verify files exist in storage: Check Supabase Storage dashboard

- [ ] **Test File Upload - Sprinkler Images (if applicable)**
  - [ ] If job has sprinklers, upload sprinkler images
  - [ ] Verify same success criteria as before images
  - [ ] Confirm `required` validation works if images not uploaded

- [ ] **Test Form Validation**
  - [ ] Leave unit number blank - verify error/disabled submit
  - [ ] Leave job category blank - verify error/disabled submit
  - [ ] If subcontractor, verify before images required
  - [ ] If has sprinklers, verify sprinkler images required
  - [ ] Fill all required fields - verify submit button enables

- [ ] **Test Form Submission**
  - [ ] Fill all required fields correctly
  - [ ] Click "Submit Work Order"
  - [ ] Verify success toast appears
  - [ ] Verify redirect to `/dashboard/subcontractor`
  - [ ] Verify work order appears in subcontractor dashboard
  - [ ] Verify work order status updated in database
  - [ ] Verify job phase updated (if applicable)

- [ ] **Test Edit Restrictions**
  - [ ] Try to access same work order form again
  - [ ] Verify form shows appropriate message or is read-only
  - [ ] Verify submission is blocked with clear error message

### Day 5: Documentation & Sign-off

- [ ] **Create Test Report**
  - [ ] Document all tests performed
  - [ ] Document all issues found and resolved
  - [ ] Include screenshots of successful uploads
  - [ ] Include database query results
  - [ ] Include any error messages encountered

- [ ] **Update Documentation**
  - [ ] Update any relevant user guides
  - [ ] Update troubleshooting documentation
  - [ ] Create FAQ entries for common issues

- [ ] **Team Sign-off**
  - [ ] Technical lead reviews and approves
  - [ ] QA lead reviews and approves
  - [ ] Product owner reviews and approves
  - [ ] Schedule demo for stakeholders (if requested)

---

## 🎯 PHASE 2: UX ENHANCEMENTS (Week 2-3)

### Pre-Submission Confirmation Modal

- [ ] **Design Modal**
  - [ ] Create mockup/wireframe
  - [ ] Get approval from product owner
  - [ ] Define content and messaging

- [ ] **Implement Modal Component**
  - [ ] Create `WorkOrderConfirmationModal.tsx` component
  - [ ] Add image preview grid showing all uploaded images
  - [ ] Add summary of work order details
  - [ ] Add "I confirm all information is correct" checkbox
  - [ ] Add "Submit" and "Go Back" buttons
  - [ ] Style for mobile responsiveness

- [ ] **Integrate with NewWorkOrder**
  - [ ] Add modal state management
  - [ ] Show modal on first submission attempt (when `!existingWorkOrder`)
  - [ ] Only proceed with actual submission if user confirms
  - [ ] Add state to track if user has seen confirmation for this session

- [ ] **Test Modal**
  - [ ] Test on desktop browsers (Chrome, Firefox, Safari)
  - [ ] Test on mobile devices (iOS, Android)
  - [ ] Test with different numbers of images (0, 1, 5, 10+)
  - [ ] Test cancel/go back functionality
  - [ ] Test checkbox requirement

### Enhanced Error Messages

- [ ] **Update Edit-Block Message**
  - [ ] Change error message in `NewWorkOrder.tsx` line ~1410
  - [ ] Make message more helpful and actionable
  - [ ] Add suggestion to contact manager
  - [ ] Test message display

- [ ] **Update ImageUpload Error Handling**
  - [ ] Add specific error types (permission, storage, network)
  - [ ] Create user-friendly messages for each error type
  - [ ] Add "retry" functionality for transient errors
  - [ ] Add better logging for debugging

- [ ] **Add Validation Hints**
  - [ ] Add helper text under required fields
  - [ ] Add tooltips for complex fields
  - [ ] Add inline validation messages
  - [ ] Use color coding (red for error, yellow for warning)

### Testing & Refinement

- [ ] **User Testing**
  - [ ] Test with actual subcontractors (if available)
  - [ ] Gather feedback on modal clarity
  - [ ] Gather feedback on error messages
  - [ ] Document any confusion or issues

- [ ] **Refinement**
  - [ ] Adjust based on user feedback
  - [ ] Update content/messaging as needed
  - [ ] Polish styling and animations
  - [ ] Final cross-browser testing

---

## 🎯 PHASE 3: MONITORING & OPTIMIZATION (Week 4)

### Monitoring Setup

- [ ] **Supabase Monitoring**
  - [ ] Set up Supabase log monitoring
  - [ ] Create alerts for repeated errors
  - [ ] Create dashboard for key metrics
  - [ ] Document how to access and interpret logs

- [ ] **Application Monitoring**
  - [ ] Add error tracking (Sentry or similar)
  - [ ] Add performance monitoring
  - [ ] Add custom events for upload success/failure
  - [ ] Create monitoring dashboard

- [ ] **Metrics Tracking**
  - [ ] Track upload success rate
  - [ ] Track average upload time
  - [ ] Track form submission success rate
  - [ ] Track error types and frequency

### Performance Optimization

- [ ] **Image Optimization**
  - [ ] Implement client-side image compression
  - [ ] Set maximum file size limits
  - [ ] Add progress indication for large files
  - [ ] Test with various file sizes

- [ ] **Database Optimization**
  - [ ] Review slow query logs
  - [ ] Add indexes if needed
  - [ ] Optimize RLS policies for performance
  - [ ] Test under load

- [ ] **UI Optimization**
  - [ ] Lazy load components where possible
  - [ ] Optimize re-renders
  - [ ] Test on slow connections (throttle network)
  - [ ] Measure and improve Core Web Vitals

### Documentation Finalization

- [ ] **Create User Guides**
  - [ ] Subcontractor guide: "How to Submit a Work Order"
  - [ ] Manager guide: "Managing Subcontractor Submissions"
  - [ ] Troubleshooting guide for common issues
  - [ ] Video tutorials (optional)

- [ ] **Update Technical Documentation**
  - [ ] Document all database changes
  - [ ] Document all RLS policies
  - [ ] Document storage bucket configuration
  - [ ] Document monitoring setup

---

## 🎯 PHASE 4: ADVANCED FEATURES (Weeks 5-12)

### File Management Enhancements (Weeks 5-6)

- [ ] **File Versioning**
  - [ ] Design version tracking system
  - [ ] Create `file_versions` table
  - [ ] Implement version save on file update
  - [ ] Create version history UI
  - [ ] Add rollback functionality
  - [ ] Test versioning flow

- [ ] **Bulk Operations**
  - [ ] Add checkbox selection to file list
  - [ ] Implement "Select All" functionality
  - [ ] Add bulk delete with confirmation
  - [ ] Add bulk download as ZIP
  - [ ] Add bulk move to folder
  - [ ] Test with large selections

- [ ] **Advanced Search**
  - [ ] Add full-text search input
  - [ ] Implement search across file names and paths
  - [ ] Add filters (file type, date range, uploader)
  - [ ] Add sorting options
  - [ ] Test search performance

### Reporting & Analytics (Weeks 7-9)

- [ ] **Work Order Analytics**
  - [ ] Design analytics dashboard
  - [ ] Query work orders by date range
  - [ ] Calculate completion metrics
  - [ ] Show work orders by subcontractor
  - [ ] Show work orders by property
  - [ ] Add export to CSV

- [ ] **Lead Analytics**
  - [ ] Query leads by date range
  - [ ] Calculate conversion rates
  - [ ] Show lead sources
  - [ ] Show contact status pipeline
  - [ ] Add charts/visualizations

- [ ] **File Storage Analytics**
  - [ ] Calculate storage by property
  - [ ] Calculate storage by user
  - [ ] Show file type distribution
  - [ ] Show storage growth trends
  - [ ] Add cleanup recommendations

### Mobile Optimization (Weeks 10-12)

- [ ] **PWA Setup**
  - [ ] Create service worker
  - [ ] Create web app manifest
  - [ ] Add offline page
  - [ ] Test "Add to Home Screen"
  - [ ] Test offline functionality

- [ ] **Camera Integration**
  - [ ] Add camera capture button on mobile
  - [ ] Request camera permissions
  - [ ] Capture photo from camera
  - [ ] Preview before upload
  - [ ] Test on iOS and Android

- [ ] **Mobile Performance**
  - [ ] Implement lazy loading
  - [ ] Optimize images for mobile
  - [ ] Reduce bundle size
  - [ ] Test on 3G/4G connections
  - [ ] Measure and optimize Core Web Vitals

---

## 🎯 PHASE 5: INTEGRATIONS (Weeks 13-20)

### QuickBooks Integration (Weeks 13-15)

- [ ] **Setup**
  - [ ] Create QuickBooks developer account
  - [ ] Set up OAuth 2.0
  - [ ] Create admin settings for QB config
  - [ ] Test authentication flow

- [ ] **Invoice Generation**
  - [ ] Map work orders to QB invoices
  - [ ] Map billing details to QB items
  - [ ] Implement invoice creation
  - [ ] Handle invoice updates
  - [ ] Test end-to-end

- [ ] **Expense Tracking**
  - [ ] Map expenses to QB bills
  - [ ] Implement expense sync
  - [ ] Handle vendor payments
  - [ ] Test reconciliation

### Advanced Scheduling (Weeks 16-18)

- [ ] **Visual Calendar**
  - [ ] Implement calendar UI
  - [ ] Add drag-and-drop functionality
  - [ ] Show job details on hover
  - [ ] Add day/week/month views
  - [ ] Test interactions

- [ ] **Auto-Scheduling**
  - [ ] Define scheduling rules
  - [ ] Implement optimization algorithm
  - [ ] Consider availability constraints
  - [ ] Consider proximity/travel time
  - [ ] Test optimization

### Document Generation (Weeks 19-20)

- [ ] **PDF Generation**
  - [ ] Choose PDF library (jsPDF or Puppeteer)
  - [ ] Create work order template
  - [ ] Generate PDF from work order data
  - [ ] Include images in PDF
  - [ ] Add email functionality

- [ ] **Email Templates**
  - [ ] Create template builder UI
  - [ ] Implement variable substitution
  - [ ] Save templates to database
  - [ ] Test email sending
  - [ ] Track email opens

---

## 📊 SUCCESS METRICS TO TRACK

### Operational Metrics
- [ ] Work order processing time < 24 hours
- [ ] Upload success rate > 99.5%
- [ ] System uptime > 99.9%
- [ ] Page load time < 2 seconds (P95)

### User Satisfaction
- [ ] Subcontractor satisfaction > 4.5/5
- [ ] Customer satisfaction > 4.5/5
- [ ] Support tickets < 5/week
- [ ] Feature adoption rate > 80%

### Business Metrics
- [ ] Lead conversion rate improving
- [ ] Revenue per property growing
- [ ] Profit margins stable/improving
- [ ] Subcontractor retention > 90%

---

## 🚨 RISK MITIGATION CHECKLIST

- [ ] **Security**
  - [ ] Regular security audits scheduled
  - [ ] Dependency updates automated
  - [ ] Penetration testing completed
  - [ ] Incident response plan documented

- [ ] **Performance**
  - [ ] Load testing completed
  - [ ] Database backup verified
  - [ ] CDN configured properly
  - [ ] Monitoring alerts configured

- [ ] **Business Continuity**
  - [ ] Disaster recovery plan documented
  - [ ] Key person dependencies identified
  - [ ] Documentation kept up-to-date
  - [ ] Regular team training scheduled

---

## 📝 NOTES & BLOCKERS

### Current Blockers
*(None at this time)*

### Pending Decisions
*(None at this time)*

### Important Notes
- All verification and testing should be done with actual subcontractor accounts
- Keep stakeholders updated weekly on progress
- Document everything - future you will thank present you
- Don't skip testing phases - they save time in the long run

---

## ✅ COMPLETION CHECKLIST

Mark complete when all items in a phase are done:

- [ ] **Phase 1 Complete:** Subcontractor verification (Week 1)
- [ ] **Phase 2 Complete:** UX enhancements (Weeks 2-3)
- [ ] **Phase 3 Complete:** Monitoring & optimization (Week 4)
- [ ] **Phase 4 Complete:** Advanced features (Weeks 5-12)
- [ ] **Phase 5 Complete:** Integrations (Weeks 13-20)

**Project Status:**  
🔵 Not Started | 🟡 In Progress | 🟢 Complete

**Current Phase:** 🔵 Phase 1 - Ready to Begin

---

**Last Updated:** November 11, 2025  
**Next Review:** End of Week 1 (After Phase 1 complete)
