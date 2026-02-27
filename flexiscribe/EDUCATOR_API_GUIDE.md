# Educator API Integration Guide

This guide documents the REST API endpoints for educator functionality and database migration steps.

## Database Schema Changes

### New Models Added

1. **Class** - Stores educator's class schedules
   - `subject`, `section`, `room`, `day`, `startTime`, `endTime`, `students`
   - Related to `Educator` via `educatorId`

2. **Transcription** - Stores lecture transcriptions
   - `title`, `course`, `date`, `duration`, `content`, `rawText`
   - Related to `Educator` via `educatorId`

### Migration Steps

```bash
# Generate Prisma client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_educator_classes_transcriptions

# (Optional) Seed sample data
node prisma/seed-educator.js
```

## REST API Endpoints

### Educator Profile
- **GET** `/api/educator/profile`
  - Returns educator profile with department info
  - Auth: Requires EDUCATOR role

### Classes
- **GET** `/api/educator/classes`
  - Returns all classes for logged-in educator
  - Response: `{ classes: Class[] }`

- **POST** `/api/educator/classes`
  - Creates a new class
  - Body: `{ subject, section, room, day, startTime, endTime?, students? }`

### Schedule
- **GET** `/api/educator/schedule`
  - Returns educator's schedule (same as classes)
  - Response: `{ schedule: Class[] }`

### Transcriptions
- **GET** `/api/educator/transcriptions?course=CPP117`
  - Returns transcriptions, optionally filtered by course
  - Response: `{ transcriptions: Transcription[] }`

- **POST** `/api/educator/transcriptions`
  - Creates a new transcription
  - Body: `{ title, course, date, duration, content, rawText? }`

### Courses
- **GET** `/api/educator/courses`
  - Returns unique course codes from transcriptions
  - Response: `{ courses: string[] }`

### Leaderboard
- **GET** `/api/educator/leaderboard?limit=15`
  - Returns top students by XP
  - Response: `{ students: Student[] }`

## Frontend Updates

All educator pages now fetch from API instead of mock data:

### Pages Updated
- ✅ Dashboard (`/educator/dashboard`)
- ✅ Schedule (`/educator/schedule`)
- ✅ Transcriptions (`/educator/transcriptions`)
- ✅ Classes (`/educator/classes`)

### Components Updated
- ✅ ProfessorProfileCard - fetches educator profile
- ✅ WelcomeCard - fetches educator name
- ✅ ScheduleCard - fetches today's schedule
- ✅ LectureRecordingsCard - fetches recent transcriptions
- ✅ StudentsLeaderboardCard - fetches student rankings
- ✅ Sidebar - fetches unique courses

## Sample Data Structure

### Class Object
```json
{
  "id": "clx...",
  "subject": "CPP117",
  "section": "A",
  "room": "109",
  "day": "Monday",
  "startTime": "10:00 AM",
  "endTime": "11:30 AM",
  "students": 53,
  "educatorId": "...",
  "createdAt": "2026-02-05T...",
  "updatedAt": "2026-02-05T..."
}
```

### Transcription Object
```json
{
  "id": "clx...",
  "title": "Lecture 5: Advanced Topics",
  "course": "CPP117",
  "date": "Feb 3, 2026",
  "duration": "1h 20m",
  "content": "Formatted transcript...",
  "rawText": "Raw transcript text...",
  "educatorId": "...",
  "createdAt": "2026-02-05T...",
  "updatedAt": "2026-02-05T..."
}
```

## Testing

1. Ensure educator is logged in
2. Navigate to educator dashboard - should see profile data
3. Check schedule page - should see classes from database
4. Visit transcriptions - should see transcriptions (if any)
5. Check classes page - should list all classes

## Notes

- All endpoints require authentication
- All endpoints verify EDUCATOR role
- Empty arrays returned if no data exists
- Design remains unchanged - only data source changed from mock to API
