# Mock Data Documentation

This file contains all the sample data used throughout the fLexiScribe student dashboard for UI visualization and testing purposes.

## Purpose

- **Centralized Data Management**: All mock data is stored in one location for easy editing
- **Placeholder for Database**: Acts as a temporary data source until the backend API is connected
- **Consistent Data Structure**: Ensures all components use the same data format

## Data Structures

### 1. `mockUserProfile`
Contains the current student's profile information.

**Usage**: Profile page, User menu, Dashboard
```javascript
{
  username: string,
  firstName: string,
  lastName: string,
  email: string,
  studentId: string,
  course: string,
  yearLevel: string,
  role: string,
  profileImage: string (path)
}
```

### 2. `mockDashboardStats`
Dashboard statistics for the current user.

**Usage**: Dashboard cards
```javascript
{
  rank: string,
  xp: number,
  xpProgress: number (percentage),
  studyStreak: number (days),
  streakIcon: string (emoji)
}
```

### 3. `mockNotifications`
Array of notifications displayed in the notification dropdown.

**Usage**: NotificationMenu component
```javascript
[{
  id: number,
  type: "reviewer" | "quiz" | "achievement",
  title: string,
  message: string,
  time: string,
  read: boolean,
  link: string (route)
}]
```

### 4. `mockReviewers`
Array of available study reviewers.

**Usage**: Reviewers page, Search functionality
```javascript
[{
  id: number,
  title: string,
  subject: string,
  description: string,
  uploadDate: string (YYYY-MM-DD),
  lastUpdated: string (YYYY-MM-DD),
  downloads: number,
  views: number
}]
```

### 5. `mockQuizzes`
Array of available quizzes.

**Usage**: Quizzes page, Search functionality
```javascript
[{
  id: number,
  title: string,
  subject: string,
  description: string,
  totalQuestions: number,
  duration: number (minutes),
  difficulty: "Easy" | "Medium" | "Hard",
  passingScore: number (percentage),
  attempts: number,
  availableUntil: string (YYYY-MM-DD)
}]
```

### 6. `mockLeaderboard`
Array of top students for the leaderboard.

**Usage**: Leaderboard page
```javascript
[{
  rank: number,
  username: string,
  studentId: string,
  xp: number,
  level: string,
  streak: number,
  quizzesTaken: number,
  averageScore: number
}]
```

### 7. `mockSearchData`
Combined searchable data for the search bar.

**Usage**: SearchBar component (auto-generated from reviewers and quizzes)
```javascript
[{
  id: string,
  type: "reviewer" | "quiz",
  title: string,
  subject: string,
  link: string (route)
}]
```

### 8. `mockRecentActivity`
Recent user activities.

**Usage**: Dashboard activity feed
```javascript
[{
  id: number,
  type: "quiz" | "reviewer" | "achievement",
  title: string,
  score?: number,
  date: string (YYYY-MM-DD),
  time: string (HH:MM)
}]
```

### 9. `mockAchievements`
User achievements and badges.

**Usage**: Achievements page, Dashboard
```javascript
[{
  id: number,
  name: string,
  description: string,
  icon: string (emoji),
  earned: boolean,
  earnedDate: string | null (YYYY-MM-DD)
}]
```

### 10. `mockSubjects`
List of available subjects/courses.

**Usage**: Subject selection, Filters
```javascript
[{
  code: string,
  name: string,
  semester: number,
  year: number
}]
```

### 11. `mockQuotes`
Motivational quotes for the dashboard.

**Usage**: Dashboard quote widget
```javascript
[{
  text: string,
  quote: string,
  author: string
}]
```

## How to Use

### Importing Mock Data

```javascript
// Import specific data you need
import { mockUserProfile, mockNotifications } from "./mockData";

// Or import everything
import * as MockData from "./mockData";
```

### Example Usage in a Component

```javascript
import { mockUserProfile } from "./mockData";

export default function MyComponent() {
  const [user, setUser] = useState(mockUserProfile);
  
  return <div>Welcome, {user.username}!</div>;
}
```

## Editing Mock Data

To change any mock data:

1. Open `mockData.js`
2. Find the relevant data structure
3. Edit the values as needed
4. Save the file

Changes will be reflected immediately in all components using that data.

## Database Migration

When connecting to the actual database:

1. **Keep the same data structure** to minimize component changes
2. **Replace imports** from `mockData.js` with API calls
3. **Update useState** to use fetched data instead of mock data

### Example Migration

**Before (Mock Data):**
```javascript
import { mockUserProfile } from "./mockData";

const [user, setUser] = useState(mockUserProfile);
```

**After (API):**
```javascript
const [user, setUser] = useState(null);

useEffect(() => {
  fetch('/api/user/profile')
    .then(res => res.json())
    .then(data => setUser(data));
}, []);
```

## Notes

- All dates are in `YYYY-MM-DD` format
- All times are in `HH:MM` format (24-hour)
- Icons in components are mapped separately (see component files)
- File paths are relative to the public directory
- Student IDs follow the format `YYYY-XXXXX`

## Components Using Mock Data

| Component | Data Used |
|-----------|-----------|
| Dashboard | mockUserProfile, mockDashboardStats |
| UserMenu | mockUserProfile |
| NotificationMenu | mockNotifications |
| SearchBar | mockSearchData |
| Profile | mockUserProfile |
| Reviewers | mockReviewers |
| Quizzes | mockQuizzes |
| Leaderboard | mockLeaderboard |

## Last Updated

December 24, 2025
