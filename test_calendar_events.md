# Calendar Events Testing Guide

## 🧪 **Testing Checklist**

### ✅ **Prerequisites**
- [ ] SQL migration has been applied (RLS policies updated)
- [ ] calendar-feed Edge Function has been deployed
- [ ] Development server is running (`npm run dev`)

### 🔐 **Authentication Testing**
1. **Login as Admin/JG Management User**
   - Navigate to the Calendar page
   - Verify "+ New Event" button is visible
   - Verify "Subscribe to Calendars" button is visible

2. **Login as Regular User/Subcontractor**
   - Navigate to the Calendar page
   - Verify "+ New Event" button is NOT visible
   - Verify "Subscribe to Calendars" button is visible

### 📅 **Event Creation Testing**
1. **Create a New Event**
   - Click "+ New Event" button
   - Fill out the form:
     - Title: "Test Event"
     - Details: "This is a test event"
     - Color: Select a color
     - Start Date: Today
     - End Date: Today
     - Start Time: 09:00
     - End Time: 10:00
   - Click "Create Event"
   - Verify event appears on calendar immediately

2. **Create an All-Day Event**
   - Create another event with "All day" checked
   - Verify it displays correctly on the calendar

### 📊 **Calendar Display Testing**
1. **Event Visualization**
   - Verify events appear with their selected colors
   - Verify events show title and details
   - Verify event count displays correctly in day headers

2. **Mixed Content Display**
   - Verify events and jobs display together
   - Verify events are prioritized (shown first)
   - Verify total count includes both events and jobs

### 🔗 **Calendar Subscription Testing**
1. **Subscribe to Calendars Modal**
   - Click "Subscribe to Calendars" button
   - Verify all four feed types are displayed:
     - Events
     - Events & Job Requests
     - Completed Jobs
     - Per-Subcontractor Feeds (admin only)

2. **Feed URL Generation**
   - Verify ICS URLs are generated with proper tokens
   - Verify URLs include correct scope parameters
   - Verify subcontractor feeds are available for admin users

3. **One-Click Integration**
   - Test Apple Calendar link (webcal://)
   - Test Google Calendar link (cid=)
   - Verify URLs are properly formatted

### 🔄 **Real-time Testing**
1. **Event Updates**
   - Create an event in one browser/tab
   - Verify it appears immediately in another browser/tab
   - Verify real-time subscription is working

2. **Cross-User Updates**
   - Create event as one user
   - Verify it appears for other users in real-time

### 🛡️ **Security Testing**
1. **Role-based Access**
   - Verify non-admin users cannot create events
   - Verify admin users can access all features
   - Verify token generation works for all users

2. **Feed Security**
   - Test feed access with invalid tokens
   - Verify proper error responses
   - Test admin access to subcontractor feeds

## 🚀 **Expected Results**

### **Admin/JG Management Users Should See:**
- ✅ "+ New Event" button
- ✅ "Subscribe to Calendars" button
- ✅ All four feed types
- ✅ Subcontractor feed management
- ✅ Full event creation capabilities

### **Regular Users Should See:**
- ❌ "+ New Event" button (hidden)
- ✅ "Subscribe to Calendars" button
- ✅ Personal feed access
- ❌ Subcontractor feed management

### **Calendar Should Display:**
- ✅ Events with distinct colors
- ✅ Jobs with existing styling
- ✅ Proper event/job counts
- ✅ Real-time updates
- ✅ Responsive design

## 🐛 **Common Issues & Solutions**

### **Event Modal Not Opening**
- Check browser console for errors
- Verify user has proper role permissions
- Check if EventModal component is properly imported

### **Events Not Displaying**
- Verify calendar_events table exists
- Check Supabase RLS policies
- Verify real-time subscription is working

### **Feed URLs Not Generating**
- Check if ensure_calendar_token function exists
- Verify calendar_tokens table permissions
- Check Edge Function deployment status

### **Build Errors**
- Run `npm run build` to identify issues
- Check import paths and component dependencies
- Verify all required files are created

## 📝 **Test Results Template**

```
Test Date: _____________
Tester: _______________
User Role: _____________

✅ Event Creation: [ ] Pass [ ] Fail
✅ Event Display: [ ] Pass [ ] Fail
✅ Real-time Updates: [ ] Pass [ ] Fail
✅ Role-based Access: [ ] Pass [ ] Fail
✅ Calendar Subscriptions: [ ] Pass [ ] Fail
✅ Feed Security: [ ] Pass [ ] Fail

Notes: ________________________________
Issues Found: _________________________
Resolution: ___________________________
```

## 🎯 **Success Criteria**

The implementation is successful when:
1. **Admin users can create and view events**
2. **Regular users can view events but not create them**
3. **Events display correctly alongside jobs**
4. **Real-time updates work for all users**
5. **Calendar subscriptions generate valid ICS feeds**
6. **All security measures are properly enforced**
7. **No existing job functionality is broken**

---

**Ready to test! Navigate to the Calendar page and start with the authentication testing.**
