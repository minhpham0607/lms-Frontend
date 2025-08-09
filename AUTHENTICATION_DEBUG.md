# Debug Guide - Authentication Issues (403 Forbidden)

## 🔍 Troubleshooting Steps

### 1. Check Authentication Status
- Open Browser Developer Tools (F12)
- Go to Console tab
- Look for authentication debug info when loading the page

### 2. Common 403 Errors and Solutions

#### A. Token Not Found
```
❌ No token found
```
**Solution**: Login again
- Go to login page
- Enter your credentials
- Token will be stored in localStorage

#### B. Token Expired
```
❌ Token is expired
```
**Solution**: Clear storage and login again
- Run in console: `localStorage.clear()`
- Refresh page and login again

#### C. Invalid Token Format
```
❌ Invalid token format
```
**Solution**: Clear corrupted token
- Run in console: `localStorage.removeItem('token')`
- Login again

#### D. Wrong API Endpoint or Headers
```
GET http://localhost:8080/api/enrollments 403 (Forbidden)
```
**Check**:
1. Backend server is running on port 8080
2. Auth interceptor is working
3. API endpoint exists and accepts Bearer tokens

### 3. Manual Debug Steps

#### Step 1: Check Token in Browser
```javascript
// Open browser console and run:
const token = localStorage.getItem('token');
console.log('Token:', token);

// If token exists, check if it's JWT format:
if (token && token.split('.').length === 3) {
  console.log('Valid JWT format');
} else {
  console.log('Invalid token format');
}
```

#### Step 2: Test API Manually
```javascript
// Test with manual fetch:
fetch('http://localhost:8080/api/enrollments', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('Status:', response.status);
  return response.text();
})
.then(data => console.log('Response:', data))
.catch(error => console.error('Error:', error));
```

#### Step 3: Check Network Tab
1. Open Developer Tools → Network tab
2. Reload page
3. Look for failed requests (red status)
4. Check request headers for Authorization header
5. Check response for error details

### 4. Backend Checklist

Ensure your backend:
- ✅ Is running on http://localhost:8080
- ✅ Has CORS enabled for frontend origin
- ✅ JWT authentication is properly configured
- ✅ API endpoints exist: `/api/enrollments`, `/api/courses/list`, etc.
- ✅ Bearer token validation is working

### 5. Quick Fixes

#### Reset Authentication
```javascript
// Clear all auth data
localStorage.removeItem('token');
localStorage.removeItem('userInfo');
localStorage.removeItem('username');
localStorage.removeItem('role');
```

#### Check API Server
Visit: http://localhost:8080/health (if health endpoint exists)
Or: http://localhost:8080 (should return something, not connection refused)

### 6. Component Debug Features

Use the debug buttons in the error notice:
- **Debug API**: Detailed API endpoint testing
- **Làm mới Auth**: Clear auth data and prompt for login
- **Mở API Server**: Quick link to backend server

### 7. Logs to Look For

#### Success Pattern:
```
🔑 Current token: eyJhbGciOiJIUzI1NiI...
✅ Token is valid
🔄 Loading participant statistics from API...
✅ API Response - Courses: [...]
✅ API Response - Enrollments: [...]
```

#### Error Pattern:
```
❌ No token found
or
❌ Token is expired
or
GET http://localhost:8080/api/enrollments 403 (Forbidden)
```

### 8. Contact Developer

If issues persist:
1. Copy all console logs
2. Include network tab screenshot
3. Mention current browser and version
4. Include steps to reproduce the issue
